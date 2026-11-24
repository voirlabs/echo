import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// One registered client; validateAuthorizeRequest looks it up by client_id.
const clients: Record<string, { clientId: string; name: string; redirectUris: string[] }> = {
  one: { clientId: "one", name: "One", redirectUris: ["https://app.example.com/cb"] },
  two: { clientId: "two", name: "Two", redirectUris: ["https://a.example.com/cb", "https://b.example.com/cb"] },
};
vi.mock("@/lib/db", () => ({
  prisma: { oAuthClient: { findUnique: async ({ where }: { where: { clientId: string } }) => clients[where.clientId] ?? null } },
}));
const { pkceMatches, isAllowedRedirectUri, validateAuthorizeRequest, MCP_RESOURCE, RegisterBody } = await import("../apps/web/src/lib/oauth");

describe("PKCE", () => {
  const verifier = "a".repeat(43) + "-._~";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  it("matches the S256 challenge", () => expect(pkceMatches(verifier, challenge)).toBe(true));
  it("rejects a wrong or malformed verifier", () => {
    expect(pkceMatches("b".repeat(43), challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("allows https and loopback http only", () => {
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:6274/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://x.example/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
  });
});

describe("validateAuthorizeRequest", () => {
  const challenge = "c".repeat(43);
  const query = (over: Record<string, string | null> = {}) => {
    const q = new URLSearchParams({ client_id: "one", response_type: "code", code_challenge: challenge, code_challenge_method: "S256" });
    for (const [k, v] of Object.entries(over)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    return q;
  };

  it("accepts a valid request, defaulting to the client's one redirect URI", async () => {
    expect(await validateAuthorizeRequest(query())).toMatchObject({ ok: true, req: { redirectUri: "https://app.example.com/cb" } });
    expect(await validateAuthorizeRequest(query({ redirect_uri: "https://app.example.com/cb", resource: `${MCP_RESOURCE}/` }))).toMatchObject({ ok: true });
  });

  it("needs an exact registered redirect URI", async () => {
    expect(await validateAuthorizeRequest(query({ redirect_uri: "https://app.example.com/cb/" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ redirect_uri: "https://app.example.com/cb?x=1" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ redirect_uri: "https://evil.example.com/cb" }))).toMatchObject({ ok: false });
    // No default when the client registered several.
    expect(await validateAuthorizeRequest(query({ client_id: "two" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ client_id: "two", redirect_uri: "https://b.example.com/cb" }))).toMatchObject({ ok: true });
  });

  it("refuses unknown clients, plain PKCE, other response types and resources", async () => {
    expect(await validateAuthorizeRequest(query({ client_id: "nobody" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ code_challenge_method: "plain" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ code_challenge_method: null }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ code_challenge: "short" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ response_type: "token" }))).toMatchObject({ ok: false });
    expect(await validateAuthorizeRequest(query({ resource: "https://other.example.com/mcp" }))).toMatchObject({ ok: false });
  });
});

describe("client registration", () => {
  it("takes 1 to 10 allowed redirect URIs and ignores other metadata", () => {
    expect(RegisterBody.safeParse({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "Claude", logo_uri: "x" }).success).toBe(true);
    expect(RegisterBody.safeParse({ redirect_uris: ["http://localhost:6274/cb"], client_name: 42 })).toMatchObject({ success: true, data: { client_name: undefined } });
  });

  it("refuses missing, too many or unsafe redirect URIs", () => {
    expect(RegisterBody.safeParse({}).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: [] }).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: Array(11).fill("https://a.example.com/cb") }).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: ["http://evil.example.com/cb"] }).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: ["https://a.example.com/cb#frag"] }).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: [`https://a.example.com/${"x".repeat(2000)}`] }).success).toBe(false);
    expect(RegisterBody.safeParse({ redirect_uris: [42] }).success).toBe(false);
  });
});
