import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cors, guarded } from "../_cors";

// Sign-in status for the extension. Always 200 so it can read { signedIn }.
// The CORS allowlist means no other site can read who is signed in.

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export const GET = guarded("session", "Couldn't check your sign-in. Please try again.", async (req) => {
  const signedIn = Boolean((await auth())?.user?.id);
  return NextResponse.json({ signedIn }, { status: 200, headers: cors(req) });
});
