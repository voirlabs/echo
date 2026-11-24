import { prisma } from "@/lib/db";

/** Set the owner's name and "About you" (update_about_me over MCP). Undefined leaves a value as it is. */
export async function updateProfile(userId: string, patch: { name?: string; profileText?: string }): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined && { name: patch.name.trim() || null }),
      ...(patch.profileText !== undefined && { profileText: patch.profileText.trim() || null }),
    },
  });
}
