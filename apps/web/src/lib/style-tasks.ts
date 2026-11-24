import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  buildSampleAnalysisPrompt, buildStyleMergePrompt, buildStyleSynthesisPrompt, MAX_STYLE_LEN, parseStyleGuide,
} from "@/lib/writing-prompts";
import { computeStyleMetrics, renderMetricsBlock, styleProse } from "@/lib/writing-style";

// Style learning, run by the user's assistant over MCP. There is no queue: the
// work is read off the samples each time.
//   note:<sampleId>   a sample without voice notes yet: the assistant writes them
//   guide:<epoch ms>:<fingerprint>
//                     notes not yet folded into the style guide: the assistant
//                     writes the guide (from scratch, or merged into the current one)
// The guide task is offered once every sample has notes. Its id records when it
// was handed out, so applying it marks exactly the notes it was built from, and
// a fingerprint of the samples that existed then: if one was deleted meanwhile,
// the answer still carries its voice and is refused.

const MAX_TASKS = 3;
const MAX_NOTES_LEN = 2000;
// Cap on how many notes feed one guide build, so a big pool can't balloon the prompt.
const MAX_GUIDE_NOTES = 30;

type StyleTask = { task_id: string; what: string; prompt: string };

/** A short fingerprint of a set of sample ids. */
function fingerprint(ids: number[]): string {
  const sorted = [...ids].sort((a, b) => a - b).join(",");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

/** A reason an answer can't be applied, worded for the user or their assistant. */
export class StyleTaskError extends Error {}

async function guideTask(userId: string): Promise<StyleTask | null> {
  const [samples, user] = await Promise.all([
    prisma.writingSample.findMany({ where: { userId, notes: { not: null } }, select: { id: true, notes: true, learnedAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { writingStyle: true } }),
  ]);
  const fresh = samples.filter((s) => !s.learnedAt);
  if (fresh.length === 0) return null;
  const existingGuide = styleProse(user?.writingStyle);
  const notes = (existingGuide ? fresh : samples).slice(-MAX_GUIDE_NOTES).map((s) => s.notes!);
  return {
    task_id: `guide:${Date.now()}:${fingerprint(samples.map((s) => s.id))}`,
    what: "Update your writing style guide",
    prompt: existingGuide ? buildStyleMergePrompt({ existingGuide, notes }) : buildStyleSynthesisPrompt(notes),
  };
}

/** Up to three tasks: sample notes first, then the guide. */
export async function listStyleTasks(userId: string): Promise<{ tasks: StyleTask[]; remaining: number }> {
  const unnoted = await prisma.writingSample.findMany({
    where: { userId, notes: null },
    select: { id: true, text: true },
    orderBy: { createdAt: "asc" },
  });
  const tasks: StyleTask[] = unnoted.slice(0, MAX_TASKS).map((s) => ({
    task_id: `note:${s.id}`,
    what: "Analyse a writing sample",
    prompt: buildSampleAnalysisPrompt(s.text),
  }));
  if (unnoted.length === 0) {
    const guide = await guideTask(userId);
    if (guide) tasks.push(guide);
  }
  const remaining = Math.max(0, unnoted.length - tasks.length) + (unnoted.length > 0 ? 1 : 0);
  return { tasks, remaining };
}

/** How many tasks are waiting: unanalysed samples, plus one if the guide is behind. */
export async function pendingStyleTaskCount(userId: string): Promise<number> {
  const [unnoted, unlearned] = await Promise.all([
    prisma.writingSample.count({ where: { userId, notes: null } }),
    prisma.writingSample.count({ where: { userId, learnedAt: null } }),
  ]);
  return unnoted + (unlearned > 0 ? 1 : 0);
}

/** Apply the assistant's answer to one task. Throws with a readable reason when
 *  the task is unknown or the answer unusable, so the assistant can retry. */
export async function applyStyleTaskResult(userId: string, taskId: string, result: string): Promise<void> {
  const text = result.trim();
  if (!text) throw new StyleTaskError("The answer is empty.");
  const [kind, arg, print] = taskId.split(":");

  if (kind === "note" && /^\d+$/.test(arg ?? "")) {
    const { count } = await prisma.writingSample.updateMany({
      where: { id: Number(arg), userId },
      data: { notes: text.slice(0, MAX_NOTES_LEN), notedAt: new Date() },
    });
    if (count === 0) throw new StyleTaskError("That writing sample no longer exists.");
    return;
  }

  if (kind === "guide" && /^\d+$/.test(arg ?? "") && print) {
    const guide = parseStyleGuide(text);
    if (!guide) throw new StyleTaskError("The style guide is empty.");
    const handedOutAt = new Date(Number(arg));
    const samples = await prisma.writingSample.findMany({ where: { userId }, select: { id: true, text: true, notedAt: true } });
    // The samples the task was built from are the ones noted by then. If that
    // set changed, one was deleted and the answer would bring its voice back.
    const builtFrom = samples.filter((s) => s.notedAt && s.notedAt <= handedOutAt).map((s) => s.id);
    if (fingerprint(builtFrom) !== print) {
      throw new StyleTaskError("A writing sample was removed since this task was handed out. Get the current style tasks and try again.");
    }
    // The measured block is recomputed from every sample; the model only writes prose.
    const metrics = computeStyleMetrics(samples.map((s) => s.text));
    const metricsBlock = metrics ? renderMetricsBlock(metrics) : "";
    const prose = metricsBlock ? guide.slice(0, Math.max(0, MAX_STYLE_LEN - metricsBlock.length - 2)) : guide;
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { writingStyle: [prose, metricsBlock].filter(Boolean).join("\n\n") } }),
      prisma.writingSample.updateMany({
        where: { userId, learnedAt: null, notedAt: { lte: handedOutAt } },
        data: { learnedAt: new Date() },
      }),
    ]);
    return;
  }

  throw new StyleTaskError("Unknown task. Get the current style tasks and try again.");
}
