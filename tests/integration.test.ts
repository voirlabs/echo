// Integration tests against a real Postgres: the OAuth server and the MCP endpoint.
// Run with a migrated, disposable database:
//   TEST_DATABASE_URL=postgresql://echo:echo@127.0.0.1:5432/echo_test pnpm test
// Skipped when TEST_DATABASE_URL is not set.
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB = process.env.TEST_DATABASE_URL;
if (DB) {
  process.env.DATABASE_URL = DB;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}

describe.skipIf(!DB)("integration", async () => {
  // Vitest still runs a skipped suite's body to collect its tests, so stop
  // before the imports below construct a Prisma client with no database URL.
  if (!DB) {
    it("needs TEST_DATABASE_URL", () => {});
    return;
  }
  const { prisma } = await import("../apps/web/src/lib/db");
  const oauth = await import("../apps/web/src/lib/oauth");
  const tokenRoute = await import("../apps/web/src/app/api/oauth/token/route");
  const mcp = await import("../apps/web/src/app/mcp/route");

  const { OWNER_ID } = await import("../apps/web/src/lib/auth");
  const redirectUri = "https://claude.ai/api/mcp/auth_callback";
  let userId = "";
  let clientId = "";

  beforeAll(async () => {
    // The one owner row, as the app creates it on first sign-in.
    userId = (await prisma.user.upsert({ where: { id: OWNER_ID }, create: { id: OWNER_ID, name: "Integration Test" }, update: {} })).id;
    clientId = (await oauth.registerClient({ name: "Test client", redirectUris: [redirectUri] }))!.clientId;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: OWNER_ID } });
    await prisma.oAuthClient.deleteMany({ where: { clientId } });
    await prisma.$disconnect();
  });

  const pkce = () => {
    const verifier = randomBytes(32).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
  };
  const newCode = (challenge: string) =>
    oauth.issueCode({ clientId, userId, redirectUri, codeChallenge: challenge, scope: oauth.SCOPE, resource: null });
  const tokenRequest = (params: Record<string, string>) =>
    tokenRoute.POST(
      new Request("http://localhost:3000/api/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      }),
    );

  describe("OAuth server", () => {
    it("redeems a code once, and a replay revokes what it issued", async () => {
      const code = await newCode(pkce().challenge);
      const row = await oauth.consumeCode(code);
      expect(row).not.toBeNull();
      const t = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: row!.id });
      expect(await oauth.verifyAccessToken(t.access_token)).not.toBeNull();
      expect(await oauth.consumeCode(code)).toBeNull();
      expect(await oauth.verifyAccessToken(t.access_token)).toBeNull();
    });

    it("token endpoint: requires the same redirect_uri and a valid PKCE verifier", async () => {
      const p = pkce();
      const base = { grant_type: "authorization_code", client_id: clientId, code_verifier: p.verifier };
      const wrongRedirect = await tokenRequest({ ...base, code: await newCode(p.challenge), redirect_uri: "https://claude.ai/other" });
      expect(wrongRedirect.status).toBe(400);
      // One registered URI: a client may leave redirect_uri out, as it may on /authorize.
      const omitted = await tokenRequest({ ...base, code: await newCode(p.challenge) });
      expect(omitted.status).toBe(200);
      const badVerifier = await tokenRequest({ ...base, code: await newCode(p.challenge), redirect_uri: redirectUri, code_verifier: pkce().verifier });
      expect(badVerifier.status).toBe(400);
      const ok = await tokenRequest({ ...base, code: await newCode(p.challenge), redirect_uri: redirectUri });
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.token_type).toBe("Bearer");
      expect(await oauth.verifyAccessToken(body.access_token)).toMatchObject({ userId, clientId });
    });

    it("rotates refresh tokens and revokes everything when an old one is replayed", async () => {
      const first = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const second = await oauth.refreshTokens(first.refresh_token, clientId);
      expect(second).not.toBeNull();
      expect(await oauth.verifyAccessToken(first.access_token)).toBeNull();
      expect(await oauth.verifyAccessToken(second!.access_token)).not.toBeNull();
      // Replaying the rotated token is treated as theft.
      expect(await oauth.refreshTokens(first.refresh_token, clientId)).toBeNull();
      expect(await oauth.verifyAccessToken(second!.access_token)).toBeNull();
    });

    it("refuses a refresh token presented by another client", async () => {
      const t = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      expect(await oauth.refreshTokens(t.refresh_token, "someone-else")).toBeNull();
    });

    it("binds tokens to the owner and stops honouring them once revoked", async () => {
      const t = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      expect((await oauth.verifyAccessToken(t.access_token))?.userId).toBe(OWNER_ID);
      await oauth.revokeToken(t.refresh_token);
      expect(await oauth.verifyAccessToken(t.access_token)).toBeNull();
    });
  });

  describe("MCP endpoint", () => {
    const rpc = async (token: string | null, method: string, params: unknown = {}) => {
      const res = await mcp.POST(
        new Request("http://localhost:3000/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
      );
      return { status: res.status, body: res.status === 200 ? await res.json() : null };
    };

    it("refuses an oversized body even without a Content-Length", async () => {
      const res = await mcp.POST(
        new Request("http://localhost:3000/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(300 * 1024) }),
      );
      expect(res.status).toBe(413);
    });

    it("rejects a missing or wrong token", async () => {
      expect((await rpc(null, "tools/list")).status).toBe(401);
      expect((await rpc("oat_nope", "tools/list")).status).toBe(401);
    });

    it("lists the tools, accepts old kind names and saves a draft", async () => {
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const list = await rpc(access_token, "tools/list");
      expect(list.status).toBe(200);
      const names = list.body.result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual(expect.arrayContaining(["get_writer_context", "check_draft", "save_draft", "get_style_tasks"]));

      // An assistant with a cached tool list may still send the old kind names.
      const check = await rpc(access_token, "tools/call", { name: "check_draft", arguments: { text: "Hi there, I can help.", kind: "proposal" } });
      expect(check.body.result.structuredContent.issues.join(" ")).toMatch(/greeting/i);

      const saved = await rpc(access_token, "tools/call", {
        name: "save_draft",
        arguments: {
          url: "https://mail.example.com/thread/7",
          title: "Reply to Dana",
          text: "Six weeks works. I rebuilt a checkout on Next.js and Stripe last spring, in five.",
          kind: "email",
          keep_despite_issues: true,
        },
      });
      const result = saved.body.result.structuredContent;
      expect(result).toMatchObject({ saved: true });
      expect(result.draft_key).toMatch(/^d-/);
    });

    it("names itself with an icon, so clients don't fall back to the domain's favicon", async () => {
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const init = await rpc(access_token, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0.0" },
      });
      expect(init.body.result.serverInfo.icons[0]).toMatchObject({ src: "http://localhost:3000/apple-icon.png", mimeType: "image/png" });
    });

    it("drafts a page the extension asked for: requested, drafting, ready", async () => {
      const { createPageRequest } = await import("../apps/web/src/lib/page-requests");
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const call = async (name: string, args: Record<string, unknown> = {}) =>
        (await rpc(access_token, "tools/call", { name, arguments: args })).body.result.structuredContent;
      const page = {
        url: "https://jobs.example.com/ledgerly/apply?utm_source=x",
        title: "Apply: Senior designer",
        pageText: "Ledgerly is hiring a senior product designer to own checkout.",
        fields: [
          { id: "f1", label: "Full name", kind: "line", selector: "#name" },
          { id: "f2", label: "Why do you want this role?", kind: "long", maxLength: 600, selector: "#why" },
        ],
      };
      const made = await createPageRequest(userId, page);
      expect(made.ok).toBe(true);
      const key = made.ok ? made.key : "";
      // Asking again for the same page, before it's drafted, reuses the request.
      expect(await createPageRequest(userId, page)).toEqual({ ok: true, key });

      const req = await call("get_page_request", { request_id: key });
      expect(req).toMatchObject({ found: true, request_id: key, untrusted_page: { url: "https://jobs.example.com/ledgerly/apply" } });
      expect(req.notice).toMatch(/third-party website/);
      expect(req.untrusted_page.page_text).toMatch(/^<untrusted_page_content>\n[\s\S]*\n<\/untrusted_page_content>$/);
      expect(req.untrusted_page.fields.map((f: { field_id: string }) => f.field_id)).toEqual(["f1", "f2"]);
      expect(req.writer_context).toHaveProperty("writing_rules");
      expect((await prisma.draft.findUnique({ where: { userId_key: { userId, key } } }))?.status).toBe("drafting");

      const saved = await call("save_page_draft", {
        request_id: key,
        field_values: [
          { field_id: "f1", value: "Sam Rivera" },
          { field_id: "f2", value: "I rebuilt a checkout last spring and cut drop-off by 18% in a quarter." },
          { field_id: "f9", value: "stray" },
        ],
        keep_despite_issues: true,
      });
      expect(saved).toMatchObject({ saved: true, filled: 2, of: 2, unknown_field_ids: ["f9"] });
      const draft = await prisma.draft.findUnique({ where: { userId_key: { userId, key } } });
      expect(draft?.status).toBe("ready");
      expect(draft?.text).toContain("Full name\nSam Rivera");

      expect(await call("get_page_request", { request_id: "d-missing" })).toMatchObject({ found: false });
      await prisma.draft.deleteMany({ where: { userId, key } });
    });

    it("lets the assistant keep the profile: entries, about, read and remove", async () => {
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const call = async (name: string, args: Record<string, unknown> = {}) =>
        (await rpc(access_token, "tools/call", { name, arguments: args })).body.result.structuredContent;

      const first = await call("save_profile_entry", { title: "Head of design at Ledgerly", details: "Team of 6." });
      expect(first).toMatchObject({ saved: true, updated: false });
      // The same fact again, with a different case: updated, not duplicated.
      const again = await call("save_profile_entry", { title: "head of design at ledgerly", details: "Team of 6, design system." });
      expect(again).toMatchObject({ saved: true, updated: true, entry_id: first.entry_id });
      expect(await prisma.profileEntry.count({ where: { userId } })).toBe(1);

      expect(await call("update_about_me", { name: "Sam", about: "Product designer in Lisbon." })).toMatchObject({ saved: true });
      expect(await call("update_about_me", {})).toMatchObject({ saved: false });

      const profile = await call("get_profile");
      expect(profile).toMatchObject({ name: "Sam", about: "Product designer in Lisbon." });
      expect(profile.entries).toEqual([{ entry_id: first.entry_id, title: "head of design at ledgerly", details: "Team of 6, design system." }]);

      expect(await call("remove_profile_entry", { entry_id: first.entry_id })).toMatchObject({ removed: true });
      expect(await call("remove_profile_entry", { entry_id: first.entry_id })).toMatchObject({ removed: false });
      expect(await call("save_profile_entry", { entry_id: "gone", title: "x" })).toMatchObject({ saved: false });
    });

    it("saves several drafts for one page, and updates by key", async () => {
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: oauth.SCOPE, codeId: null });
      const save = (args: Record<string, unknown>) =>
        rpc(access_token, "tools/call", {
          name: "save_draft",
          arguments: { title: "Application", text: "Your onboarding loses half its users at step two. I rebuilt a flow like it.", keep_despite_issues: true, ...args },
        });
      const url = "https://jobs.example.com/acme/42?utm_source=x";
      const a = (await save({ url })).body.result.structuredContent;
      const b = (await save({ url })).body.result.structuredContent;
      expect(a.saved && b.saved).toBe(true);
      expect(a.draft_key).not.toBe(b.draft_key);
      expect(await prisma.draft.count({ where: { userId, url: "https://jobs.example.com/acme/42" } })).toBe(2);
      await save({ draft_key: a.draft_key, text: "Revised: your onboarding loses users at step two." });
      expect((await prisma.draft.findUnique({ where: { userId_key: { userId, key: a.draft_key } } }))?.text).toMatch(/^Revised/);
      expect((await save({ draft_key: "d-missing" })).body.result.structuredContent.saved).toBe(false);
    });

    it("learns the style without a queue: notes, then the guide, reset on delete", async () => {
      const samples = await import("../apps/web/src/lib/writing-samples");
      const tasks = await import("../apps/web/src/lib/style-tasks");
      const a = await samples.addWritingSample(userId, "Your checkout drops sessions under load. I fixed the same race last year.");
      await samples.addWritingSample(userId, "Thanks for the brief. Short version: I can start Monday and ship in two weeks.");
      expect(a.ok).toBe(true);

      let todo = await tasks.listStyleTasks(userId);
      expect(todo.tasks.map((t) => t.task_id.split(":")[0])).toEqual(["note", "note"]);
      expect(await tasks.pendingStyleTaskCount(userId)).toBe(3);
      for (const t of todo.tasks) await tasks.applyStyleTaskResult(userId, t.task_id, "SENTENCE & RHYTHM: short.");

      todo = await tasks.listStyleTasks(userId);
      expect(todo.tasks).toHaveLength(1);
      expect(todo.tasks[0].task_id).toMatch(/^guide:/);
      await expect(tasks.applyStyleTaskResult(userId, todo.tasks[0].task_id, "   ")).rejects.toThrow();
      await tasks.applyStyleTaskResult(userId, todo.tasks[0].task_id, "VOICE & TONE: direct.");
      expect(await tasks.pendingStyleTaskCount(userId)).toBe(0);
      expect((await prisma.user.findUnique({ where: { id: userId } }))?.writingStyle).toMatch(/VOICE & TONE: direct/);

      await samples.deleteWritingSample(userId, a.ok ? a.sample.id : 0);
      expect((await prisma.user.findUnique({ where: { id: userId } }))?.writingStyle).toBeNull();
      expect(await tasks.pendingStyleTaskCount(userId)).toBe(1);
      await expect(tasks.applyStyleTaskResult(userId, "nope:1", "x")).rejects.toBeInstanceOf(tasks.StyleTaskError);
    });

    it("refuses a token without the scope", async () => {
      const { access_token } = await oauth.issueTokens({ clientId, userId, scope: "other", codeId: null });
      expect((await rpc(access_token, "tools/list")).status).toBe(403);
    });
  });
  describe("profile entries", () => {
    it("gives the assistant the entries that match the brief, best first", async () => {
      const { writerContext } = await import("../apps/web/src/lib/writer");
      await prisma.profileEntry.createMany({
        data: [
          { userId, title: "Pottery classes", details: "Taught weekend wheel-throwing to beginners." },
          { userId, title: "Shopify Plus migration", details: "Moved a 4,000 SKU store from WooCommerce to Shopify Plus." },
        ],
      });
      const ctx = await writerContext(userId, { description: "We need someone to migrate our WooCommerce store to Shopify." });
      expect(ctx.relevant_material[0]?.title).toBe("Shopify Plus migration");
      expect(ctx.writer).not.toHaveProperty("skills");
      await prisma.profileEntry.deleteMany({ where: { userId } });
    });
  });

  describe("learning from edits", () => {
    it("an edit keeps the draft's title, and its version is added as a sample once", async () => {
      const drafts = await import("../apps/web/src/lib/drafts");
      const samples = await import("../apps/web/src/lib/writing-samples");
      const { editedMeaningfully } = await import("../apps/web/src/lib/edits");
      const generated = "I moved a similar system to a queue last year and the failures stopped. I can start on Monday.";
      const saved = await drafts.saveDraft(userId, { url: "https://example.com/post/edits", title: "Billing jobs", text: generated });
      expect(saved.ok).toBe(true);
      const key = saved.ok ? saved.key : "";

      const edited = "Last year I put a system like this on a queue and the night failures went away. Monday works for me.";
      expect(editedMeaningfully(generated, edited)).toBe(true);
      expect((await drafts.saveDraft(userId, { key, title: "", text: edited })).ok).toBe(true);
      const row = await prisma.draft.findUnique({ where: { userId_key: { userId, key } } });
      expect(row).toMatchObject({ title: "Billing jobs", text: edited });

      const first = await samples.addWritingSample(userId, edited, "Billing jobs");
      const again = await samples.addWritingSample(userId, `  ${edited}\n`, "Billing jobs");
      expect(first).toMatchObject({ ok: true, duplicate: false });
      expect(again).toMatchObject({ ok: true, duplicate: true });
      expect(await prisma.writingSample.count({ where: { userId, text: edited } })).toBe(1);

      const room = samples.MAX_SAMPLES - (await prisma.writingSample.count({ where: { userId } }));
      for (let i = 0; i < room; i++) await samples.addWritingSample(userId, `Filler sample number ${i}.`);
      const full = await samples.addWritingSample(userId, "One more than the limit allows.");
      expect(full.ok).toBe(false);
      await prisma.writingSample.deleteMany({ where: { userId } });
    });

    it("an unknown draft can't be edited", async () => {
      const drafts = await import("../apps/web/src/lib/drafts");
      expect((await drafts.saveDraft(userId, { key: "d-missing", title: "", text: "x" })).ok).toBe(false);
    });
  });
});
