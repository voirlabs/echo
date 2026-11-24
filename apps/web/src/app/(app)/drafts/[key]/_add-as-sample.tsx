"use client";

import { useState } from "react";

/** Add the version the user actually sent as a writing sample. Prefilled with the
 *  draft, which they edit to match what they sent: learning from the model's own
 *  text would teach the style guide the model's voice. */
export function AddAsSample({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/user/style-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, label }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Couldn't add it. Try again." });
      setMsg({ ok: true, text: data.duplicate ? "That text is already one of your samples." : "Added to your writing samples." });
      setOpen(false);
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label htmlFor="sample-text" style={{ fontSize: 14, color: "var(--text)" }}>
            Edit this to match what you actually sent. Your style is learned from your own words.
          </label>
          <textarea id="sample-text" className="input" rows={10} value={value} onChange={(e) => setValue(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn small" onClick={save} disabled={busy || !value.trim()}>{busy ? "Adding…" : "Add sample"}</button>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>Add as writing sample</button>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} style={{ fontSize: 13, margin: "8px 0 0", color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</p>}
    </section>
  );
}
