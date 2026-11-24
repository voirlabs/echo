import { prisma } from "@/lib/db";
import { MAX_ENTRY_DETAILS, MAX_ENTRY_TITLE } from "@/lib/profile-shape";

// The profile's entries are kept by the user's assistant over MCP: a role, a
// project, a result, a credential. Saving an entry with the title of one that
// exists updates it, so the same fact isn't stored twice.

const MAX_ENTRIES = 100;

type EntryResult =
  | { ok: true; entry: { id: string; title: string; details: string }; updated: boolean }
  | { ok: false; error: string };

const SELECT = { id: true, title: true, details: true } as const;

export async function saveEntry(userId: string, input: { id?: string; title: string; details?: string }): Promise<EntryResult> {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, MAX_ENTRY_TITLE);
  const details = (input.details ?? "").trim().slice(0, MAX_ENTRY_DETAILS);
  if (!title) return { ok: false, error: "An entry needs a title." };

  const existing = input.id
    ? await prisma.profileEntry.findFirst({ where: { id: input.id, userId }, select: { id: true } })
    : await prisma.profileEntry.findFirst({ where: { userId, title: { equals: title, mode: "insensitive" } }, select: { id: true } });
  if (input.id && !existing) return { ok: false, error: "That entry no longer exists. Save it without an entry_id." };
  if (existing) {
    const entry = await prisma.profileEntry.update({ where: { id: existing.id }, data: { title, details }, select: SELECT });
    return { ok: true, entry, updated: true };
  }
  if ((await prisma.profileEntry.count({ where: { userId } })) >= MAX_ENTRIES) {
    return { ok: false, error: `The profile is full (${MAX_ENTRIES} entries). Remove one first.` };
  }
  const entry = await prisma.profileEntry.create({ data: { userId, title, details }, select: SELECT });
  return { ok: true, entry, updated: false };
}

export async function removeEntry(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.profileEntry.deleteMany({ where: { id, userId } });
  return count > 0;
}
