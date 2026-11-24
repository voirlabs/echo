// CORS for the public OAuth / MCP endpoints. They are authenticated by bearer
// tokens or PKCE, never by cookies, so any origin may call them (browser-based
// MCP clients need this) and credentials are never allowed.
export const PUBLIC_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: PUBLIC_CORS });

export const publicJson = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...PUBLIC_CORS, "Cache-Control": "no-store", ...extra } });
