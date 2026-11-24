"use client";

import { useState } from "react";
import { SectionHeading } from "./_ui";

// "Things to draw on": facts the assistant saved and can cite (a role, a project,
// a result, a credential). The assistant keeps them; here they can be read and
// removed, through /api/user/entries.

type Entry = { id: string; title: string; details: string };

function EntryCard({ title, description, onRemove }: {
  title: string; description: string; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDesc = description.trim() !== "";
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <button type="button" onClick={() => hasDesc && setOpen((o) => !o)} aria-expanded={hasDesc ? open : undefined} className="entry-toggle">
          <span aria-hidden="true" style={{ fontSize: 11, color: "var(--faint)", width: 10 }}>{hasDesc ? (open ? "▾" : "▸") : ""}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{title}</span>
            {!open && hasDesc && <span className="ellipsis" style={{ display: "block", fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{description}</span>}
          </span>
        </button>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={onRemove} className="text-btn danger" aria-label={`Remove ${title}`}>Remove</button>
        </div>
      </div>
      {open && <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "10px 0 0", paddingLeft: 18, whiteSpace: "pre-wrap" }}>{description}</p>}
    </div>
  );
}

export function EntriesSection({ initial }: { initial: Entry[] }) {
  const [items, setItems] = useState<Entry[]>(initial);
  const [error, setError] = useState("");

  async function remove(id: string) {
    if (!confirm("Remove this entry?")) return;
    setError("");
    const res = await fetch("/api/user/entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    if (res?.ok) setItems(items.filter((it) => it.id !== id));
    else setError("Couldn't remove it. Try again.");
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <SectionHeading title="Things to draw on">
        Facts your assistant saved from your chats and can cite: roles, projects, results, credentials. It picks the ones
        that fit what you&apos;re replying to.
      </SectionHeading>
      {error && <p role="alert" className="msg error" style={{ margin: "0 0 12px" }}>{error}</p>}
      {items.length === 0 ? (
        <p className="profile-empty">
          Nothing yet. Mention a role, a project or a result in a chat with your assistant and it saves it here.
        </p>
      ) : (
        items.map((it) => <EntryCard key={it.id} title={it.title} description={it.details} onRemove={() => remove(it.id)} />)
      )}
    </div>
  );
}
