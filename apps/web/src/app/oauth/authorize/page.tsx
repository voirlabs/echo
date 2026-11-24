import { APP_NAME } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { validateAuthorizeRequest } from "@/lib/oauth";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";
import { ASSISTANT_ACCESS } from "@/components/assistant-setup";

// Consent screen for connecting an AI assistant (ChatGPT app, Claude connector or
// another MCP client) to your Echo data. The proxy sends
// signed-out visitors to /login and brings them back here.

export const metadata: Metadata = { title: `Connect to ${APP_NAME}`, robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div style={{ marginBottom: 32 }}><Logo size={34} /></div>
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="card">{children}</div>
      </div>
      <LegalFooter />
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = new URLSearchParams();
  // `decision` comes only from the button the user presses.
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "decision") q.set(k, v);

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`);

  const v = await validateAuthorizeRequest(q);
  if (!v.ok) {
    return (
      <Shell>
        <p className="label" style={{ margin: "0 0 8px" }}>Connection stopped</p>
        <p role="alert" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", margin: 0 }}>{v.show}</p>
      </Shell>
    );
  }
  const r = v.req;
  const returnTo = new URL(r.redirectUri);
  const returnHost = returnTo.host;
  // Hosts of the assistants we document. Anyone can register a client and call it
  // anything, so the destination, not the name, is what the user should check.
  const KNOWN = ["chatgpt.com", "claude.ai", "claude.com"];
  const known = KNOWN.some((h) => returnTo.hostname === h || returnTo.hostname.endsWith(`.${h}`));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(returnTo.hostname);

  return (
    <Shell>
      <p className="label" style={{ margin: "0 0 8px" }}>Connect an assistant</p>
      <h1 className="display" style={{ fontSize: 28, margin: "0 0 16px", overflowWrap: "anywhere" }}>
        Allow <em>{r.clientName}</em> to use your {APP_NAME} account?
      </h1>
      <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, margin: "0 0 12px" }}>
        If you allow it, this assistant can:
      </p>
      <ul className="quote-list" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20, color: "var(--muted)" }}>
        {ASSISTANT_ACCESS.map((a) => <li key={a}>{a}</li>)}
      </ul>
      <p className={known || loopback ? "msg" : "msg error"} style={{ margin: "0 0 12px", ...(known || loopback ? { border: "1px solid var(--line-2)", color: "var(--text)" } : {}) }}>
        After you choose, you&apos;ll return to <strong>{returnHost}</strong>.
        {!known && !loopback && " Only allow this if you started the connection from that site yourself."}
        {loopback && " That's an app on this computer, such as a developer tool."}
      </p>
      <p style={{ fontSize: 13, color: "var(--faint)", lineHeight: 1.6, margin: "0 0 24px" }}>
        It cannot change your password or settings. You can disconnect it at any time under Profile, Connected assistants.
      </p>
      <form method="post" action="/api/oauth/authorize" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[...q.entries()].map(([k, val]) => (
          <input key={k} type="hidden" name={k} value={val} />
        ))}
        <button type="submit" name="decision" value="allow" className="btn" style={{ flex: 1 }}>
          Allow
        </button>
        <button type="submit" name="decision" value="deny" className="btn ghost" style={{ flex: 1 }}>
          Cancel
        </button>
      </form>
    </Shell>
  );
}
