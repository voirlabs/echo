// Backoff for sign-in. Every attempt counts as a failure until the password checks
// out, so parallel guesses can't slip through; a success clears it. After a few
// failures each further one doubles the wait, up to 15 minutes. Guesses are
// counted per address and across all addresses (there is one password), but a
// browser that signed in before (the device cookie) has its own count, so someone
// guessing elsewhere can't keep the owner locked out. In memory, like rate-limit.ts.

interface ThrottleKey {
  id: string;
  /** Failures allowed before the wait starts. */
  free: number;
}

interface State {
  failures: number;
  lockedUntil: number;
  last: number;
}

const MAX_WAIT_MS = 15 * 60 * 1000;
const FORGET_MS = 60 * 60 * 1000;
const store = new Map<string, State>();

/** The keys an attempt counts against. */
export function throttleKeys(ip: string, device: string | null): ThrottleKey[] {
  if (device) return [{ id: `device:${device}`, free: 5 }];
  return [{ id: `ip:${ip}`, free: 5 }, { id: "all", free: 20 }];
}

const current = (id: string, now: number): State | null => {
  const s = store.get(id);
  if (!s || now - s.last > FORGET_MS) return null;
  return s;
};

/**
 * Start an attempt: the seconds to wait if any key is still backing off, else 0,
 * and the attempt is counted as a failure until loginSucceeded clears it.
 */
export function beginLogin(keys: ThrottleKey[], now = Date.now()): number {
  if (store.size > 10_000) for (const [k, v] of store) if (now - v.last > FORGET_MS) store.delete(k);
  const wait = Math.max(0, ...keys.map((k) => (current(k.id, now)?.lockedUntil ?? 0) - now));
  if (wait > 0) return Math.ceil(wait / 1000);
  for (const k of keys) {
    const s = current(k.id, now) ?? { failures: 0, lockedUntil: 0, last: now };
    s.failures += 1;
    s.last = now;
    const over = s.failures - k.free;
    s.lockedUntil = over > 0 ? now + Math.min(MAX_WAIT_MS, 1000 * 2 ** (over - 1)) : 0;
    store.set(k.id, s);
  }
  return 0;
}

/** The password was right: forget the failures on these keys. */
export function loginSucceeded(keys: ThrottleKey[]): void {
  for (const k of keys) store.delete(k.id);
}
