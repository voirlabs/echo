import { APP_NAME } from "@/lib/site";
import { CopyButton } from "@/components/copy-field";

/** What the user pastes into Claude or ChatGPT to have it interview them and fill in the profile. */
const PROFILE_PROMPT =
  `Use ${APP_NAME} to build my profile. First check what's already saved. Then interview me, a few questions at a time: ` +
  `who I am and what I do, my roles, projects, results, credentials and clients, and anything else worth citing when you write for me. ` +
  `Save my name and a short summary, and each fact as its own profile entry. ` +
  `Then ask me to paste a few things I've written, like emails, messages or posts, and save each as a writing sample.`;

/** A copyable prompt that has the user's assistant build (or extend) the profile in one chat. */
export function BuildSection({ empty }: { empty: boolean }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h2 className="section-title">{empty ? "Build your profile" : "Add to your profile"}</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Copy this prompt into Claude or ChatGPT. Your assistant asks about you and saves the answers here.
          </p>
        </div>
        <CopyButton value={PROFILE_PROMPT} label="Copy prompt" />
      </div>
      <p
        style={{
          margin: 0,
          padding: "16px 20px",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text)",
        }}
      >
        {PROFILE_PROMPT}
      </p>
    </div>
  );
}
