"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Sign-in, export and data deletion for the one owner of this instance.
export function AccountSection() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmed = confirmText.trim().toLowerCase() === "delete";

  async function deleteData(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setError("Couldn't delete your data. Try again.");
      return;
    }
    router.push("/onboarding");
  }

  function cancel() {
    setConfirming(false);
    setConfirmText("");
    setError(null);
  }

  return (
    <section className="card account" aria-labelledby="account-heading">
      <h2 className="section-title" id="account-heading">Account</h2>

      <div className="account-row">
        <div>
          <div className="account-name">Sign-in</div>
          <p className="account-hint">
            You sign in with ADMIN_PASSWORD, set on the server. Signing out signs out every device.
          </p>
        </div>
      </div>

      <div className="account-row">
        <div>
          <div className="account-name">Your data</div>
          <p className="account-hint">Download your profile or your drafts.</p>
        </div>
        <div className="account-actions">
          <a className="btn ghost small" href="/profile/export">Profile</a>
          <a className="btn ghost small" href="/drafts/export">Drafts</a>
        </div>
      </div>

      <div className="account-row">
        <div>
          <div className="account-name">Delete all data</div>
          <p className="account-hint">Your profile, writing samples, drafts and connected assistants. Setup starts again.</p>
        </div>
        {!confirming && (
          <button type="button" className="btn danger small" onClick={() => setConfirming(true)}>
            Delete all data…
          </button>
        )}
      </div>

      {confirming && (
        <form className="danger-zone" onSubmit={deleteData}>
          <p className="danger-zone-lead">
            <strong>This can&apos;t be undone.</strong> If you want a copy, download your profile and drafts first.
          </p>
          <label htmlFor="delete-confirm" className="danger-zone-label">
            Type <strong>delete</strong> to confirm
          </label>
          <div className="danger-zone-row">
            <input
              id="delete-confirm"
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button type="submit" className="btn danger-fill" disabled={busy || !confirmed}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
            <button type="button" className="btn ghost" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <p role="alert" className="msg error danger-zone-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
