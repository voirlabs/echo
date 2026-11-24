import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createPageRequest } from "@/lib/page-requests";
import { cors, jsonCors as json, guarded } from "../_cors";

// POST: the extension asks for a page to be drafted. It sends what it scanned
// (the page's text and fields) when the user copies the prompt; the user's
// assistant then fetches the request by its key over MCP.

const Body = z.object({
  url: z.string().max(2000),
  title: z.string().max(300).default(""),
  pageText: z.string().max(40_000).default(""),
  fields: z.array(z.unknown()).max(60).default([]),
});

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export const POST = guarded("requests", "Couldn't save this page for your assistant. Please try again.", async (req) => {
  const userId = (await auth())?.user?.id;
  if (!userId) return json(req, { error: "Sign in first." }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
  const created = await createPageRequest(userId, parsed.data);
  if (!created.ok) return json(req, { error: created.error }, 400);
  return json(req, { key: created.key });
});
