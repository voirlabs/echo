import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

// Small helpers for the session-authed JSON routes under /api/user and /api/drafts.

export const unauthorized = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });

/** The signed-in user's id, or null. */
export async function sessionUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

/** Parse a JSON body against a schema: the data, or a 400 response to return. */
export async function parseJson<T extends z.ZodType>(
  req: NextRequest,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return { data: parsed.data };
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return { error: NextResponse.json({ error: `${where}${issue?.message ?? "Invalid request"}` }, { status: 400 }) };
}
