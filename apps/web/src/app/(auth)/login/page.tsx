import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { setupProblem } from "@/lib/session-token";
import { LoginForm } from "./_form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  // Already signed in (for example back from the consent screen's sign-in link): go on.
  if ((await auth())?.user?.id) redirect(next);
  return <LoginForm next={next} setupProblem={setupProblem()} />;
}
