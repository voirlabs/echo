import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "./db";
import {
  cookieOptions,
  createDeviceToken,
  createSessionToken,
  readDeviceToken,
  readSessionToken,
  DEVICE_COOKIE,
  DEVICE_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session-token";

// Echo has one owner. They sign in with ADMIN_PASSWORD (lib/session-token.ts), and
// everything they keep (profile, samples, drafts, assistant connections) belongs
// to a single user row with this id, created the first time it's needed.
export const OWNER_ID = "owner";

/**
 * Creates the owner's row if it doesn't exist (first sign-in, or after "Delete all
 * data"). One INSERT ... ON CONFLICT DO NOTHING, so it is safe on every request and
 * never trusts an in-memory flag that a deleted row could make stale.
 */
async function ensureOwner(): Promise<void> {
  await prisma.user.createMany({ data: [{ id: OWNER_ID }], skipDuplicates: true });
}

async function ownerEpoch(): Promise<string | null> {
  await ensureOwner();
  return (await prisma.user.findUnique({ where: { id: OWNER_ID }, select: { sessionEpoch: true } }))?.sessionEpoch ?? null;
}

/** The signed-in owner, or null. A session from before the last sign-out doesn't count. */
export async function auth(): Promise<{ user: { id: string } } | null> {
  const epoch = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!epoch || epoch !== (await ownerEpoch())) return null;
  return { user: { id: OWNER_ID } };
}

/**
 * Sign the owner in on this response: a session cookie for the current epoch, and
 * a device cookie so this browser keeps its own sign-in attempts (lib/login-throttle.ts).
 * False when sign-in isn't set up.
 */
export async function startSession(res: NextResponse, deviceToken: string | undefined): Promise<boolean> {
  const epoch = await ownerEpoch();
  const token = epoch ? await createSessionToken(epoch) : null;
  if (!token) return false;
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
  if (!(await readDeviceToken(deviceToken))) {
    const device = await createDeviceToken();
    if (device) res.cookies.set(DEVICE_COOKIE, device, cookieOptions(DEVICE_MAX_AGE_SECONDS, "/api/auth"));
  }
  return true;
}

/** Sign out every device: a new epoch makes every session cookie issued so far invalid. */
export async function endAllSessions(): Promise<void> {
  await prisma.user.updateMany({ where: { id: OWNER_ID }, data: { sessionEpoch: crypto.randomUUID() } });
}
