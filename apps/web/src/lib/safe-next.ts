/** A post-login destination, accepted only as a same-site path ("/x?y"), never
 *  an absolute or protocol-relative URL, so it can't be used as an open redirect. */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || /[\r\n]/.test(v)) return fallback;
  return v;
}
