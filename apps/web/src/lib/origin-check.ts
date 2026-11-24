// The CSRF check for cookie-authenticated API routes, on top of SameSite=Lax. A
// cross-origin state-changing request always carries an Origin header, so it is
// rejected when it names another host. The browser extension may POST to
// /api/extension/*: a website can't send a chrome-extension:// Origin. With
// EXTENSION_IDS set, only those extensions may, and any other extension is refused
// on /api/extension/* altogether.

/** EXTENSION_IDS: the extension ids allowed to call /api/extension/*, or null for any. */
export function allowedExtensionIds(raw = process.env.EXTENSION_IDS): Set<string> | null {
  const ids = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

const COOKIE_AUTHED = ["/api/auth", "/api/user", "/api/drafts", "/api/extension"];

/** Why the request is refused, or null when it may go on. */
export function originProblem(r: {
  method: string;
  pathname: string;
  origin: string | null;
  host: string | null;
  extensionIds: Set<string> | null;
}): string | null {
  const method = r.method.toUpperCase();
  const extensionRoute = r.pathname.startsWith("/api/extension/");
  let url: URL | null = null;
  if (r.origin) {
    try {
      url = new URL(r.origin);
    } catch {
      url = null;
    }
  }
  const extension = url?.protocol === "chrome-extension:" ? url.host : null;
  if (extensionRoute && extension && r.extensionIds && !r.extensionIds.has(extension)) return "This extension isn't allowed here";

  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const cookieAuthed = COOKIE_AUTHED.some((p) => r.pathname.startsWith(p)) || r.pathname === "/api/oauth/authorize";
  if (!isMutation || !cookieAuthed || !r.origin) return null;
  if (!url) return "Bad origin";
  if (extension && extensionRoute && method === "POST") return null;
  return url.host === r.host && url.protocol !== "chrome-extension:" ? null : "Cross-origin request rejected";
}
