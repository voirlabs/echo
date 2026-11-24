import { APP_NAME, OPERATOR_NAME, PRIVACY_URL, REPO_URL, SUPPORT_EMAIL, TERMS_URL } from "@/lib/site";
import { ByVoirLabs } from "./logo";

// Operator, legal links and the Voir Labs endorsement under the app and auth
// pages. In the app it lines up with the page content; on auth and onboarding
// it is centred. Links show only when configured (lib/site.ts).
export function LegalFooter({ align = "center" }: { align?: "center" | "left" }) {
  const by = OPERATOR_NAME ? `${APP_NAME}, run by ${OPERATOR_NAME}.` : "";
  return (
    <footer className={`legal-footer${align === "left" ? " in-app" : ""}`} aria-label="About this app">
      {by && <span>{by}</span>}
      <nav aria-label="Legal and source">
        {TERMS_URL && <a href={TERMS_URL}>Terms</a>}
        {PRIVACY_URL && <a href={PRIVACY_URL}>Privacy</a>}
        {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>}
        <a href={REPO_URL}>Source on GitHub</a>
        <ByVoirLabs />
      </nav>
    </footer>
  );
}
