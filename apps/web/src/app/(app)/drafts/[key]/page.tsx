import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeQuestions } from "@/lib/draft-questions";
import { normalizeFields } from "@/lib/page-fields";
import { APP_NAME } from "@/lib/site";
import { PageHeader } from "@/components/page-header";
import { DeleteDraftButton } from "../_delete-button";
import { DraftText } from "./_draft-text";
import { AddAsSample } from "./_add-as-sample";

export const metadata: Metadata = { title: "Draft" };

const textBox: React.CSSProperties = {
  padding: "16px 20px", fontSize: 15, lineHeight: 1.7, color: "var(--text)", background: "var(--input)",
  border: "1px solid var(--input-line)", borderRadius: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
};

export default async function DraftPage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { key } = await params;

  const draft = await prisma.draft.findUnique({
    where: { userId_key: { userId: session.user.id, key } },
    select: { title: true, url: true, brief: true, text: true, questions: true, status: true, fields: true },
  });
  if (!draft) notFound();

  const questions = normalizeQuestions(draft.questions);
  const fields = normalizeFields(draft.fields);

  return (
    <div className="page-pad">
      <Link href="/drafts" className="text-btn" style={{ display: "inline-block", marginBottom: 12, paddingLeft: 0 }}>
        ← Drafts
      </Link>
      <PageHeader
        title={draft.title || "Untitled draft"}
        action={
          draft.url ? (
            <a href={draft.url} target="_blank" rel="noopener noreferrer" className="btn ghost small">
              Open link ↗
            </a>
          ) : undefined
        }
      />

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {draft.status !== "ready" && (
          <p role="status" className="msg draft-pending">
            {draft.status === "drafting"
              ? "Your assistant is drafting this page."
              : "Waiting for your assistant. Paste the prompt from the extension into Claude or ChatGPT."}
          </p>
        )}

        {fields.length > 0 ? (
          <section>
            <h2 className="label" style={{ margin: "0 0 8px" }}>Fields</h2>
            <div className="draft-fields">
              {fields.map((f) => (
                <div key={f.id}>
                  <div className="draft-field-label">{f.label || "Unlabelled field"}</div>
                  {f.value ? <div style={textBox}>{f.value}</div> : <div className="draft-field-empty">Not drafted</div>}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <DraftText draftKey={key} text={draft.text} label={draft.title} />
        )}

        {questions.length > 0 && (
          <section>
            <h2 className="label" style={{ margin: "0 0 8px" }}>Questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {questions.map((q, i) => (
                <div key={i}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", lineHeight: 1.5, marginBottom: 6 }}>{q.question}</div>
                  {q.answer ? <div style={textBox}>{q.answer}</div> : <div style={{ fontSize: 14, color: "var(--faint)" }}>Not answered</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {draft.text && <AddAsSample key={draft.text} text={draft.text} label={draft.title} />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, color: "var(--faint)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            To use it, open the {APP_NAME} extension on the page and choose Fill.{" "}
            {fields.length === 0 ? "To change it, choose Edit, or ask your assistant to revise it and save again." : "To change it, ask your assistant to revise it and save again."}
          </p>
          <DeleteDraftButton draftKey={key} redirectTo="/drafts" />
        </div>
      </div>

      {draft.brief && (
        <details className="card" style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--text)" }}>What it answers</summary>
          <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {draft.brief}
          </div>
        </details>
      )}
    </div>
  );
}
