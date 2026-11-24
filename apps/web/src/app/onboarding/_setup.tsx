"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "@/components/copy-field";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/site";

// One step: connect Claude or ChatGPT. The assistant fills in the profile as the
// user chats, so there is nothing to type here. Finishing sets onboardingCompleted
// first, because the (app) layout sends anyone whose flag is still false back here.

export default function OnboardingSetup({ mcpUrl }: { mcpUrl: string }) {
  const router = useRouter();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On success `finishing` stays set: the button keeps its busy label until the
  // browser leaves the page.
  async function finish() {
    setFinishing(true);
    setError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true }),
    }).catch(() => null);
    if (res?.ok) {
      router.push("/drafts");
      router.refresh();
      return;
    }
    const d = (await res?.json().catch(() => null)) as { error?: string } | null;
    setError(res ? (d?.error ?? "Couldn't save just now. Try again.") : "Couldn't reach the server. Check your connection and try again.");
    setFinishing(false);
  }

  return (
    <div className="onboarding">
      <header className="rule-b status-bar">
        <Logo size={26} />
      </header>

      <div className="onboarding-body">
        <main className="onboarding-main">
          <h1 className="display">
            Connect <em>your assistant</em>
          </h1>
          <p className="onboarding-lead">
            Drafts are written by your own Claude or ChatGPT. Add {APP_NAME} there once with the address below. As you
            chat, it learns how you write and what you&apos;ve done, and saves your drafts here.
          </p>

          <div className="card onboarding-card">
            <div className="onboarding-label">Server address</div>
            <CopyField value={mcpUrl} label={`${APP_NAME} server address`} />
          </div>

          <ol className="onboarding-steps">
            <li><strong>Claude:</strong> Settings, Connectors, Add custom connector, then paste the address.</li>
            <li><strong>ChatGPT:</strong> turn on developer mode, then add it as an app with the same address.</li>
            <li>To use a saved draft, the {APP_NAME} extension fills it into the page.</li>
          </ol>

          {error && <div role="alert" className="msg error onboarding-error">{error}</div>}

          <div className="onboarding-actions">
            <button type="button" className="btn" onClick={finish} disabled={finishing}>
              {finishing ? "Opening…" : "Done"}
            </button>
            <p>The Connect page in the sidebar has these steps too.</p>
          </div>
        </main>
      </div>
      <LegalFooter />
    </div>
  );
}
