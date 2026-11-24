import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, endAllSessions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-token";
import { prisma } from "@/lib/db";
import { AppNav } from "./_nav";
import { LegalFooter } from "@/components/legal-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");

  // Signing out ends every session, on every device.
  async function signOutAction() {
    "use server";
    if (await auth()) await endAllSessions();
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/login");
  }

  return (
    <div className="app-layout">
      <AppNav signOutAction={signOutAction} />
      <main className="main-content">
        {children}
        <LegalFooter align="left" />
      </main>
    </div>
  );
}
