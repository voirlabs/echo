import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/auth";
import { parseJsonText, readBody } from "@/lib/body";
import { clientIp, trustedProxyHops } from "@/lib/client-ip";
import { beginLogin, loginSucceeded, throttleKeys } from "@/lib/login-throttle";
import { passwordMatches, readDeviceToken, DEVICE_COOKIE, setupProblem } from "@/lib/session-token";

const body = z.object({ password: z.string().min(1).max(256) });

/** Owner sign-in with ADMIN_PASSWORD, with backoff after failed attempts. */
export async function POST(req: NextRequest) {
  const problem = setupProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });

  const text = await readBody(req);
  if (text === null) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const parsed = body.safeParse(parseJsonText(text));
  if (!parsed.success) return NextResponse.json({ error: "Enter the password." }, { status: 400 });

  const deviceToken = req.cookies.get(DEVICE_COOKIE)?.value;
  const keys = throttleKeys(clientIp(req.headers, trustedProxyHops()), await readDeviceToken(deviceToken));
  const wait = beginLogin(keys);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Too many wrong passwords. Try again in ${wait < 60 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.` },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }
  if (!(await passwordMatches(parsed.data.password))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  loginSucceeded(keys);

  const res = NextResponse.json({ ok: true });
  if (!(await startSession(res, deviceToken))) return NextResponse.json({ error: "Sign-in isn't set up on the server." }, { status: 503 });
  return res;
}
