import { APP_NAME } from "@/lib/site";
import { CopyField } from "./copy-field";

// How to connect the MCP server in Claude or ChatGPT, for the Connect page. Server-safe: no hooks.

/** What a connected assistant can do, listed on the consent screen. */
export const ASSISTANT_ACCESS = [
  "Read your profile and writing samples, to write in your voice",
  "Keep your profile up to date: your name, a short summary, facts you mention and text you share as samples",
  "Check drafts against your writing style, and keep your style guide up to date",
  `Save drafts to your ${APP_NAME} account`,
];

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((body, i) => (
        <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span
            aria-hidden
            style={{ flexShrink: 0, width: 16, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7, color: "var(--faint)" }}
          >
            {i + 1}
          </span>
          <span style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{body}</span>
        </li>
      ))}
    </ol>
  );
}

const strong: React.CSSProperties = { color: "var(--text)", fontWeight: 500 };

/** The server address plus per-assistant steps. */
export function AssistantSetup({ mcpUrl, headingLevel = 2 }: { mcpUrl: string; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const head: React.CSSProperties = { fontSize: 17, fontWeight: 500, color: "var(--text)", margin: "0 0 16px" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="card" aria-labelledby="mcp-url">
        <H id="mcp-url" style={head}>Server address</H>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
          You paste this into your assistant once. It asks you to sign in to {APP_NAME} and allow access.
        </p>
        <CopyField value={mcpUrl} label={`${APP_NAME} server address`} />
      </section>

      <div className="connect-grid">
        <section className="card" aria-labelledby="setup-claude">
          <H id="setup-claude" style={head}>In Claude</H>
          <Steps
            items={[
              <>Open <span style={strong}>Settings</span>, then <span style={strong}>Connectors</span>.</>,
              <>Choose <span style={strong}>Add custom connector</span>. Name it {APP_NAME} and paste the server address.</>,
              <>Choose <span style={strong}>Connect</span>, sign in to {APP_NAME} and select <span style={strong}>Allow</span>.</>,
              <>In a chat, check that {APP_NAME} is turned on in the tools menu.</>,
            ]}
          />
        </section>

        <section className="card" aria-labelledby="setup-chatgpt">
          <H id="setup-chatgpt" style={head}>In ChatGPT</H>
          <Steps
            items={[
              <>Open <span style={strong}>Settings</span>, then <span style={strong}>Apps</span>. Under advanced settings, turn on <span style={strong}>Developer mode</span>.</>,
              <>Create an app named {APP_NAME} and paste the server address. Choose OAuth if it asks how to sign in.</>,
              <>Sign in to {APP_NAME} and select <span style={strong}>Allow</span>.</>,
              <>In a new chat, pick {APP_NAME} from the tools menu.</>,
            ]}
          />
        </section>
      </div>
      <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: 0 }}>
        Menu names can differ a little between plans and app versions.
      </p>
    </div>
  );
}
