import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { APP_NAME, EXTENSION_URL } from "@/lib/site";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/notice";
import { DeleteDraftButton } from "./_delete-button";
import { normalizeFields } from "@/lib/page-fields";

export const metadata: Metadata = { title: "Drafts" };

function timeAgo(date: Date): string {
  const hours = Math.round((Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const preview = (text: string, max = 320) => text.replace(/\n+/g, " ").trim().slice(0, max).trimEnd() + (text.length > max ? "…" : "");
/** What a draft says: its text, or for a filled page its longest answer (not every label and value run together). */
const mainText = (d: { text: string; fields: unknown }) => {
  const values = normalizeFields(d.fields).map((f) => f.value).filter(Boolean);
  return values.length > 1 ? values.reduce((a, b) => (b.length > a.length ? b : a)) : d.text;
};
const host = (url: string) => { try { return new URL(url).host; } catch { return ""; } };

export default async function DraftsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [connections, drafts] = await Promise.all([
    prisma.oAuthToken.count({ where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } } }),
    prisma.draft.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { key: true, title: true, url: true, text: true, status: true, fields: true, updatedAt: true },
    }),
  ]);

  return (
    <div className="page-pad">
      <PageHeader
        title="Drafts"
        description="Emails, messages, posts and applications your assistant saved. To fill one in, open the browser extension on its page."
        action={drafts.length > 0 ? <a href="/drafts/export" className="btn ghost small">Export all</a> : undefined}
      />

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          action={connections === 0 ? { href: "/connect", label: "Connect Claude or ChatGPT" } : undefined}
        >
          In Claude or ChatGPT, paste what you&apos;re replying to and ask {APP_NAME} for a draft, or open the{" "}
          {EXTENSION_URL ? (
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="text-link">extension</a>
          ) : (
            "browser extension"
          )}
          {" "}on a page and paste its prompt into your assistant. It appears here when it&apos;s saved.
        </EmptyState>
      ) : (
        <div className="draft-list">
          {drafts.map((d) => (
            <article key={d.key} className="card draft-card">
              <div className="draft-head">
                <span className="draft-head-title">
                  <Link href={`/drafts/${d.key}`} className="draft-title">{d.title || "Untitled draft"}</Link>
                  {d.status !== "ready" && (
                    <span className="draft-status">{d.status === "drafting" ? "Drafting" : "Waiting for your assistant"}</span>
                  )}
                </span>
                {d.url && <span className="draft-host ellipsis">{host(d.url)}</span>}
              </div>
              <p className="draft-preview clamp-2">{d.text ? preview(mainText(d)) : d.status === "drafting" ? "Your assistant is drafting this page." : "Not drafted yet. Paste the prompt from the extension into your assistant."}</p>
              <div className="draft-meta">
                <span>Updated {timeAgo(d.updatedAt)}</span>
                <span className="draft-actions">
                  <DeleteDraftButton draftKey={d.key} />
                  <Link href={`/drafts/${d.key}`} className="btn ghost small">Open</Link>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
