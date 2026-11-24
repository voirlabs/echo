"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** `redirectTo` is for the detail page: refreshing in place would leave you on
 *  a draft that no longer exists. The list just refreshes. A failed delete
 *  stays put and says so. */
export function DeleteDraftButton({ draftKey, redirectTo }: { draftKey: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(draftKey)}`, { method: "DELETE" });
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests. Wait a moment and try again." : "Couldn't delete it. Try again.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: "var(--danger)" }}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-btn danger"
        style={{ minHeight: 40, minWidth: 40 }}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
    </span>
  );
}
