// Which Echo server the extension talks to. A store build has none built in, so
// the user enters their server's address on first run and grants the extension
// access to that one origin. A build made with APP_URL starts with it filled in.

/** The address stamped in at build time, or "" for a store build. */
export const BUILT_IN_URL = "__APP_URL__";

const KEY = "echo-server";

type ParsedServer = { ok: true; url: string; origin: string } | { ok: false; error: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Turn what the user typed into the server's base URL. https only, except for a
 * server on this computer; "echo.example.com" means https://echo.example.com.
 */
export function parseServerUrl(input: string): ParsedServer {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter your Echo server's address." };
  let url: URL;
  try {
    // A bare address means https, except a server on this computer, which is usually plain http.
    const scheme = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw) ? "http" : "https";
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${scheme}://${raw}`);
  } catch {
    return { ok: false, error: "That isn't a web address. Try something like echo.example.com." };
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return { ok: false, error: "Use an https address. Plain http only works for a server on this computer." };
  }
  if (url.username || url.password) return { ok: false, error: "Leave the user name and password out of the address." };
  const base = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  return { ok: true, url: base, origin: url.origin };
}

/** The permission pattern for a server: host permissions don't take a port. */
export function originPattern(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

export function hostOf(url: string): string {
  return new URL(url).host;
}

/** The server to use: the one the user connected, else the built-in one, else null. */
export async function getServerUrl(): Promise<string | null> {
  const got = await chrome.storage.local.get(KEY);
  const saved = typeof got[KEY] === "string" ? (got[KEY] as string) : "";
  return saved || BUILT_IN_URL || null;
}

export async function setServerUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [KEY]: url });
}

/** True when there is a server and the extension may reach it. */
export async function serverReady(url: string | null): Promise<boolean> {
  if (!url) return false;
  return chrome.permissions.contains({ origins: [originPattern(url)] });
}
