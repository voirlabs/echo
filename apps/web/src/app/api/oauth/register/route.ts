import { parseJsonText, readBody } from "@/lib/body";
import { registerClient, RegisterBody } from "@/lib/oauth";
import { preflight, publicJson } from "@/lib/public-cors";

// Dynamic client registration (RFC 7591) for public clients: ChatGPT, Claude and
// other MCP clients register their redirect URIs here, then use PKCE.

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const text = await readBody(req);
  if (text === null) return publicJson({ error: "invalid_client_metadata", error_description: "Body too large." }, 413);
  const body = parseJsonText(text);
  if (!body || typeof body !== "object") return publicJson({ error: "invalid_client_metadata", error_description: "Body must be JSON." }, 400);
  const parsed = RegisterBody.safeParse(body);
  if (!parsed.success) {
    const redirect = parsed.error.issues.some((i) => i.path[0] === "redirect_uris");
    return redirect
      ? publicJson({ error: "invalid_redirect_uri", error_description: "redirect_uris must be 1 to 10 https URLs (or http on localhost)." }, 400)
      : publicJson({ error: "invalid_client_metadata", error_description: parsed.error.issues[0]?.message ?? "Invalid metadata." }, 400);
  }
  // Every client is registered as public with PKCE (the response says so). A
  // client asking for client_secret_post/basic gets "none" back, per RFC 7591
  // section 3.2.1, instead of a failed registration.

  const client = await registerClient({ name: parsed.data.client_name?.trim() ?? "", redirectUris: parsed.data.redirect_uris });
  if (!client) {
    return publicJson({ error: "temporarily_unavailable", error_description: "Too many registrations. Try again later." }, 429, { "retry-after": "3600" });
  }
  return publicJson(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}
