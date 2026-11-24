import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/draft-key";
import { normalizeFields } from "@/lib/page-fields";
import { cors, jsonCors as json, guarded } from "../_cors";

// The extension's draft for the page in ?url=: the latest one saved for it, or
// null. The extension only reads; drafts are written over MCP.

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export const GET = guarded("drafts", "Couldn't load the draft for this page. Please try again.", async (req) => {
  const userId = (await auth())?.user?.id;
  if (!userId) return json(req, { error: "Sign in first." }, 401);

  const pageUrl = normalizeUrl(req.nextUrl.searchParams.get("url") ?? "");
  const row = pageUrl
    ? await prisma.draft.findFirst({
        where: { userId, url: pageUrl },
        orderBy: { updatedAt: "desc" },
        select: { key: true, title: true, text: true, status: true, fields: true },
      })
    : null;
  const draft = row && {
    key: row.key,
    title: row.title || "Untitled draft",
    text: row.text,
    status: row.status,
    fields: normalizeFields(row.fields).map(({ id, label, selector, value }) => ({ id, label, selector, value })),
  };
  return json(req, { draft });
});
