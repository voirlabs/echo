import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { MCP_RESOURCE } from "@/lib/oauth";
import OnboardingSetup from "./_setup";

export const metadata: Metadata = { title: "Set up" };

// Onboarding sits outside the (app) group, so it repeats that layout's sign-in check.
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/");

  return <OnboardingSetup mcpUrl={MCP_RESOURCE} />;
}
