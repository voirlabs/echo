// Deterministic writing-style analysis, the measurable half of "sound like me".
// The learned guide handles feel; this adds hard numbers computed from the user's
// own samples (rhythm, contractions, punctuation, openings, phrases). They feed
// (1) a "measured from my writing" block appended to the style guide, and
// (2) checkStyle(), which flags AI tells and slips before a draft is saved
// (lib/writer.ts). Pure and dependency-free.

// ── Shared word lists ────────────────────────────────────────────────────────

// AI "tells": words and phrases that read as machine-written. The house default
// style already forbids these; checkStyle catches any that survive, and the style
// analysis reports which (if any) appear in the user's own writing so we don't
// "correct" a word they genuinely use.
const AI_TELLS: string[] = [
  "delve", "leverage", "streamline", "unlock", "seamless", "seamlessly",
  "world-class", "cutting-edge", "passionate", "passion for", "in today's",
  "tapestry", "testament to", "game-changer", "synergy", "paradigm", "elevate",
  "embark", "realm of", "meticulous", "underscore", "showcase", "dive into",
  "robust solution", "bring to the table", "look no further", "rest assured",
  "excited to apply", "i am excited", "i'm excited to", "thrilled to",
  "excited about the opportunity", "hit the ground running",
];

// Constructions (not single words) that read as AI cadence. NEGATED also matches
// contracted forms (isn't, doesn't). The house style asks for contractions, so a
// plain `\bnot just\b` would be blind to "isn't just".
const NEGATED = String.raw`(?:\bnot\b|n['’]t\b)`;
const AI_CONSTRUCTIONS: { re: RegExp; label: string }[] = [
  { re: new RegExp(`${NEGATED}\\s+just\\b[^.!?]*\\bit['’]?s\\b`, "i"), label: '"not just X, it\'s Y" construction' },
  { re: new RegExp(`${NEGATED}\\s+only\\b[^.!?]*\\bbut also\\b`, "i"), label: '"not only X but also Y" construction' },
];

/** A line that is a bullet or a numbered item. */
const LIST_LINE = /^\s*(?:[-*•–]|\d+[.)])\s+\S/;
const countListLines = (s: string): number =>
  s.split("\n").filter((l) => LIST_LINE.test(l)).length;

/** Words that start a clause rather than a list item. A segment beginning with one
 *  of these is someone continuing a sentence, not enumerating: "…, then fix the
 *  form", "…, but the risky part is the backfill", "…, not the cutover". */
const CLAUSE_STARTERS = new Set([
  "then", "but", "so", "because", "which", "who", "though", "although", "while",
  "however", "if", "when", "since", "not", "yet", "unless", "until", "as", "for",
  "that", "where", "whereas", "plus", "instead",
]);

/** Subjects. A list item almost never restates one, so a segment starting with a
 *  subject pronoun is a clause riding on a comma rather than an item in a run. */
const SUBJECT_HEADS = new Set([
  "i", "we", "you", "they", "he", "she", "it", "there", "this", "these", "those",
]);

/**
 * Serial lists of parallel phrases in one sentence ("routes tasks, manages memory,
 * and coordinates work"), the most reliable machine cadence. Kept narrow, since a
 * false flag costs a rewrite: every post-comma segment must look like an item and
 * not a continuing clause, single-word items are ignored, and what remains must be
 * explicitly serial ("and X"/"or X") or visibly parallel (shared verb ending, or
 * short matching items).
 */
function serialPhraseLists(text: string): string[] {
  // Skip bullets (their own finding) and find sentences per LINE, so removing a
  // list can't splice a dangling stem onto the next paragraph.
  const lines = text.split("\n").filter((l) => l.trim() && !LIST_LINE.test(l));
  const out: string[] = [];
  for (const sentence of lines.flatMap((l) => splitSentences(l))) {
    const segments = sentence.split(",").map((x) => x.trim()).filter(Boolean);
    if (segments.length < 3) continue;

    // The first segment is the sentence stem; the rest are candidate items.
    const items = segments.slice(1)
      .map((seg) => seg.replace(/^(?:and|or)\s+/i, "").trim())
      .filter((seg) => words(seg).length >= 2);
    if (items.length < 2) continue;

    const head = (seg: string): string => (words(seg)[0] ?? "").replace(/['’]s$/, "");
    if (items.some((seg) => CLAUSE_STARTERS.has(head(seg)))) continue;

    // An item that restates a subject is a clause: "…, I can start Monday, or we
    // can talk first" is two sentences joined by a comma. It is dropped instead of
    // ending the check, so a real run survives one pronoun-headed member.
    const listItems = items.filter((seg) => !SUBJECT_HEADS.has(head(seg)));
    if (listItems.length < 2) continue;
    const heads = listItems.map(head);

    const serial = /,\s*(?:and|or)\s+\S/i.test(sentence);
    const suffix = (w: string): string => (/ing$/.test(w) ? "ing" : /(?:es|s)$/.test(w) ? "s" : /ed$/.test(w) ? "ed" : "");
    const shared = heads.filter((h) => suffix(h) && suffix(h) === suffix(heads[0])).length >= 2;
    const terse = listItems.every((seg) => words(seg).length <= 4);

    if (serial || shared || terse) out.push(sentence);
  }
  return out;
}

// A small English stopword set, enough to keep signature-phrase and favored-word
// extraction from surfacing "of the", "to be", etc. Not exhaustive by design.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "at", "by", "from", "as", "is", "are", "was", "were", "be", "been", "being",
  "it", "its", "this", "that", "these", "those", "i", "you", "we", "they", "he",
  "she", "my", "your", "our", "their", "me", "us", "them", "him", "her", "will",
  "would", "can", "could", "should", "do", "does", "did", "have", "has", "had",
  "not", "so", "if", "then", "than", "into", "out", "up", "down", "about", "over",
  "who", "what", "when", "where", "which", "how", "all", "any", "some", "more",
  "there", "here", "just", "also", "very", "too", "them", "get", "got",
]);

// ── Metrics ──────────────────────────────────────────────────────────────────

interface StyleMetrics {
  sampleCount: number;
  avgWordsPerSample: number;
  avgSentenceWords: number;
  sentenceWordStdev: number;
  shortSentenceRatio: number; // sentences under 8 words
  longSentenceRatio: number; // sentences over 25 words
  avgParagraphs: number;
  contractionsPer100Words: number;
  usesEmDash: boolean;
  exclamationPer1kWords: number;
  parenthesesPer1kWords: number;
  semicolonPer1kWords: number;
  /** Dominant way the samples open their first sentence. */
  opening: "problem" | "greeting" | "self" | "question" | "mixed";
  /** Recurring 2–3 word phrases the writer reaches for (job-agnostic, best-effort). */
  signaturePhrases: string[];
  /** Content words the writer favours across samples. */
  favoredWords: string[];
  /** Which AI-tell words appear in the user's own writing (so we keep them). */
  aiTellsPresent: string[];
  /** Whether the user's own samples use bullet/numbered lists. Shape is part of a
   *  voice (bulleted vs unbroken prose); this is the one layout metric here. */
  usesLists: boolean;
  /** Bullet/numbered lines per sample, so a writer who uses the odd list isn't
   *  told to write like one who lives in them. */
  listLinesPerSample: number;
  /** Whether they themselves write serial phrase lists (see serialPhraseLists), so
   *  the check never "corrects" a cadence they genuinely have. */
  usesSerialLists: boolean;
}

const words = (s: string): string[] => (s.toLowerCase().match(/[a-z][a-z'’]*/g) ?? []);
const splitSentences = (s: string): string[] =>
  s.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((x) => x.trim()).filter(Boolean);
const splitParagraphs = (s: string): string[] =>
  s.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
};
const round1 = (n: number): number => Math.round(n * 10) / 10;

function classifyOpening(firstSentence: string): "problem" | "greeting" | "self" | "question" {
  const s = firstSentence.trim();
  if (/^(hi|hello|hey|dear|greetings|good (morning|afternoon|evening))\b/i.test(s)) return "greeting";
  if (/\?\s*$/.test(s)) return "question";
  if (/^(i|i'm|i am|my name|as a|as an|being a|being an)\b/i.test(s)) return "self";
  return "problem";
}

/** Extract recurring n-grams (2–3 words) that appear in at least two samples (or
 *  twice in a single sample), skipping all-stopword and numeric grams. */
function signaturePhrases(samples: string[]): string[] {
  const docTokens = samples.map((s) => words(s));
  const gramDocs = new Map<string, Set<number>>();
  const gramCount = new Map<string, number>();
  docTokens.forEach((toks, doc) => {
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n);
        if (gram.every((w) => STOPWORDS.has(w))) continue;
        if (gram.some((w) => w.length < 2)) continue;
        const key = gram.join(" ");
        gramCount.set(key, (gramCount.get(key) ?? 0) + 1);
        (gramDocs.get(key) ?? gramDocs.set(key, new Set()).get(key)!).add(doc);
      }
    }
  });
  const multi = samples.length > 1;
  return [...gramCount.entries()]
    .filter(([key, c]) => (multi ? (gramDocs.get(key)?.size ?? 0) >= 2 : c >= 2))
    // Prefer longer, more frequent, and more widely-shared phrases.
    .sort((a, b) => (gramDocs.get(b[0])!.size - gramDocs.get(a[0])!.size) || (b[1] - a[1]) || (b[0].length - a[0].length))
    .slice(0, 8)
    .map(([key]) => key);
}

function favoredWords(samples: string[]): string[] {
  const count = new Map<string, number>();
  const docs = new Map<string, Set<number>>();
  samples.forEach((s, doc) => {
    for (const w of words(s)) {
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      count.set(w, (count.get(w) ?? 0) + 1);
      (docs.get(w) ?? docs.set(w, new Set()).get(w)!).add(doc);
    }
  });
  const multi = samples.length > 1;
  const tells = new Set(AI_TELLS);
  return [...count.entries()]
    .filter(([w, c]) => !tells.has(w) && (multi ? (docs.get(w)?.size ?? 0) >= 2 : c >= 3))
    .sort((a, b) => (docs.get(b[0])!.size - docs.get(a[0])!.size) || (b[1] - a[1]))
    .slice(0, 8)
    .map(([w]) => w);
}

/** Compute the measurable style fingerprint from the user's samples. Returns null
 *  when there's nothing usable to measure. */
export function computeStyleMetrics(rawSamples: string[]): StyleMetrics | null {
  const samples = rawSamples.map((s) => (s ?? "").trim()).filter(Boolean);
  if (samples.length === 0) return null;

  const sentenceLens: number[] = [];
  const paragraphCounts: number[] = [];
  const wordCounts: number[] = [];
  let emDashes = 0, exclamations = 0, parens = 0, semicolons = 0, contractions = 0, totalWords = 0;
  let listLines = 0, samplesWithLists = 0, serialListSamples = 0;
  const openings: string[] = [];

  for (const s of samples) {
    const sents = splitSentences(s);
    for (const sent of sents) sentenceLens.push(words(sent).length);
    if (sents.length) openings.push(classifyOpening(sents[0]));
    paragraphCounts.push(splitParagraphs(s).length || 1);
    const wc = words(s).length;
    wordCounts.push(wc);
    totalWords += wc;
    emDashes += (s.match(/—/g) ?? []).length;
    exclamations += (s.match(/!/g) ?? []).length;
    parens += (s.match(/\(/g) ?? []).length;
    semicolons += (s.match(/;/g) ?? []).length;
    contractions += (s.match(/\b[a-z]+['’][a-z]+\b/gi) ?? []).length;
    const lines = countListLines(s);
    listLines += lines;
    if (lines >= 2) samplesWithLists++;
    if (serialPhraseLists(s).length > 0) serialListSamples++;
  }

  const per1k = (n: number): number => (totalWords ? round1((n / totalWords) * 1000) : 0);
  const openCount = (k: string): number => openings.filter((o) => o === k).length;
  const dominantOpen = (["problem", "greeting", "self", "question"] as const)
    .map((k) => ({ k, n: openCount(k) }))
    .sort((a, b) => b.n - a.n);
  const opening: StyleMetrics["opening"] =
    dominantOpen[0].n === 0 ? "mixed"
      : dominantOpen[0].n > (dominantOpen[1]?.n ?? 0) ? dominantOpen[0].k
        : "mixed";

  const lowerAll = samples.join("\n").toLowerCase();
  const aiTellsPresent = AI_TELLS.filter((t) => lowerAll.includes(t));

  return {
    sampleCount: samples.length,
    avgWordsPerSample: Math.round(mean(wordCounts)),
    avgSentenceWords: round1(mean(sentenceLens)),
    sentenceWordStdev: round1(stdev(sentenceLens)),
    shortSentenceRatio: round1(sentenceLens.filter((n) => n < 8).length / (sentenceLens.length || 1)),
    longSentenceRatio: round1(sentenceLens.filter((n) => n > 25).length / (sentenceLens.length || 1)),
    avgParagraphs: round1(mean(paragraphCounts)),
    // "Uses lists" means a real habit, not one stray bullet: at least two list
    // lines in a sample, in at least a third of their samples.
    usesLists: samplesWithLists * 3 >= samples.length && samplesWithLists > 0,
    listLinesPerSample: round1(listLines / samples.length),
    usesSerialLists: serialListSamples * 3 >= samples.length && serialListSamples > 0,
    contractionsPer100Words: totalWords ? round1((contractions / totalWords) * 100) : 0,
    usesEmDash: emDashes > 0,
    exclamationPer1kWords: per1k(exclamations),
    parenthesesPer1kWords: per1k(parens),
    semicolonPer1kWords: per1k(semicolons),
    opening,
    signaturePhrases: signaturePhrases(samples),
    favoredWords: favoredWords(samples),
    aiTellsPresent,
  };
}

// ── Rendering the fingerprint into a prompt block ─────────────────────────────

const OPENING_DESC: Record<StyleMetrics["opening"], string> = {
  problem: "by naming the reader's problem or goal (not a greeting, not my name)",
  greeting: "with a short greeting",
  self: "by introducing myself",
  question: "with a question",
  mixed: "in varied ways",
};

/** Heading that separates the model-written prose guide from the computed block
 *  below it. The two halves are maintained differently (the prose is merged by a
 *  model as new samples arrive, the numbers are recomputed from scratch every
 *  time), so anything editing a stored guide splits on this first. */
const METRICS_HEADING = "MEASURED FROM MY OWN WRITING";

/** The prose half of a stored style guide, without the computed metrics block.
 *  What gets handed to the incremental merge: a model can't verify the numbers,
 *  so asking it to carry them forward only invites drift. */
export function styleProse(guide: string | null | undefined): string {
  const at = (guide ?? "").indexOf(METRICS_HEADING);
  return (at === -1 ? (guide ?? "") : (guide ?? "").slice(0, at)).trim();
}

/** A compact, concrete "measured from my writing" block appended to the style
 *  guide. Numbers give the model targets it can hit. */
export function renderMetricsBlock(m: StyleMetrics): string {
  const lines: string[] = [];
  lines.push(
    `- Length: my writing runs about ${m.avgWordsPerSample} words in ${Math.max(1, Math.round(m.avgParagraphs))} short paragraph(s).`,
  );
  const rhythm = m.sentenceWordStdev >= 6 ? "with a lot of variation" : m.sentenceWordStdev >= 3 ? "with some variation" : "fairly even";
  lines.push(
    `- Sentence rhythm: average ${m.avgSentenceWords} words per sentence, ${rhythm}; ${Math.round(m.shortSentenceRatio * 100)}% are short (under 8 words) and ${Math.round(m.longSentenceRatio * 100)}% are long (over 25). Mix short and long the same way.`,
  );
  lines.push(
    m.contractionsPer100Words >= 1
      ? `- Contractions: I use them (${m.contractionsPer100Words} per 100 words), so write with contractions.`
      : `- Contractions: I rarely use them, so keep them sparse.`,
  );
  const punct: string[] = [];
  punct.push(m.usesEmDash ? "I do use em-dashes" : "I never use em-dashes (use a comma, period, or parentheses)");
  punct.push(m.exclamationPer1kWords >= 2 ? "exclamation marks show up" : "almost no exclamation marks");
  if (m.parenthesesPer1kWords >= 3) punct.push("I use parentheses for asides");
  if (m.semicolonPer1kWords >= 2) punct.push("I use semicolons");
  lines.push(`- Punctuation: ${punct.join("; ")}.`);
  lines.push(`- Opening: I typically open ${OPENING_DESC[m.opening]}.`);
  lines.push(
    m.usesLists
      ? `- Shape: I do use bullet or numbered lists (about ${m.listLinesPerSample} list lines per piece).`
      : "- Shape: I write in prose paragraphs: no bullet points, no numbered lists, no headings.",
  );
  if (!m.usesSerialLists) {
    lines.push('- Cadence: I don\'t write three-part parallel lists ("routes tasks, manages memory, and coordinates work"). I break those into separate sentences.');
  }
  if (m.signaturePhrases.length) lines.push(`- Phrases I reach for: ${m.signaturePhrases.slice(0, 6).map((p) => `"${p}"`).join(", ")}.`);
  if (m.favoredWords.length) lines.push(`- Words I favour: ${m.favoredWords.slice(0, 6).join(", ")}.`);
  const avoid = AI_TELLS.filter((t) => !m.aiTellsPresent.includes(t)).slice(0, 12);
  if (avoid.length) lines.push(`- Words I never use: ${avoid.join(", ")}.`);
  return `${METRICS_HEADING}. Match these:\n${lines.join("\n")}`;
}

// ── Exemplar selection ────────────────────────────────────────────────────────

/** Pick the samples that best represent the user's *voice*, independent of the
 *  job: the ones nearest the median length, longer ones first on ties, and
 *  never near-empty scraps. Topic-matched selection (what drafting used before)
 *  biases the model toward copying content; representative selection anchors voice
 *  without pulling in another job's specifics. */
export function pickExemplars(rawSamples: string[], max = 2): string[] {
  const samples = rawSamples.map((s) => (s ?? "").trim()).filter((s) => words(s).length >= 30);
  if (samples.length <= max) return samples;
  const lens = samples.map((s) => words(s).length).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)];
  return samples
    .map((s) => ({ s, wc: words(s).length }))
    .sort((a, b) => Math.abs(a.wc - median) - Math.abs(b.wc - median) || b.wc - a.wc)
    .slice(0, max)
    .map((x) => x.s);
}

// ── Deterministic output check ────────────────────────────────────────────────

interface StyleCheckOptions {
  /** Whether the user's own writing uses em-dashes; when true we don't flag them. */
  usesEmDash?: boolean;
  /** AI-tell words the user's own samples use (StyleMetrics.aiTellsPresent): their
   *  words, so a draft that uses them isn't "corrected". */
  allowedTells?: string[];
  /** Whether the user's own writing uses bullet/numbered lists; when true a
   *  bulleted draft is their shape, not a slip. */
  usesLists?: boolean;
  /** Whether the user writes three-part parallel lists themselves. */
  usesSerialLists?: boolean;
  /** The user's measured average sample length, so the length rule is theirs
   *  rather than a house number. */
  avgWords?: number;
  /** Upper word bound before we flag the draft as too long. */
  maxWords?: number;
  /** The user's display name. A first line that leads with it is flagged. */
  name?: string | null;
  /** The user's own dominant opening (from computeStyleMetrics). When set, we
   *  don't "fix" an opening that matches their real habit: a greeting or self
   *  opening is only corrected when we know it isn't theirs. Undefined (no
   *  samples) falls back to the house problem-first default. */
  opening?: StyleMetrics["opening"];
  /** What is being written. Opening rules apply to applications
   *  only (a message may open with "Hi", an answer opens by answering), and
   *  answers and messages get shorter length caps. "text" is any text the user
   *  selected to check: voice checks only, no opening rule or length cap. */
  kind?: DraftKind;
}

/** What is being written. Each sets the checks: openings for applications, a
 *  length cap for each, none for "other". */
const DRAFT_KINDS = ["email", "message", "post", "application", "other"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** Names older clients send (a connected assistant may cache the old tool list). */
const LEGACY_KINDS: Record<string, DraftKind> = { proposal: "application", "cover-letter": "application", answer: "application", text: "other" };

/** Every kind name a client may send, for request schemas; toDraftKind maps it. */
export const ACCEPTED_KINDS = [...DRAFT_KINDS, ...Object.keys(LEGACY_KINDS)] as [string, ...string[]];

export function toDraftKind(kind: string | undefined): DraftKind | undefined {
  if (kind === undefined) return undefined;
  return (DRAFT_KINDS as readonly string[]).includes(kind) ? (kind as DraftKind) : LEGACY_KINDS[kind];
}

const MAX_WORDS: Record<DraftKind, number> = { email: 300, message: 150, post: 220, application: 320, other: Infinity };

/** Deterministic checks over a finished draft. Each returned string is a concrete,
 *  fixable instruction for a single corrective rewrite. High-precision by design:
 *  a false flag costs a wasted rewrite, so we only assert things we're sure about.
 *  (Em-dashes and placeholder names are already auto-stripped downstream by
 *  cleanDraft; this drives the model to write cleanly rather than lean on that.) */
export function checkStyle(text: string, opts: StyleCheckOptions = {}): string[] {
  const out: string[] = [];
  const t = (text ?? "").trim();
  if (!t) return out;
  const lower = t.toLowerCase();
  const firstSentence = splitSentences(t)[0] ?? "";

  // Opening on a greeting or the writer's name/intro, for applications only, and
  // only when it isn't the user's own habit. A measured "mixed" opening means
  // they vary; no samples keeps the house problem-first default.
  const kind = opts.kind ?? "other";
  const habit = opts.opening;
  const varies = habit === "mixed";
  if (kind === "application") {
    const open = classifyOpening(firstSentence);
    if (open === "greeting" && !varies && habit !== "greeting") {
      out.push("Don't open with a greeting. Open on the reader's actual problem or goal in the first sentence.");
    } else if (open === "self" && !varies && habit !== "self") {
      out.push("Don't open by introducing myself. Open on the reader's problem or goal, not my name or an 'I am' line.");
    }
    const name = (opts.name ?? "").trim();
    if (name && !varies && habit !== "self" && habit !== "greeting"
        && new RegExp(`^\\W*${name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(firstSentence)) {
      out.push("Don't start with my name. Lead with the reader's problem.");
    }
  }

  const allowed = new Set(opts.allowedTells ?? []);
  const tells = AI_TELLS.filter((w) => !allowed.has(w) && lower.includes(w));
  if (tells.length) out.push(`Remove these AI-sounding words/phrases and rephrase plainly: ${tells.join(", ")}.`);
  for (const c of AI_CONSTRUCTIONS) if (c.re.test(t)) out.push(`Rewrite to avoid the ${c.label}.`);

  // Em-dashes, unless the user writes with them.
  if (!opts.usesEmDash && t.includes("—")) out.push("Remove em-dashes; use a comma, period, or parentheses instead.");

  // Bullets and numbered lists, unless that's how they write. Shape is as much
  // part of a voice as vocabulary: a draft broken into bullets reads nothing like
  // someone who always writes unbroken prose.
  if (!opts.usesLists) {
    const listLines = countListLines(t);
    if (listLines >= 2) {
      out.push(`Rewrite the ${listLines} bulleted/numbered lines as prose sentences. I write in paragraphs, not lists.`);
    }
  }

  // Three or more parallel phrases in one sentence, the most reliable machine
  // cadence. Skipped for a writer who does it themselves.
  if (!opts.usesSerialLists) {
    const runs = serialPhraseLists(t);
    if (runs.length) {
      const first = runs[0].length > 120 ? `${runs[0].slice(0, 117)}...` : runs[0];
      out.push(
        `Break up the three-part parallel lists. ${runs.length === 1 ? "There is one" : `There are ${runs.length}`}, starting with: "${first}". Say it in separate sentences, or cut to the one item that matters.`,
      );
    }
  }

  // Length: against the user's own average for applications and emails (1.5x,
  // clamped 180 to 400), flat caps for messages and posts, none for "other".
  const wc = words(t).length;
  const measured = opts.avgWords && opts.avgWords > 0
    ? Math.min(Math.max(Math.round(opts.avgWords * 1.5), 180), 400)
    : undefined;
  const maxWords = opts.maxWords ?? (kind === "application" || kind === "email" ? (measured ?? MAX_WORDS[kind]) : MAX_WORDS[kind]);
  if (wc > maxWords) out.push(`Tighten it to under ${maxWords} words (currently ~${wc}); cut padding and any point made twice.`);

  return out;
}
