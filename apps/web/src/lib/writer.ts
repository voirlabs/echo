import { prisma } from "@/lib/db";
import { buildWritingRules, cleanDraft } from "@/lib/writing-prompts";
import { checkStyle, computeStyleMetrics, pickExemplars, type DraftKind } from "@/lib/writing-style";
import { pendingStyleTaskCount } from "@/lib/style-tasks";
import { rankByBrief } from "@/lib/relevance";

// Shared by the MCP tools (app/mcp/route.ts), for plain drafts and page requests.
// The model does the writing; these give it the user's own material and rules,
// and check its draft against the user's style.

const MAX_ITEMS = 6;
const MAX_DETAILS = 1200;

export async function writerContext(userId: string, brief: { title?: string; description: string; questions?: string[] }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, profileText: true, writingStyle: true,
      entries: { orderBy: { createdAt: "desc" }, select: { title: true, details: true } },
      writingSamples: { select: { text: true } },
    },
  });
  if (!user) throw new Error("Account not found.");
  const briefText = `${brief.title ?? ""}\n${brief.description}`;

  const material = rankByBrief(user.entries.map((e) => ({ ...e, text: `${e.title} ${e.details}` })), briefText, MAX_ITEMS)
    .map((e) => ({ title: e.title, details: e.details.slice(0, MAX_DETAILS) }));

  return {
    writer: {
      name: user.name ?? null,
      summary: (user.profileText ?? "").slice(0, 2000) || null,
    },
    relevant_material: material,
    voice_examples: pickExemplars(user.writingSamples.map((s) => s.text), 2),
    writing_rules: buildWritingRules({ writingStyle: user.writingStyle, displayName: user.name, hasEvidence: material.length > 0 }),
    questions: (brief.questions ?? []).filter(Boolean),
    profile_complete: Boolean(user.profileText || user.entries.length),
    style_tasks_waiting: await pendingStyleTaskCount(userId),
  };
}

/** Check a draft against the user's measured style. */
export async function checkDraft(userId: string, text: string, kind?: DraftKind) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, writingSamples: { select: { text: true } } },
  });
  const metrics = computeStyleMetrics((user?.writingSamples ?? []).map((s) => s.text));
  const issues = checkStyle(text, {
    kind,
    name: user?.name,
    usesEmDash: metrics?.usesEmDash ?? false,
    allowedTells: metrics?.aiTellsPresent,
    opening: metrics?.opening,
    usesLists: metrics?.usesLists ?? false,
    usesSerialLists: metrics?.usesSerialLists ?? false,
    avgWords: metrics?.avgWordsPerSample,
  });
  return {
    ok: issues.length === 0,
    issues,
    cleaned_text: cleanDraft(text, { name: user?.name, usesEmDash: metrics?.usesEmDash ?? false }),
    word_count: text.trim().split(/\s+/).filter(Boolean).length,
  };
}
