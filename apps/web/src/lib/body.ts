// Request bodies on the unauthenticated endpoints (sign-in, OAuth) are small, so
// they are read up to a cap and never buffered beyond it.

export const MAX_SMALL_BODY_BYTES = 16 * 1024;

/** The body as text, or null when it is larger than `max` bytes. */
export async function readBody(req: Request, max = MAX_SMALL_BODY_BYTES): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? "0") > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** JSON.parse that returns null instead of throwing. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
