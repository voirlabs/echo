"use client";

import { APP_NAME } from "@/lib/site";
import { useEffect, useState } from "react";
import Link from "next/link";

type Connection = { clientId: string; name: string; connectedAt: string; lastUsedAt: string | null };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Not yet");

/** Assistants connected over MCP, each with a Disconnect button. */
export function Connections() {
  const [items, setItems] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/connections")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { connections: Connection[] }) => setItems(d.connections))
      .catch(() => setError("Couldn't load connected assistants."));
  }, []);

  async function disconnect(c: Connection) {
    if (!confirm(`Disconnect ${c.name}? It will lose access to your ${APP_NAME} account until you connect it again.`)) return;
    setBusy(c.clientId);
    setError("");
    const res = await fetch("/api/user/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: c.clientId }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) setItems((cur) => (cur ?? []).filter((x) => x.clientId !== c.clientId));
    else setError("Couldn't disconnect. Try again.");
  }

  return (
    <section id="connected-assistants" className="card" style={{ marginTop: 16, scrollMarginTop: 80 }} aria-labelledby="connections-heading">
      <h2 className="section-title" id="connections-heading">Connected assistants</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px", maxWidth: 600 }}>
        Assistants you connected, such as Claude or ChatGPT. They read and keep your profile up
        to date, save drafts, and keep your style guide current.
      </p>
      {error && <p role="alert" className="msg error" style={{ margin: "0 0 12px" }}>{error}</p>}
      {items === null && !error && <p style={{ fontSize: 13, color: "var(--faint)", margin: 0 }}>Loading…</p>}
      {items?.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
          No assistants connected. <Link href="/connect" className="text-link">Connect Claude or ChatGPT</Link>
        </p>
      )}
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((c) => (
            <li
              key={c.clientId}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, overflowWrap: "anywhere" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--faint)" }}>
                  Connected {fmt(c.connectedAt)} · Last used {fmt(c.lastUsedAt)}
                </div>
              </div>
              <button type="button" className="btn ghost small" disabled={busy === c.clientId} onClick={() => disconnect(c)}>
                {busy === c.clientId ? "Disconnecting…" : "Disconnect"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
