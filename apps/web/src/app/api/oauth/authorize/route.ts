import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { issueCode, redirectWith, validateAuthorizeRequest } from "@/lib/oauth";

// The consent form posts here. Session-authed (and same-origin enforced by the
// proxy's CSRF check). Re-validates the whole request, then sends the user back
// to the client with a one-time code, or with access_denied.

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a form submission." }, { status: 400 });
  const q = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") q.set(k, v);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`, req.url), 303);
  }

  const v = await validateAuthorizeRequest(q);
  if (!v.ok) return NextResponse.json({ error: v.show }, { status: 400 });
  const r = v.req;

  if (q.get("decision") !== "allow") {
    return NextResponse.redirect(
      redirectWith(r.redirectUri, { error: "access_denied", error_description: "The user declined.", state: r.state }),
      303,
    );
  }

  const code = await issueCode({
    clientId: r.clientId,
    userId: session.user.id,
    redirectUri: r.redirectUri,
    codeChallenge: r.codeChallenge,
    scope: r.scope,
    resource: r.resource,
  });
  return NextResponse.redirect(redirectWith(r.redirectUri, { code, state: r.state }), 303);
}
