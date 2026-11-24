import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { draftTarget } from "@/lib/draft-key";
import { normalizeQuestions } from "@/lib/draft-questions";

const MAX_TITLE = 300;
const MAX_BRIEF = 20_000;

type DraftInput = {
  /** Update this draft instead of saving a new one. */
  key?: string;
  url?: string | null;
  title: string;
  brief?: string;
  text: string;
  /** Leave undefined to keep the stored questions on an update. */
  questions?: unknown;
};

type SaveResult = { ok: true; key: string } | { ok: false; error: string; notFound?: boolean };

/**
 * Save a draft. With `key`, the user's existing draft is updated; otherwise a
 * new draft is created, stored with its link (if any).
 */
export async function saveDraft(userId: string, input: DraftInput): Promise<SaveResult> {
  const title = input.title.trim().slice(0, MAX_TITLE);
  const brief = (input.brief ?? "").slice(0, MAX_BRIEF);
  const questions = input.questions === undefined
    ? {}
    : { questions: normalizeQuestions(input.questions) as unknown as Prisma.InputJsonValue };

  if (input.key) {
    const existing = await prisma.draft.findUnique({ where: { userId_key: { userId, key: input.key } }, select: { url: true } });
    if (!existing) return { ok: false, notFound: true, error: "That draft doesn't exist. Save without a key to create a new one." };
    await prisma.draft.update({
      where: { userId_key: { userId, key: input.key } },
      data: { text: input.text, ...(title && { title }), ...(brief && { brief }), ...questions },
    });
    return { ok: true, key: input.key };
  }

  const target = draftTarget(input.url);
  if (!target) return { ok: false, error: "That link isn't a web address (http or https)." };
  const data = { url: target.url, title, brief, text: input.text, ...questions };
  await prisma.draft.upsert({
    where: { userId_key: { userId, key: target.key } },
    create: { userId, key: target.key, ...data },
    update: data,
  });
  return { ok: true, key: target.key };
}
