"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editedMeaningfully } from "@/lib/edits";
import { CopyButton } from "./_copy-button";

const textBox: React.CSSProperties = {
  padding: "16px 20px", fontSize: 15, lineHeight: 1.7, color: "var(--text)", background: "var(--input)",
  border: "1px solid var(--input-line)", borderRadius: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
};

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The draft's text, editable in place. After an edit that changes it meaningfully,
 * offer once to add the new version as a writing sample. Nothing is added
 * without the user's click.
 */
export function DraftText({ draftKey, text, label }: { draftKey: string; text: string; label: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(text);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(draftKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Couldn't save it. Try again." });
      const next = value.trim();
      setOffer(editedMeaningfully(saved, next) ? next : null);
      setSaved(next);
      setEditing(false);
      setMsg({ ok: true, text: "Saved" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function addSample() {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await fetch("/api/user/style-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: offer, label }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Couldn't add it. Try again." });
      setOffer(null);
      setMsg({ ok: true, text: data.duplicate ? "That version is already one of your writing samples." : "Added to your writing samples." });
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const words = wordCount(editing ? value : saved);
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 className="label" style={{ margin: 0 }}>Draft · {words === 1 ? "1 word" : `${words} words`}</h2>
        {!editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost small" onClick={() => { setValue(saved); setEditing(true); setMsg(null); }}>Edit</button>
            <CopyButton text={saved} />
          </div>
        )}
      </div>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea aria-label="Draft text" className="input" rows={12} value={value} onChange={(e) => setValue(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn small" onClick={save} disabled={busy || !value.trim()}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn ghost small" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={textBox}>{saved}</div>
      )}
      {offer && (
        <div style={{ marginTop: 12, padding: "12px 16px", border: "1px solid var(--line)", borderRadius: 10 }}>
          <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.6 }}>
            You changed this draft. Add your version to your writing samples, so your style is learned from your own words?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn small" onClick={addSample} disabled={busy}>{busy ? "Adding…" : "Add as writing sample"}</button>
            <button type="button" className="btn ghost small" onClick={() => setOffer(null)} disabled={busy}>No thanks</button>
          </div>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} style={{ fontSize: 13, margin: "8px 0 0", color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</p>}
    </section>
  );
}
