// The client address for rate limiting. Only the proxies we run may write it, so
// X-Forwarded-For is read from the right: with `hops` = 1 (one reverse proxy that
// appends or sets the header) that is the address the proxy saw. The leftmost
// entries are whatever the client sent and are never trusted. With no proxy in
// front (hops = 0, the default) every request shares one bucket. Edge-safe.
export function clientIp(headers: Headers, hops: number): string {
  if (hops <= 0) return "direct";
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? "unknown";
}

/** TRUSTED_PROXY_HOPS: how many reverse proxies in front append to X-Forwarded-For. 0 when unset. */
export function trustedProxyHops(): number {
  return Math.max(0, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10) || 0);
}
