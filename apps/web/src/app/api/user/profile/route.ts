import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJson, sessionUserId, unauthorized } from "@/lib/api";

// Onboarding marks itself done here. The profile itself is written by the user's
// assistant over MCP (update_about_me), never from the web app.
const Patch = z.object({ onboardingCompleted: z.literal(true) });

export async function PATCH(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await parseJson(req, Patch);
  if ("error" in body) return body.error;
  await prisma.user.update({ where: { id: userId }, data: { onboardingCompleted: true } });
  return NextResponse.json({ ok: true });
}
