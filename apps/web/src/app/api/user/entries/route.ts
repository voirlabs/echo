import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJson, sessionUserId, unauthorized } from "@/lib/api";

// The profile's entries, which the user's assistant saves over MCP
// (lib/profile-entries.ts). The web app only removes them; the Profile page lists them.

export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await parseJson(req, z.object({ id: z.string().min(1).max(64) }));
  if ("error" in body) return body.error;
  await prisma.profileEntry.deleteMany({ where: { id: body.data.id, userId } });
  return NextResponse.json({ ok: true });
}
