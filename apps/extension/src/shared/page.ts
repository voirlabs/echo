// Runs in the active tab, only after the user opens the popup (activeTab). The
// popup injects the bundled page.js, then calls runOnPage through the global it
// sets. Scanning and filling share one list of fields, so a value can only go into
// a field that was scanned and is still visible.
import { cleanLabel, clipPathHides, clipRectHides, fieldVisible, intersect, isSensitive, matchFill, pickLabel, samplePoints, type Box } from "./page-rules";

interface ScannedField {
  id: string;
  label: string;
  kind: "line" | "long" | "rich";
  maxLength: number | null;
  required: boolean;
  selector: string;
}

export interface ScannedPage {
  url: string;
  title: string;
  text: string;
  fields: ScannedField[];
}

export interface FillField { id: string; label: string; selector: string; value: string }
type FillResult = { filled: number; missing: string[] };
export type PageRun = { page: ScannedPage; fill: FillResult | null };

const RICH = "[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']";
const TEXT_TYPES = ["text", "email", "url", "tel", "number", ""];
// Controls inside a label: text another extension adds next to a field ("Draft
// with ...") isn't the field's label.
const NOT_LABEL = "button, a, [role=button], [role=link], input, textarea, select, svg, script, style, [contenteditable]";
const MAX_FIELDS = 30;

const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

function kindOf(el: HTMLElement): ScannedField["kind"] | null {
  if (el.tagName === "TEXTAREA") {
    const f = el as HTMLTextAreaElement;
    return f.disabled || f.readOnly ? null : "long";
  }
  if (el.tagName === "INPUT") {
    const f = el as HTMLInputElement;
    const type = (el.getAttribute("type") || "").toLowerCase();
    return !TEXT_TYPES.includes(type) || f.disabled || f.readOnly ? null : "line";
  }
  // A rich editor counts once, at its outermost editable element.
  if (el.matches(RICH) && !el.parentElement?.closest(RICH)) return "rich";
  return null;
}

/** What the page can scroll to: the document, or only the window on an axis the page can't scroll. */
function reach(): Box {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  const bodyStyle = document.body ? getComputedStyle(document.body) : rootStyle;
  // The body's overflow applies to the window when the root's is visible.
  const axis = (a: "overflowX" | "overflowY") => (rootStyle[a] === "visible" ? bodyStyle[a] : rootStyle[a]);
  const fixed = (v: string) => v === "hidden" || v === "clip";
  const width = Math.max(root.scrollWidth, innerWidth);
  const height = Math.max(root.scrollHeight, innerHeight);
  return {
    left: fixed(axis("overflowX")) ? 0 : -scrollX,
    top: fixed(axis("overflowY")) ? 0 : -scrollY,
    right: fixed(axis("overflowX")) ? innerWidth : width - scrollX,
    bottom: fixed(axis("overflowY")) ? innerHeight : height - scrollY,
  };
}

/** Opacity, clipping and overflow, walked up from the element. */
function ancestry(el: Element, rect: Box) {
  let opacity = 1;
  let clipped = false;
  let cut: "hidden" | "scroll" | null = null;
  let shown: Box | null = rect;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    opacity *= Number(s.opacity);
    const r = n.getBoundingClientRect();
    if ((s.position === "absolute" || s.position === "fixed") && s.clip && s.clip !== "auto" && clipRectHides(s.clip, r.width, r.height)) clipped = true;
    if (s.clipPath && s.clipPath !== "none" && clipPathHides(s.clipPath, r.width, r.height)) clipped = true;
    // The root and body scroll the window; reach() covers them.
    if (n === el || n === document.documentElement || n === document.body || !shown) continue;
    if (s.overflowX === "visible" && s.overflowY === "visible") continue;
    const left = intersect(shown, boxOf(r));
    if (!left) cut = s.overflowX === "hidden" || s.overflowX === "clip" || s.overflowY === "hidden" || s.overflowY === "clip" ? "hidden" : "scroll";
    shown = left;
  }
  return { opacity, clipped, cut, shown: shown ?? rect };
}

/** The field, something inside it, or its own label is what's on top at (x, y). */
function topmostIs(el: HTMLElement, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return false;
  if (hit === el || el.contains(hit)) return true;
  return (hit.closest("label") as HTMLLabelElement | null)?.control === el;
}

function visible(el: HTMLElement, view: Box, area: Box): boolean {
  const rect = boxOf(el.getBoundingClientRect());
  const { opacity, clipped, cut, shown } = ancestry(el, rect);
  return fieldVisible({
    rect,
    ariaHidden: !!el.closest("[aria-hidden='true'], [inert]"),
    visibility: getComputedStyle(el).visibility,
    opacity,
    clipped,
    reach: area,
    viewport: view,
    cut,
    shown,
    onTop: (box) => samplePoints(box).some(([x, y]) => topmostIs(el, x, y)),
  });
}

/** Whether text in this element is rendered: not hidden, transparent, clipped or aria-hidden. */
function textShown(el: Element, cache: Map<Element, boolean>): boolean {
  const known = cache.get(el);
  if (known !== undefined) return known;
  const s = getComputedStyle(el);
  let ok = el.getClientRects().length > 0 && s.visibility !== "hidden" && s.visibility !== "collapse" && !el.closest("[aria-hidden='true']");
  if (ok) {
    const { opacity, clipped } = ancestry(el, boxOf(el.getBoundingClientRect()));
    ok = opacity >= 0.1 && !clipped;
  }
  cache.set(el, ok);
  return ok;
}

/** The rendered words in a node, leaving out controls and anything a person can't see. */
function textOf(node: Element | null | undefined, cache: Map<Element, boolean>): string {
  if (!node) return "";
  const out: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const parent = t.parentElement;
    if (!parent || !t.textContent?.trim()) continue;
    const control = parent.closest(NOT_LABEL);
    if (control && node.contains(control)) continue;
    if (textShown(parent, cache)) out.push(t.textContent);
  }
  return out.join(" ");
}

function labelOf(el: HTMLElement, cache: Map<Element, boolean>): string {
  const parts: string[] = [];
  const by = el.getAttribute("aria-labelledby");
  if (by) for (const id of by.split(/\s+/)) parts.push(textOf(document.getElementById(id), cache));
  if (el.id) parts.push(textOf(document.querySelector(`label[for="${CSS.escape(el.id)}"]`), cache));
  parts.push(textOf(el.closest("label"), cache));
  // Else the text just before the field, or before its wrapper, up to three levels out.
  let block: Element | null = el;
  for (let i = 0; i < 4 && block && !parts.join("").trim(); i++, block = block.parentElement) {
    parts.push(textOf(block.previousElementSibling, cache));
  }
  return pickLabel(parts.join(" "), el.getAttribute("aria-label"), el.getAttribute("placeholder"));
}

function selectorOf(el: HTMLElement): string {
  if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute("name");
  if (name) {
    const sel = `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
    if (document.querySelectorAll(sel).length === 1) return sel;
  }
  const path: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body && path.length < 12) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const same = [...parent.children].filter((c) => c.tagName === node!.tagName);
    path.unshift(`${node.tagName.toLowerCase()}${same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : ""}`);
    node = parent;
  }
  return `body > ${path.join(" > ")}`;
}

const isSearch = (el: HTMLElement): boolean => {
  const hint = `${el.getAttribute("type") ?? ""} ${el.getAttribute("name") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
  return /search/.test(hint) || !!el.closest("[role=search], form[role=search]");
};

/**
 * The fields a person would type into: text inputs, text areas and rich editors
 * that are editable and visible to them. Search boxes, passwords, one-time codes
 * and payment fields are left out.
 */
function scanFields(): { field: ScannedField; el: HTMLElement }[] {
  const view = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const area = reach();
  const cache = new Map<Element, boolean>();
  const found: { field: ScannedField; el: HTMLElement }[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(`textarea, input, ${RICH}`)) {
    const kind = kindOf(el);
    if (!kind || isSearch(el) || !visible(el, view, area)) continue;
    const label = labelOf(el, cache);
    const sensitive = isSensitive({
      type: el.getAttribute("type") ?? "",
      autocomplete: el.getAttribute("autocomplete") ?? "",
      hints: [el.getAttribute("name"), el.id, el.getAttribute("placeholder"), el.getAttribute("aria-label"), label].filter((h): h is string => !!h),
    });
    if (sensitive) continue;
    const max = Number(el.getAttribute("maxlength"));
    found.push({
      el,
      field: {
        id: `f${found.length + 1}`,
        label,
        kind,
        maxLength: Number.isInteger(max) && max > 0 ? max : null,
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        selector: selectorOf(el),
      },
    });
    if (found.length >= MAX_FIELDS) break;
  }
  return found;
}

function put(el: HTMLElement, value: string): void {
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const field = el as HTMLTextAreaElement | HTMLInputElement;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    // The native setter, so React and similar frameworks see the change.
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  el.focus();
  document.execCommand("selectAll", false);
  // execCommand keeps the editor's own undo stack and change events.
  if (!document.execCommand("insertText", false, value)) {
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

/**
 * Scan the page: its address, title, main text and fields. With `fill`, also put
 * each drafted value into the field it was drafted for, found again by the same
 * scan: same selector, same label, still visible. Nothing is ever submitted.
 */
export function runOnPage(fill: FillField[] | null): PageRun {
  const scanned = scanFields();
  const main = document.querySelector("main, article, [role=main]") ?? document.body;
  const text = ((main as HTMLElement).innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 15000);
  const page = { url: location.href, title: cleanLabel(document.title), text, fields: scanned.map((s) => s.field) };
  if (!fill) return { page, fill: null };

  const wanted = fill.filter((f) => f.value);
  const targets = matchFill(page.fields, wanted);
  const missing: string[] = [];
  let first: HTMLElement | null = null;
  wanted.forEach((f, i) => {
    const target = scanned[targets[i]!];
    if (!target) return void missing.push(f.label || f.id);
    put(target.el, f.value);
    first ??= target.el;
  });
  (first as HTMLElement | null)?.scrollIntoView({ block: "center" });
  return { page, fill: { filled: wanted.length - missing.length, missing } };
}
