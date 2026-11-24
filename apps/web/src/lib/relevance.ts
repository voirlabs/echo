// Which of the user's experience and projects to put in front of the model for
// a brief. Pure, so it can be tested.

// Words that say nothing about relevance. Without this, a long description full
// of "the", "and" and "with" outranks a short one that matches the brief.
const STOPWORDS = new Set(
  ("a an and any are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "just me more most my need needs no not of on or our out over own so some such than that the their them then there " +
    "these they this those to too up us very was we were what when where which while who why will with would you your " +
    "about after all also am back before being both each few get got here him his her ive im lets like make made " +
    "many much new now off once only other same see should since still take through under until well want way " +
    "work worked working use used using via etc please looking help job jobs project projects").split(" "),
);

const singular = (w: string) =>
  w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;

/** Lower-cased content words, with plurals folded onto their singular ("scripts" → "script"). */
export function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []) {
    const word = raw.replace(/^[.]+|[.]+$/g, "");
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    out.add(singular(word));
  }
  return out;
}

/**
 * The `max` items most relevant to the brief, best first; newest first on ties
 * (items arrive newest first). Each shared term counts once, and terms that few
 * items share count more, so "BigQuery" beats a word every entry has.
 */
export function rankByBrief<T extends { text: string }>(items: T[], brief: string, max: number): T[] {
  const wanted = terms(brief);
  if (wanted.size === 0) return items.slice(0, max);
  const itemTerms = items.map((it) => terms(it.text));
  const df = new Map<string, number>();
  for (const set of itemTerms) for (const t of set) if (wanted.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((items.length + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  return items
    .map((it, i) => ({ it, i, score: [...itemTerms[i]!].filter((t) => wanted.has(t)).reduce((s, t) => s + idf(t), 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((x) => x.it);
}
