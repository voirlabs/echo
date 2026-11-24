import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJson, sessionUserId, unauthorized } from "@/lib/api";

// Assistants (Claude, ChatGPT, other MCP clients) connected to the user's account.
// DELETE disconnects one: every token it holds for this user is revoked at once.

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const tokens = await prisma.oAuthToken.findMany({
    // Live connections only: an assistant whose refresh token has expired is gone.
    where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    select: { clientId: true, createdAt: true, lastUsedAt: true, client: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const byClient = new Map<string, { clientId: string; name: string; connectedAt: Date; lastUsedAt: Date | null }>();
  for (const t of tokens) {
    const cur = byClient.get(t.clientId);
    if (!cur) byClient.set(t.clientId, { clientId: t.clientId, name: t.client.name, connectedAt: t.createdAt, lastUsedAt: t.lastUsedAt });
    else if (t.lastUsedAt && (!cur.lastUsedAt || t.lastUsedAt > cur.lastUsedAt)) cur.lastUsedAt = t.lastUsedAt;
  }
  return NextResponse.json({ connections: [...byClient.values()] });
}

export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await parseJson(req, z.object({ clientId: z.string().min(1) }));
  if ("error" in body) return body.error;
  await prisma.oAuthToken.updateMany({ where: { userId, clientId: body.data.clientId, revokedAt: null }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
