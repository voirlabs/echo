import { parseJsonText, readBody } from "@/lib/body";
import { consumeCode, findClient, issueTokens, pkceMatches, refreshTokens, MCP_RESOURCE, TokenParams } from "@/lib/oauth";
import { preflight, publicJson } from "@/lib/public-cors";

// Token endpoint: authorization_code (with PKCE S256) and refresh_token grants.
// Accepts form-encoded bodies (the spec) and JSON (some clients send it).

export const OPTIONS = preflight;

const oauthError = (error: string, description: string, status = 400) =>
  publicJson({ error, error_description: description }, status);

/** The request's parameters as strings, from a form or JSON body. */
function paramsOf(type: string, text: string): Record<string, string> | null {
  if (type.includes("application/json")) {
    const body = parseJsonText(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(req: Request) {
  const text = await readBody(req);
  if (text === null) return oauthError("invalid_request", "Body too large.", 413);
  const raw = paramsOf(req.headers.get("content-type") ?? "", text);
  const parsed = raw ? TokenParams.safeParse(raw) : null;
  if (!parsed?.success) return oauthError("invalid_request", "Malformed token request.");
  const p = parsed.data;

  let clientId = p.client_id ?? "";
  const basic = req.headers.get("authorization") ?? "";
  if (!clientId && basic.toLowerCase().startsWith("basic ")) {
    try {
      clientId = decodeURIComponent(Buffer.from(basic.slice(6).trim(), "base64").toString("utf8").split(":")[0] ?? "").slice(0, 200);
    } catch {
      clientId = "";
    }
  }
  const client = clientId ? await findClient(clientId) : null;
  if (!client) return oauthError("invalid_client", "Unknown client_id.", 401);

  if (p.grant_type === "authorization_code") {
    const code = p.code ?? "";
    const verifier = p.code_verifier ?? "";
    const redirectUri = p.redirect_uri ?? "";
    const row = code ? await consumeCode(code) : null;
    if (!row || row.clientId !== client.clientId) return oauthError("invalid_grant", "The code is invalid or expired.");
    // RFC 6749 4.1.3: the same redirect_uri the code was issued for. A client with a
    // single registered URI may leave it out of both requests (validateAuthorizeRequest).
    const sameRedirect = redirectUri ? redirectUri === row.redirectUri : client.redirectUris.length === 1;
    if (!sameRedirect) return oauthError("invalid_grant", "redirect_uri does not match.");
    if (!pkceMatches(verifier, row.codeChallenge)) return oauthError("invalid_grant", "PKCE verification failed.");
    const resource = p.resource;
    if (resource && resource.replace(/\/+$/, "") !== MCP_RESOURCE) return oauthError("invalid_target", "Unknown resource.");
    return publicJson(await issueTokens({ clientId: client.clientId, userId: row.userId, scope: row.scope, codeId: row.id }));
  }

  if (p.grant_type === "refresh_token") {
    const tokens = await refreshTokens(p.refresh_token ?? "", client.clientId);
    if (!tokens) return oauthError("invalid_grant", "The refresh token is invalid, expired or revoked.");
    return publicJson(tokens);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}
