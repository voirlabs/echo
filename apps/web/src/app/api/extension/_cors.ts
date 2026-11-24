import { NextRequest, NextResponse } from "next/server";

// CORS for the extension endpoints, which are authed on the session cookie. Reflecting an
// arbitrary Origin with Allow-Credentials would let any page call them as the user and read the
// reply, so reflect only our own host and localhost in development. The extension holds
// host_permissions for the server, so its requests don't need CORS at all.

const isDev = process.env.NODE_ENV !== "production";

function isAllowedOrigin(origin: string, req: NextRequest): boolean {
  const host = req.headers.get("host");
  // Scheme included on purpose: host-only matching would also accept http://<host>.
  if (host && origin === `https://${host}`) return true;
  if (!isDev) return false;
  let devHost: string;
  try {
    devHost = new URL(origin).host;
  } catch {
    return false; // an unparseable Origin is never reflected
  }
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(devHost);
}

export function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    // Responses differ by Origin, so they must never be cached across origins.
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin, req)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonCors(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors(req) });
}

/**
 * Wrap an extension route so an unhandled throw returns readable JSON, not Next's
 * HTML error page (which the extension shows as a contentless "Request failed
 * (502)"). `message` is shown to the user; the real error goes to the server log.
 */
export function guarded(
  name: string,
  message: string,
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (err) {
      console.error(`[${name}] failed`, err);
      return jsonCors(req, { error: message }, 502);
    }
  };
}
