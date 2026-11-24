import { APP_NAME, APP_URL, REPO_URL } from "@/lib/site";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

// OAuth 2.1 authorization server for the MCP endpoint at /mcp (Claude
// connectors, ChatGPT apps and other MCP clients). Authorization code + PKCE
// (S256 only), dynamic client registration, rotating refresh tokens. Codes and
// tokens are random 256-bit values stored only as SHA-256 hashes.

export const ISSUER = (process.env.OAUTH_ISSUER?.trim() || APP_URL).replace(/\/+$/, "");
export const MCP_RESOURCE = `${ISSUER}/mcp`;
export const SCOPE = "proposals";

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export const sha256 = (v: string): string => createHash("sha256").update(v).digest("hex");
const randomToken = (prefix: string): string => `${prefix}_${randomBytes(32).toString("base64url")}`;

export function authServerMetadata() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/api/oauth/token`,
    registration_endpoint: `${ISSUER}/api/oauth/register`,
    revocation_endpoint: `${ISSUER}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    service_documentation: REPO_URL,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: APP_NAME,
    resource_documentation: REPO_URL,
  };
}

/** A redirect URI a client may register: https anywhere, or http on loopback (native/dev clients). */
export function isAllowedRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
}

/** Registration metadata (RFC 7591) we use. Other members (logo_uri, grant_types, ...) are allowed and ignored. */
export const RegisterBody = z.looseObject({
  redirect_uris: z.array(z.string().max(2000).refine(isAllowedRedirectUri)).min(1).max(10),
  client_name: z.string().max(500).optional().catch(undefined),
});

/** Token request parameters (RFC 6749). Unknown parameters are ignored, as the spec requires. */
export const TokenParams = z.looseObject({
  grant_type: z.string().max(100).optional(),
  client_id: z.string().max(200).optional(),
  code: z.string().max(200).optional(),
  code_verifier: z.string().max(200).optional(),
  redirect_uri: z.string().max(2000).optional(),
  refresh_token: z.string().max(200).optional(),
  resource: z.string().max(2000).optional(),
});

/** New registrations allowed per hour across all callers; anyone can register, so this caps the table. */
const MAX_REGISTRATIONS_PER_HOUR = 100;

/** Register a public client, or null when the hourly cap is reached. Sweeps stale clients first. */
export async function registerClient(input: { name: string; redirectUris: string[] }) {
  await sweep();
  const recent = await prisma.oAuthClient.count({ where: { createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent >= MAX_REGISTRATIONS_PER_HOUR) return null;
  const clientId = `client_${randomBytes(16).toString("base64url")}`;
  return prisma.oAuthClient.create({
    data: { clientId, name: input.name.slice(0, 120) || "Unnamed client", redirectUris: input.redirectUris },
  });
}

export const findClient = (clientId: string) => prisma.oAuthClient.findUnique({ where: { clientId } });

/** RFC 7636: base64url(SHA-256(verifier)) must equal the stored challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export async function issueCode(args: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
}): Promise<string> {
  const code = randomToken("oac");
  await prisma.oAuthCode.create({
    data: { ...args, codeHash: sha256(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  return code;
}

/** Consume a code exactly once. Returns null when unknown, expired or already
 *  used. Stamping usedAt is the claim: of concurrent requests with the same code,
 *  only one wins. A code presented again means it leaked, so every token it
 *  issued is revoked (RFC 6749 4.1.2). */
export async function consumeCode(code: string) {
  const row = await prisma.oAuthCode.findUnique({ where: { codeHash: sha256(code) } });
  if (!row) return null;
  const claimed = await prisma.oAuthCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) {
    await prisma.oAuthToken.updateMany({ where: { codeId: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return null;
  }
  if (row.expiresAt < new Date()) return null;
  return row;
}

/** Housekeeping, run on registration and now and then on token issue: drop expired
 *  codes, tokens dead for 30 days, and registered clients that never completed a
 *  sign-in within a day. */
async function sweep(): Promise<void> {
  const now = Date.now();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  await prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  await prisma.oAuthToken.deleteMany({
    where: { OR: [{ revokedAt: { lt: monthAgo } }, { refreshExpiresAt: { lt: monthAgo } }] },
  });
  await prisma.oAuthClient.deleteMany({
    where: { createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) }, tokens: { none: {} }, codes: { none: {} } },
  });
}

export async function issueTokens(args: { clientId: string; userId: string; scope: string; codeId: string | null }) {
  if (Math.random() < 0.05) void sweep().catch((err) => console.error("[oauth] sweep failed", err));
  const accessToken = randomToken("oat");
  const refreshToken = randomToken("oar");
  await prisma.oAuthToken.create({
    data: {
      ...args,
      accessHash: sha256(accessToken),
      refreshHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: args.scope,
  };
}

/** Rotate a refresh token: the old pair is revoked, a new pair is issued.
 *  Presenting a refresh token that was already rotated means it was copied, so
 *  every token this client holds for the user is revoked (RFC 9700 4.14). */
export async function refreshTokens(refreshToken: string, clientId: string) {
  const row = await prisma.oAuthToken.findUnique({ where: { refreshHash: sha256(refreshToken) } });
  if (!row || row.clientId !== clientId) return null;
  if (row.revokedAt) {
    await prisma.oAuthToken.updateMany({
      where: { userId: row.userId, clientId: row.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }
  if (!row.refreshExpiresAt || row.refreshExpiresAt < new Date()) return null;
  // Claim the rotation atomically: of concurrent refreshes only one wins.
  const claimed = await prisma.oAuthToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (claimed.count !== 1) return null;
  return issueTokens({ clientId: row.clientId, userId: row.userId, scope: row.scope, codeId: row.codeId });
}

export async function revokeToken(token: string): Promise<void> {
  const h = sha256(token);
  await prisma.oAuthToken.updateMany({
    where: { OR: [{ accessHash: h }, { refreshHash: h }], revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Resolve a bearer access token to its user, or null. */
export async function verifyAccessToken(token: string): Promise<{ userId: string; clientId: string; scope: string } | null> {
  const row = await prisma.oAuthToken.findUnique({ where: { accessHash: sha256(token) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 10 * 60 * 1000) {
    await prisma.oAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
  }
  return { userId: row.userId, clientId: row.clientId, scope: row.scope };
}

type AuthorizeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
  resource: string | null;
};

/**
 * Validate an authorization request. Every error is shown to the user rather than
 * sent to the redirect URI: anyone can register a client, so redirecting before
 * consent would make this an open redirect.
 */
export async function validateAuthorizeRequest(
  q: URLSearchParams,
): Promise<{ ok: true; req: AuthorizeRequest } | { ok: false; show: string }> {
  const clientId = q.get("client_id") ?? "";
  const client = clientId ? await findClient(clientId) : null;
  if (!client) return { ok: false, show: `This app isn't registered with ${APP_NAME}. Try connecting again from the app.` };
  const redirectUri = q.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, show: "This connection request has an unrecognised return address, so it was stopped." };
  }
  const state = q.get("state");
  const invalid = (description: string) => ({ ok: false as const, show: `This connection request is invalid: ${description}` });
  if (q.get("response_type") !== "code") return invalid("Only response_type=code is supported.");
  const codeChallenge = q.get("code_challenge") ?? "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
    return invalid("PKCE with code_challenge_method=S256 is required.");
  }
  const resource = q.get("resource");
  if (resource && resource.replace(/\/+$/, "") !== MCP_RESOURCE) return invalid("Unknown resource.");
  return {
    ok: true,
    req: { clientId, clientName: client.name, redirectUri, state, codeChallenge, scope: SCOPE, resource },
  };
}

/** The client's redirect URI with the code (or an error) attached. */
export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  u.searchParams.set("iss", ISSUER);
  return u.toString();
}
