// Build the extension into dist/.
//   pnpm build                                   a store build: users enter their server on first run
//   APP_URL=https://echo.example.com pnpm build  starts with that server, already granted
// Optional: SITE_URL (the store listing's homepage, default APP_URL or the Echo
// site) and PRIVACY_URL (the privacy policy, default docs/extension-privacy.md).
import { build } from "esbuild";
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const trim = (s) => s.trim().replace(/\/+$/, "");

const appUrl = trim(process.env.APP_URL || "");
const siteUrl = trim(process.env.SITE_URL || appUrl || "https://echo.voirlabs.io");
const app = appUrl ? new URL(appUrl) : null;

// The product name and repository, in one place for the whole extension.
const APP_NAME = "Echo";
const REPO_URL = "https://github.com/voirlabs/echo";

const values = {
  __APP_NAME__: APP_NAME,
  __APP_WORDMARK__: APP_NAME.toLowerCase(),
  __REPO_URL__: REPO_URL,
  __APP_URL__: appUrl,
  __SITE_URL__: siteUrl,
  __PRIVACY_URL__: trim(process.env.PRIVACY_URL || `${REPO_URL}/blob/main/docs/extension-privacy.md`),
};

rmSync(dist, { recursive: true, force: true });
// The popup and the script it injects into a page are each bundled into one file.
await build({
  entryPoints: [join(root, "src", "popup.ts"), join(root, "src", "page.ts")],
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  logLevel: "warning",
});
for (const f of ["manifest.json", "popup.html", "popup.css", "logo.svg"]) cpSync(join(root, f), join(dist, f));
cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true });
// Urbanist (OFL), packaged so the popup matches the app without loading a remote font.
cpSync(join(root, "fonts"), join(dist, "fonts"), { recursive: true });

for (const f of readdirSync(dist)) {
  if (!/\.(js|html|json|css)$/.test(f)) continue;
  const p = join(dist, f);
  let s = readFileSync(p, "utf8");
  for (const [k, v] of Object.entries(values)) s = s.split(k).join(v);
  writeFileSync(p, s);
}
// A built-in server is granted up front; a store build asks for the user's server at runtime.
const manifestPath = join(dist, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
// Match patterns don't take a port, so permission covers the host on any port.
if (app) manifest.host_permissions = [`${app.protocol}//${app.hostname}/*`];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const left = readdirSync(dist)
  .filter((f) => /\.(js|html|json)$/.test(f))
  .filter((f) => Object.keys(values).some((k) => readFileSync(join(dist, f), "utf8").includes(k)));
if (left.length) throw new Error(`Unreplaced placeholders in ${left.join(", ")}`);
// A stamped value must never break a script's syntax.
for (const f of readdirSync(dist).filter((f) => f.endsWith(".js"))) new Script(readFileSync(join(dist, f), "utf8"), { filename: f });
console.log(appUrl ? `Built for ${appUrl}` : "Built for the store: users enter their server on first run");
