// The rules for which fields on a page the extension may read and fill, kept free
// of the DOM so they can be tested. shared/page.ts measures the page and asks these.

export interface Box { left: number; top: number; right: number; bottom: number }

/** Below this, a box (or what a clip leaves of it) is treated as nothing at all. */
const MIN_SEEN_PX = 4;
/** Below this combined opacity, a field is invisible to a person. */
const MIN_OPACITY = 0.1;

export function intersect(a: Box, b: Box): Box | null {
  const box = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
  return box.right - box.left >= MIN_SEEN_PX && box.bottom - box.top >= MIN_SEEN_PX ? box : null;
}

/** What the page measured about one field (rects in viewport coordinates). */
export interface FieldFacts {
  rect: Box;
  /** Inside an aria-hidden="true" or inert subtree. */
  ariaHidden: boolean;
  /** Computed visibility: "visible", "hidden" or "collapse". */
  visibility: string;
  /** Opacity multiplied up the ancestor chain. */
  opacity: number;
  /** A clip or clip-path on the field or an ancestor leaves next to nothing. */
  clipped: boolean;
  /** The area a person can scroll to: the document, or just the window when the page can't scroll. */
  reach: Box;
  viewport: Box;
  /**
   * The field's box after the ancestors that clip their content. "hidden": an
   * overflow:hidden/clip ancestor leaves nothing; "scroll": a scroll container
   * has it scrolled out of view; null: something of it is left.
   */
  cut: "hidden" | "scroll" | null;
  /** The part of the field that's left after clipping ancestors. */
  shown: Box;
  /** True when the field (or its label) is the topmost element somewhere in this box. */
  onTop: (box: Box) => boolean;
}

/**
 * Whether a person can see the field: big enough, not hidden, transparent or
 * clipped away, not moved outside the page, and, when it's in the window, not
 * covered by something else. A field that is merely scrolled out of view counts.
 */
export function fieldVisible(f: FieldFacts): boolean {
  if (f.rect.right - f.rect.left <= 20 || f.rect.bottom - f.rect.top <= 14) return false;
  if (f.ariaHidden || f.visibility === "hidden" || f.visibility === "collapse") return false;
  if (f.opacity < MIN_OPACITY || f.clipped) return false;
  if (!intersect(f.rect, f.reach)) return false;
  // A positioned field can escape an overflow:hidden ancestor, so trust the hit test.
  if (f.cut === "hidden") {
    const inView = intersect(f.rect, f.viewport);
    return inView ? f.onTop(inView) : false;
  }
  if (f.cut === "scroll") return true;
  const inView = intersect(f.shown, f.viewport);
  return inView ? f.onTop(inView) : true;
}

/** Points to hit-test in a box: its centre, then four points around it. */
export function samplePoints(b: Box): [number, number][] {
  const x = (t: number) => b.left + (b.right - b.left) * t;
  const y = (t: number) => b.top + (b.bottom - b.top) * t;
  return [[x(0.5), y(0.5)], [x(0.25), y(0.25)], [x(0.75), y(0.25)], [x(0.25), y(0.75)], [x(0.75), y(0.75)]];
}

/** A length in a computed CSS value: px, or % of `ref`. Null for anything else. */
function length(token: string | undefined, ref: number): number | null {
  if (!token) return null;
  const m = /^(-?[\d.]+)(px|%)?$/.exec(token.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "%" ? (n / 100) * ref : n;
}

/** True when a computed `clip: rect(...)` leaves under 2px of a w×h box. */
export function clipRectHides(clip: string, w: number, h: number): boolean {
  const m = /^rect\((.*)\)$/.exec(clip.trim());
  if (!m) return false;
  const parts = m[1]!.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 4) return false;
  const side = (i: number, auto: number) => (parts[i] === "auto" ? auto : length(parts[i], 0));
  const [top, right, bottom, left] = [side(0, 0), side(1, w), side(2, h), side(3, 0)];
  if (top === null || right === null || bottom === null || left === null) return false;
  return right - left < 2 || bottom - top < 2;
}

/**
 * True when a computed `clip-path` leaves under 2px of a w×h box. Handles inset(),
 * circle(), ellipse() and polygon(); anything else (a URL, a path) is given the
 * benefit of the doubt.
 */
export function clipPathHides(value: string, w: number, h: number): boolean {
  const m = /^(inset|circle|ellipse|polygon)\((.*)\)$/.exec(value.trim());
  if (!m) return false;
  const [, fn, args] = m as unknown as [string, string, string];
  if (fn === "inset") {
    const parts = args.split(/\s+round\s+/)[0]!.split(/\s+/).filter(Boolean);
    const [t, r = t, b = t, l = r] = parts;
    const top = length(t, h);
    const right = length(r, w);
    const bottom = length(b, h);
    const left = length(l, w);
    if (top === null || right === null || bottom === null || left === null) return false;
    return w - left - right < 2 || h - top - bottom < 2;
  }
  if (fn === "circle") {
    const radius = length(args.split(/\s+at\s+/)[0]!.trim() || "50%", Math.hypot(w, h) / Math.SQRT2);
    return radius !== null && radius * 2 < 2;
  }
  if (fn === "ellipse") {
    const [rx, ry] = args.split(/\s+at\s+/)[0]!.trim().split(/\s+/);
    const x = length(rx || "50%", w);
    const y = length(ry || "50%", h);
    return x !== null && y !== null && (x * 2 < 2 || y * 2 < 2);
  }
  const points = args.replace(/^\s*(nonzero|evenodd)\s*,/, "").split(",").map((p) => p.trim().split(/\s+/));
  const xs = points.map((p) => length(p[0], w));
  const ys = points.map((p) => length(p[1], h));
  if (xs.some((v) => v === null) || ys.some((v) => v === null)) return false;
  const span = (vs: (number | null)[]) => Math.max(...(vs as number[])) - Math.min(...(vs as number[]));
  return span(xs) < 2 || span(ys) < 2;
}

const SENSITIVE_AUTOCOMPLETE = new Set(["one-time-code", "current-password", "new-password"]);
// Words that mark a password, a one-time code or a payment field, matched on the
// field's name, id, placeholder, aria-label and label (split into words first).
const SENSITIVE_WORDS =
  /\b(pass ?(word|code|phrase)|pwd|otp|one ?time (code|password)|verification code|security code|2fa|cc ?(num|number|exp|csc|cvv|cvc|name)|(card|cc) ?(number|num|no)|name on card|card ?holder|credit ?card|debit ?card|cvv2?|cvc2?|csc|expiry date|expiration date|exp date|iban|routing number|account number|sort code|swift code|bic code)\b/;

/** Lower-case words: "billing_cardNumber" becomes "billing card number". */
const words = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.[\]:]+/g, " ").toLowerCase();

/**
 * A field the extension never reads or fills: passwords, one-time codes and
 * payment details, by type, autocomplete token or the words around it.
 */
export function isSensitive(f: { type: string; autocomplete: string; hints: string[] }): boolean {
  if (f.type.toLowerCase() === "password") return true;
  const tokens = f.autocomplete.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.some((t) => t.startsWith("cc-") || SENSITIVE_AUTOCOMPLETE.has(t))) return true;
  return SENSITIVE_WORDS.test(words(f.hints.filter(Boolean).join(" ")));
}

/** Collapse whitespace and cap the length, as the server does with labels. */
export const cleanLabel = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);

/** A field's label: the text a person sees next to it, else its aria-label, else its placeholder. */
export function pickLabel(seen: string, ariaLabel: string | null, placeholder: string | null): string {
  return cleanLabel(seen) || cleanLabel(ariaLabel ?? "") || cleanLabel(placeholder ?? "");
}

/**
 * Which scanned field each drafted value goes into: only the field with the same
 * selector and the same label it had when the page was scanned, each at most
 * once. Returns, per drafted value, the index of its field or -1.
 */
export function matchFill(scanned: { selector: string; label: string }[], wanted: { selector: string; label: string }[]): number[] {
  const used = new Set<number>();
  return wanted.map((w) => {
    const i = scanned.findIndex((s, j) => !used.has(j) && s.selector === w.selector && s.label === cleanLabel(w.label));
    if (i >= 0) used.add(i);
    return i;
  });
}
