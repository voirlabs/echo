import { APP_URL } from "./site";

// The owner's sign-in session: a cookie holding the owner's session epoch and an
// expiry, signed with HMAC-SHA256. Web Crypto only, so the proxy and the route
// handlers share it. The key comes from SESSION_SECRET and ADMIN_PASSWORD together,
// so changing either signs everyone out; signing out changes the epoch on the owner
// row (lib/auth.ts), which does the same.

export const SESSION_COOKIE = "echo_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Remembers a browser that signed in before, so failed guesses elsewhere can't lock it out. */
export const DEVICE_COOKIE = "echo_device";
export const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const MIN_PASSWORD_LENGTH = 12;

const encoder = new TextEncoder();

const read = (name: string) => process.env[name]?.trim() || null;

/** ADMIN_PASSWORD, or null when it is missing or too short to be safe. */
function adminPassword(): string | null {
  const password = read("ADMIN_PASSWORD");
  return password && password.length >= MIN_PASSWORD_LENGTH ? password : null;
}

/** SESSION_SECRET, or null when it is missing or too short to be safe. */
function sessionSecret(): string | null {
  const secret = read("SESSION_SECRET");
  return secret && secret.length >= 32 ? secret : null;
}

/** What's missing before anyone can sign in, for the login page. */
export function setupProblem(): string | null {
  if (!read("ADMIN_PASSWORD")) return "Set ADMIN_PASSWORD in the server's environment and restart, then sign in with it.";
  if (!adminPassword()) {
    return `ADMIN_PASSWORD is too short. Use at least ${MIN_PASSWORD_LENGTH} characters (generate one with: openssl rand -base64 18) and restart.`;
  }
  if (!sessionSecret()) return "Set SESSION_SECRET in the server's environment (at least 32 characters; generate one with: openssl rand -hex 32) and restart.";
  return null;
}

async function key(): Promise<CryptoKey | null> {
  const password = adminPassword();
  const secret = sessionSecret();
  if (!password || !secret) return null;
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`echo-session/v1:${secret}:${password}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(payload: string): Promise<string | null> {
  const k = await key();
  if (!k) return null;
  return `${payload}.${toBase64Url(await crypto.subtle.sign("HMAC", k, encoder.encode(payload)))}`;
}

/** The payload of a token this server signed, or null. */
async function verified(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = fromBase64Url(token.slice(dot + 1));
  const k = await key();
  if (!sig || !k) return null;
  return (await crypto.subtle.verify("HMAC", k, sig, encoder.encode(payload))) ? payload : null;
}

const EPOCH = /^[A-Za-z0-9-]{1,64}$/;

/** A session for the owner's current epoch (users.session_epoch). */
export async function createSessionToken(epoch: string, now = Date.now()): Promise<string | null> {
  if (!EPOCH.test(epoch)) return null;
  return sign(`v2.${epoch}.${now + SESSION_MAX_AGE_SECONDS * 1000}`);
}

/**
 * The epoch a session token was issued for, or null when it is unsigned, tampered
 * with or expired. The caller compares the epoch with the owner row; the proxy,
 * which only gates pages that check it again, trusts the signature alone.
 */
export async function readSessionToken(token: string | undefined | null, now = Date.now()): Promise<string | null> {
  const payload = await verified(token);
  const [version, epoch, expires, ...rest] = payload?.split(".") ?? [];
  if (version !== "v2" || !epoch || !EPOCH.test(epoch) || !expires || rest.length) return null;
  if (!Number.isFinite(Number(expires)) || Number(expires) <= now) return null;
  return epoch;
}

/** A random id for this browser, signed so it can't be made up. */
export async function createDeviceToken(): Promise<string | null> {
  return sign(`d1.${crypto.randomUUID()}`);
}

/** The id in a device token this server signed, or null. */
export async function readDeviceToken(token: string | undefined | null): Promise<string | null> {
  const [version, id, ...rest] = (await verified(token))?.split(".") ?? [];
  return version === "d1" && id && !rest.length ? id : null;
}

/**
 * Cookie settings for the session and device cookies. Secure follows the app's
 * public URL, not a request header a client could set: a Secure cookie is dropped
 * on plain http (a LAN address), which would send the owner back to the login page.
 */
export function cookieOptions(maxAge: number, path = "/") {
  return { httpOnly: true, secure: APP_URL.startsWith("https://"), sameSite: "lax" as const, path, maxAge };
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD (compares digests). */
export async function passwordMatches(input: string): Promise<boolean> {
  const expected = adminPassword();
  if (!expected) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
