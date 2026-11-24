import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pendingStyleTaskCount } from "@/lib/style-tasks";
import { PageHeader } from "@/components/page-header";
import { AboutSection } from "./_about";
import { BuildSection } from "./_build";
import { EntriesSection } from "./_entries";
import { WritingSamples } from "./_writing-samples";
import { Connections } from "./_connections";
import { AccountSection } from "./_account";

export const metadata: Metadata = { title: "Profile" };

// Everything your assistant writes from: who you are, what it can cite, and the
// writing samples that set your voice. Then the assistants you connected and your data.
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, tasksWaiting] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, profileText: true, writingStyle: true,
        entries: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, details: true } },
        writingSamples: { select: { id: true, label: true, text: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    pendingStyleTaskCount(userId),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="page-pad">
      <PageHeader title="Profile" description="What your assistant knows about you and how you write. It keeps this up to date as you chat; remove anything that's wrong." />

      <BuildSection empty={!user.name && !user.profileText && user.entries.length === 0 && user.writingSamples.length === 0} />

      <AboutSection name={user.name ?? ""} profileText={user.profileText ?? ""} />

      <EntriesSection initial={user.entries} />

      <div id="writing-samples" style={{ scrollMarginTop: 80 }}>
        <WritingSamples initialSamples={user.writingSamples} guide={{ built: Boolean(user.writingStyle), tasksWaiting }} />
      </div>

      <Connections />

      <AccountSection />
    </div>
  );
}
