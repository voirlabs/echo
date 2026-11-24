import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJson, sessionUserId, unauthorized } from "@/lib/api";
import { saveDraft } from "@/lib/drafts";

const Patch = z.object({
  text: z.string().trim().min(1, "The draft is empty.").max(10_000, "Keep the draft under 10,000 characters."),
});

/** Save the user's edit to a draft. Only the text changes. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { key } = await params;
  const body = await parseJson(req, Patch);
  if ("error" in body) return body.error;
  const saved = await saveDraft(userId, { key, title: "", text: body.data.text });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { key } = await params;
  const { count } = await prisma.draft.deleteMany({ where: { userId, key } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
