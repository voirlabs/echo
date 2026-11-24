import { randomBytes } from "node:crypto";

// Every saved draft has a random key, unique per user, used in its URL
// (/drafts/<key>). One page (a form, a thread) can hold several drafts; the
// extension shows the latest one saved for the page it's on.

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|trk$)/i;

/** Lowercase host, no fragment, no tracking params, no trailing slash. Null if not http(s). */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

type DraftTarget = { key: string; url: string };

/** The key and stored link for a new draft. Null for a link that isn't http(s). */
export function draftTarget(rawUrl: string | null | undefined): DraftTarget | null {
  const key = `d-${randomBytes(9).toString("base64url")}`;
  const raw = rawUrl?.trim();
  if (!raw) return { key, url: "" };
  const url = normalizeUrl(raw);
  return url ? { key, url } : null;
}
