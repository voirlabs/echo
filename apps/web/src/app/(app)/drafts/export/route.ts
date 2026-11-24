import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionUserId, unauthorized } from "@/lib/api";
import { normalizeQuestions } from "@/lib/draft-questions";
import { makeZip, type ZipFile } from "@/lib/zip";

// Every saved draft as a ZIP of Markdown files in a drafts/ folder, newest first.

// UTF-8 byte-order mark, so editors don't mis-decode emoji as Windows-1252.
const BOM = "﻿";

/** A portable filename slug; the index prefix keeps names unique. */
function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "draft";
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const drafts = await prisma.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { title: true, url: true, text: true, questions: true, updatedAt: true },
  });

  const files: ZipFile[] = drafts.map((d, i) => {
    const md = [`# ${d.title || "Untitled draft"}`, "", `**Updated:** ${d.updatedAt.toISOString().slice(0, 10)}`];
    if (d.url) md.push("", `**Link:** <${d.url}>`);
    md.push("", "## Draft", "", d.text.trim() || "_(empty)_");
    const questions = normalizeQuestions(d.questions);
    if (questions.length > 0) {
      md.push("", "## Questions", "");
      for (const q of questions) md.push(`### ${q.question}`, "", q.answer.trim() || "_(unanswered)_", "");
    }
    const n = String(i + 1).padStart(2, "0");
    return { name: `drafts/${n}-${slug(d.title)}.md`, content: `${BOM}${md.join("\n").trimEnd()}\n` };
  });
  if (files.length === 0) files.push({ name: "drafts/README.md", content: `${BOM}# No drafts yet\n` });

  const zip = makeZip(files);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="drafts-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
      "Content-Length": String(zip.length),
    },
  });
}
