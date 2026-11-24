import { readBody } from "@/lib/body";
import { revokeToken } from "@/lib/oauth";
import { preflight, PUBLIC_CORS } from "@/lib/public-cors";

// Token revocation (RFC 7009). Always 200, whether or not the token existed.

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const text = await readBody(req);
  if (text === null) return Response.json({ error: "invalid_request", error_description: "Body too large." }, { status: 413, headers: PUBLIC_CORS });
  const token = new URLSearchParams(text).get("token");
  if (token && token.length <= 200) await revokeToken(token);
  return new Response(null, { status: 200, headers: PUBLIC_CORS });
}
