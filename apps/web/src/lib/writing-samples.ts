import { prisma } from "@/lib/db";

// The user's own writing, which their style is measured and learned from. Added
// from a saved draft's page ("Add as writing sample") or by the assistant
// (add_writing_sample), and removed on the Profile page.

export const MAX_SAMPLES = 30;
const MAX_SAMPLE_LEN = 10_000;
const MAX_LABEL_LEN = 120;

type AddResult =
  | { ok: true; sample: { id: number; label: string | null; text: string; createdAt: Date }; duplicate: boolean }
  | { ok: false; error: string };

/** Add a writing sample. Idempotent on exact text. */
export async function addWritingSample(userId: string, rawText: string, rawLabel?: string | null): Promise<AddResult> {
  const text = rawText.trim();
  const label = (rawLabel ?? "").trim().slice(0, MAX_LABEL_LEN) || null;
  if (!text) return { ok: false, error: "Paste some text to add." };
  if (text.length > MAX_SAMPLE_LEN) {
    return { ok: false, error: `Keep samples under ${MAX_SAMPLE_LEN.toLocaleString()} characters.` };
  }
  const select = { id: true, label: true, text: true, createdAt: true } as const;
  const existing = await prisma.writingSample.findFirst({ where: { userId, text }, select });
  if (existing) return { ok: true, sample: existing, duplicate: true };

  const count = await prisma.writingSample.count({ where: { userId } });
  if (count >= MAX_SAMPLES) {
    return { ok: false, error: `You already have ${MAX_SAMPLES} writing samples. Remove one under Profile, Writing samples first.` };
  }
  const sample = await prisma.writingSample.create({ data: { userId, text, label }, select });
  return { ok: true, sample, duplicate: false };
}

/** Remove a sample. The style guide was built partly from it, so it is cleared
 *  and every remaining sample is marked unlearned: the next style task rebuilds
 *  the guide from what's left. */
export async function deleteWritingSample(userId: string, id: number): Promise<boolean> {
  const { count } = await prisma.writingSample.deleteMany({ where: { id, userId } });
  if (count === 0) return false;
  await prisma.$transaction([
    prisma.writingSample.updateMany({ where: { userId }, data: { learnedAt: null } }),
    prisma.user.update({ where: { id: userId }, data: { writingStyle: null } }),
  ]);
  return true;
}
