import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Download the user's profile as one Markdown file: "About you" and the
// entries, the same material drafting reads.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      profileText: true,
      entries: { orderBy: { createdAt: "asc" }, select: { title: true, details: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const md: string[] = [`# ${(user.name || "Profile").trim()}`];

  md.push("", "## About", "", (user.profileText || "").trim() || "_(none yet)_");

  md.push("", "## Entries", "");
  if (user.entries.length > 0) {
    for (const e of user.entries) md.push(`### ${e.title.trim()}`, "", e.details.trim() || "_(no details)_", "");
  } else {
    md.push("_(none yet)_", "");
  }

  // Lead with a UTF-8 BOM and emit the body as encoded UTF-8 bytes. Profiles often
  // contain emoji and styled Unicode (e.g. 𝗕𝗢𝗟𝗗 headings); without the BOM some
  // editors open the .md as Windows-1252 and every multi-byte character turns to
  // mojibake ("🤖" → "ðŸ¤–").
  const BOM = "\uFEFF";
  const content = `${BOM}${md.join("\n").trimEnd()}\n`;
  const filename = `profile-${new Date().toISOString().slice(0, 10)}.md`;
  const body = new TextEncoder().encode(content);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(body.length),
    },
  });
}
