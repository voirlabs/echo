import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionUserId, unauthorized } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { DEVICE_COOKIE } from "@/lib/session-token";

// Deletes everything the owner has saved (it all cascades from the owner row).
// The new owner row has a new session epoch, so this browser gets a fresh session:
// the owner stays signed in here and starts again from onboarding.
export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  await prisma.user.delete({ where: { id: userId } });
  const res = NextResponse.json({ ok: true });
  await startSession(res, req.cookies.get(DEVICE_COOKIE)?.value);
  return res;
}
