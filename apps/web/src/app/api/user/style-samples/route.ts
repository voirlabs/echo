import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, sessionUserId, unauthorized } from "@/lib/api";
import { addWritingSample, deleteWritingSample } from "@/lib/writing-samples";

// The user's writing samples: removed from the Profile page, added from a saved
// draft's page.

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await parseJson(req, z.object({ text: z.string().max(20_000), label: z.string().max(500).optional() }));
  if ("error" in body) return body.error;
  const res = await addWritingSample(userId, body.data.text, body.data.label);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ sample: res.sample, duplicate: res.duplicate });
}

export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await parseJson(req, z.object({ id: z.number().int() }));
  if ("error" in body) return body.error;
  if (!(await deleteWritingSample(userId, body.data.id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
