import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, trustedProxyHops } from "@/lib/client-ip";
import { allowedExtensionIds, originProblem } from "@/lib/origin-check";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session-token";

// Files the sign-in pages need before anyone is signed in.
const PUBLIC_FILES = new Set(["/robots.txt", "/favicon.ico", "/icon.svg", "/apple-icon.png", "/logo.svg"]);

const PROXY_HOPS = trustedProxyHops();
const EXTENSION_IDS = allowedExtensionIds();
const isProd = process.env.NODE_ENV === "production";

// Per-IP limits for abuse-/cost-sensitive endpoints (window = 60s). Sign-in has
// its own backoff on failed attempts (lib/login-throttle.ts).
function rateRule(pathname: string): { max: number } | null {
  if (pathname === "/api/oauth/register" || pathname === "/api/oauth/token" || pathname === "/api/oauth/revoke" || pathname === "/api/oauth/authorize") return { max: 30 };
  // Extension: session-authed (the login cookie); caps a runaway page.
  if (pathname.startsWith("/api/extension")) return { max: 30 };
  return null;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new NextResponse(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/**
 * Content-Security-Policy with a fresh nonce per page, production only (dev needs
 * eval for fast refresh). Next reads the nonce from the request's header and puts
 * it on its own scripts, so no inline script runs without it.
 */
function page(req: NextRequest): NextResponse {
  if (!isProd) return NextResponse.next();
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // https: because the consent form redirects to the assistant (Claude, ChatGPT)
    // after posting, and form-action also governs that redirect.
    "form-action 'self' https: http://localhost:* http://127.0.0.1:*",
    "object-src 'none'",
  ].join("; ");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes handle their own auth, but rate-limit the abuse-prone ones.
  if (pathname.startsWith("/api/")) {
    const rule = rateRule(pathname);
    if (rule) {
      const { ok, retryAfter } = rateLimit(`${clientIp(req.headers, PROXY_HOPS)}:${pathname}`, rule.max, 60_000);
      if (!ok) return json(429, { error: "Too many requests. Please slow down." }, { "retry-after": String(retryAfter) });
    }
    const problem = originProblem({
      method: req.method,
      pathname,
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
      extensionIds: EXTENSION_IDS,
    });
    if (problem) return json(403, { error: problem });
    return NextResponse.next();
  }

  // The sign-in page is public; it sends a signed-in owner on.
  if (pathname === "/login") return page(req);

  // The MCP endpoint is bearer-authed in the route; cap it per IP all the same.
  if (pathname === "/mcp") {
    const { ok, retryAfter } = rateLimit(`${clientIp(req.headers, PROXY_HOPS)}:/mcp`, 120, 60_000);
    if (!ok) return json(429, { error: "Too many requests. Please slow down." }, { "retry-after": String(retryAfter), "access-control-allow-origin": "*" });
    return NextResponse.next();
  }

  // Public, unauthenticated surfaces: OAuth / MCP discovery, plus static files at the root.
  if (pathname.startsWith("/.well-known/") || PUBLIC_FILES.has(pathname)) {
    return NextResponse.next();
  }

  // Require a signed session for everything else, and come back here after login.
  // Pages check it against the owner row again (auth() in lib/auth.ts).
  if (!(await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    const login = new URL("/login", req.url);
    const back = pathname + req.nextUrl.search;
    if (back !== "/") login.searchParams.set("next", back);
    return NextResponse.redirect(login);
  }

  return page(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
