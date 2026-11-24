// The fields of a page the extension scanned, stored on Draft.fields with the
// values drafted for them. The payload comes from a browser and an assistant,
// so every read and write goes through normalizeFields.

type FieldKind = "line" | "long" | "rich";

export interface PageField {
  /** Stable within the request: "f1", "f2", ... */
  id: string;
  /** The question or label the page shows for the field. */
  label: string;
  kind: FieldKind;
  maxLength: number | null;
  required: boolean;
  /** How the extension finds the field again on the page. */
  selector: string;
  value: string;
}

export const MAX_FIELDS = 30;
const MAX_LABEL = 300;
const MAX_SELECTOR = 500;
export const MAX_VALUE = 10_000;
const KINDS: FieldKind[] = ["line", "long", "rich"];

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function normalizeFields(raw: unknown): PageField[] {
  if (!Array.isArray(raw)) return [];
  const out: PageField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = text(r.id, 20);
    const selector = String(r.selector ?? "").trim().slice(0, MAX_SELECTOR);
    if (!/^f\d{1,3}$/.test(id) || seen.has(id) || !selector) continue;
    seen.add(id);
    const max = Number(r.maxLength);
    out.push({
      id,
      label: text(r.label, MAX_LABEL),
      kind: KINDS.includes(r.kind as FieldKind) ? (r.kind as FieldKind) : "long",
      maxLength: Number.isInteger(max) && max > 0 ? max : null,
      required: r.required === true,
      selector,
      value: String(r.value ?? "").trim().slice(0, MAX_VALUE),
    });
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}

/** The draft's text for lists and copying: the one value, or each labelled value. */
export function fieldsText(fields: PageField[]): string {
  const filled = fields.filter((f) => f.value);
  if (filled.length === 1) return filled[0]!.value;
  return filled.map((f) => `${f.label || f.id}\n${f.value}`).join("\n\n");
}
