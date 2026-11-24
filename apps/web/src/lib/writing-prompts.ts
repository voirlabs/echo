// The text handed to the user's model: the writing rules for a draft, the
// prompts that learn the user's style from their samples, and the deterministic
// clean-up applied to every saved draft.

/** The style used until the user's own guide is built. */
const DEFAULT_STYLE = `Write like a real person, not an AI, in a direct, confident voice.
- Voice and tone: write for the reader, what they need from you, not how great you are. Confident and plain; never eager or salesy. Skip buzzwords and hollow superlatives ("world-class", "cutting-edge", "passionate", "exciting opportunity") and stock openers like "I hope this finds you well" or "I am excited to apply".
- Opening: get to the point in the first line, in your own words, drawn from what they wrote. Make it specific enough that it couldn't be pasted anywhere else. For an application, open on the reader's problem or goal, not your name or a greeting.
- Rhythm: never use em-dashes (use a comma, period, or parentheses). Vary sentence length. Use contractions. Cut AI tells like "delve", "leverage", "streamline", "unlock", "seamless", "ensure". Avoid the "it's not just X, it's Y" construction and tidy three-part lists. Don't make the same point twice.
- Length: as short as the job allows. A message or reply is a few lines; an email or application is usually 120 to 220 words in 2 or 3 short paragraphs. Go longer only when the request is genuinely complex.`;

/** Cap on a stored style guide, so it can't blow up a prompt. */
export const MAX_STYLE_LEN = 4000;

const PLAIN_TEXT_RULE =
  "Reply with the text only, ready to paste: no markdown (no #, no **bold**), no separator lines like --- or ===, no code fences, and don't wrap it in quotes.";

/** The rules a draft is written under: integrity, shape, and the user's style. */
export function buildWritingRules(args: { writingStyle: string | null; displayName?: string | null; hasEvidence: boolean }): string {
  const name = (args.displayName ?? "").trim();
  // A learned guide owns the opening, length and shape; only the default spells them out.
  const personalized = Boolean(args.writingStyle?.trim());
  return [
    `Write the actual text now: no headers, no labels, no commentary. ${PLAIN_TEXT_RULE}`,
    personalized
      ? "Open the way my style below opens, and make the first line specific to this request."
      : "Get to the point in the first line, specific to this request. For an application, open on the reader's problem or goal, not a greeting and not my name.",
    args.hasEvidence
      ? "Where it helps, back it with the specific things listed above; cite only what's actually listed and invent nothing beyond it."
      : "Make only concrete, credible claims; invent no facts, names, numbers or results.",
    personalized
      ? "Match the length, paragraphing, and structure my style describes; don't pad."
      : "Keep it as short as it can be: a few lines for a message or reply, usually 120 to 220 words for an email or application.",
    name
      ? `Sign off as ${name} if a sign-off fits; never write a placeholder like "[Your Name]".`
      : 'Don\'t add a sign-off name or any placeholder like "[Your Name]".',
    `Write in my voice and style:\n${args.writingStyle?.trim() || DEFAULT_STYLE}`,
  ].join("\n");
}

// ── Style learning ───────────────────────────────────────────────────────────
// Two steps, run by the user's assistant (lib/style-tasks.ts): note the voice of
// each sample on its own, then fold the notes into one style guide (a fresh
// build, or a merge of new notes into the existing guide).

export function buildSampleAnalysisPrompt(sample: string): string {
  return [
    "Below is something I wrote myself. Study it and note the concrete, repeatable patterns in HOW I write, the things that make my writing recognisably mine. Ignore the subject matter (clients, tools, numbers, projects); you're studying my voice.",
    `My text:\n"""\n${sample.trim()}\n"""`,
    [
      "Report what you actually observe, as short bullets under each heading. Be specific. If a heading isn't evidenced here, write '-' for it.",
      "SENTENCE & RHYTHM: sentence length and how much it varies, fragments, paragraph shape.",
      "PUNCTUATION: em-dashes, commas, parentheses, exclamation marks, ellipses, lists, capitalisation.",
      "VOCABULARY, FAVOURS: words, phrases, or openers I reach for.",
      "VOCABULARY, AVOIDS: words or constructions notably absent.",
      "TONE & STANCE: how formal, warm, or direct; how I position myself relative to the reader.",
      "OPENING: what my first line or two does.",
      "STRUCTURE & FLOW: what each paragraph does and in what order, prose or lists, and how it ends.",
      "DOs: what I consistently do.",
      "DON'Ts: what I consistently avoid.",
      "",
      "Write only the observations under those headings. No preamble, no rewriting.",
    ].join("\n"),
  ].join("\n\n");
}

const GUIDE_SECTIONS =
  "VOICE & TONE, SENTENCE & RHYTHM, PUNCTUATION & WORDS (name the words and habits to avoid), OPENING, STRUCTURE & FLOW, LENGTH";

export function buildStyleSynthesisPrompt(notes: string[]): string {
  return [
    "Below are notes observed across my own writing, one set per piece. Synthesise them into ONE reusable writing-style guide that would make an AI write new text in my exact voice. Merge overlapping notes, keep only patterns that genuinely recur, and write concrete, imperative instructions in the second person.",
    notes.map((o, i) => `Notes ${i + 1}:\n"""\n${o.trim()}\n"""`).join("\n\n"),
    [
      `Cover these as short labelled lines or tight bullets: ${GUIDE_SECTIONS}.`,
      "Keep the whole guide tight and concrete (roughly 120 to 250 words). Only include patterns evidenced in the notes.",
      "Write only the style guide: no preamble, no headings beyond those labels.",
    ].join("\n"),
  ].join("\n\n");
}

export function buildStyleMergePrompt(args: { existingGuide: string; notes: string[] }): string {
  return [
    "Below is my existing writing-style guide, then notes observed in writing of mine you haven't seen before. Update the guide to account for the new notes, and return the COMPLETE updated guide.",
    `My current style guide:\n"""\n${args.existingGuide.trim()}\n"""`,
    args.notes.map((o, i) => `Notes on new piece ${i + 1}:\n"""\n${o.trim()}\n"""`).join("\n\n"),
    [
      "Keep what the new notes agree with or say nothing about. Add a pattern only when the notes evidence it; one piece doing something once is not a habit.",
      "Change an instruction only when the new notes clearly contradict it, and then rewrite that line rather than appending a caveat.",
      `Keep the same sections (${GUIDE_SECTIONS}) and roughly 120 to 250 words.`,
      "Write only the updated style guide: no preamble, no changelog.",
    ].join("\n"),
  ].join("\n\n");
}

const PREAMBLE = /^\s*(?:sure[,!.—-]?\s*)?(?:here(?:'|’)?s|here is)\b[^\n]*:\s*\n+/i;

/** Tidy a style-guide reply. Null when there's nothing usable. */
export function parseStyleGuide(raw: string): string | null {
  const cleaned = raw.replace(PREAMBLE, "").trim().slice(0, MAX_STYLE_LEN).trim();
  return cleaned || null;
}

// ── Clean-up ─────────────────────────────────────────────────────────────────

/** A line that is only a separator, fence or quote wrapper. */
const DELIMITER_LINE = /^\s*(?:(?:[-*_=~—–•·#]\s*){3,}|```[\w-]*|~~~[\w-]*|"""|'''|“““|”””)\s*$/;

/** A line that only labels a section ("Cover Letter:", "**Proposal**", "## Draft 2"). */
const LABEL_LINE = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*\[?\s*(?:(?:the\s+)?(?:final|revised|rewritten|updated|improved|polished|new)\s+)?(?:cover\s+letter|proposal|draft|version|letter|message|opening|intro(?:duction)?|body|closing|call\s+to\s+action|cta|sign[-\s]?off|answer)(?:\s+(?:\d+|[a-c]|one|two|three))?(?:\s+of\s+\d+)?\s*\]?\s*(?:\*\*|__)?\s*:?\s*(?:\*\*|__)?\s*$/i;

/** Commentary chunks a model fences off from the text ("Let me know if…"). */
const META_CHUNK = /^\s*(?:\*\*)?\s*(?:sure\b|here(?:'|’)?s\b|here is\b|notes?\s*:|word count|let me know|feel free|hope this|i(?:'ve| have)?\s+(?:kept|made|changed|tightened|revised|rewrote|adjusted|removed|added)\b|changes?\s*(?:made)?\s*:|what i changed|this (?:version|draft|revision)\b)/i;

const PLACEHOLDER_NAME = /\[\s*(?:your\s+full\s+name|full\s+name|your\s+name|name)\s*\]/gi;
const PLACEHOLDER_LINE = /[^\n]*\[\s*(?:your\s+full\s+name|full\s+name|your\s+name|name)\s*\][^\n]*(?:\n|$)/gi;

/**
 * Make model output paste-ready, with no model call: drop a "Here's the draft:"
 * preamble, commentary fenced off by separators, label and delimiter lines and
 * markdown markers; replace a "[Your Name]" placeholder with the real name (or
 * drop its line); and, unless the user writes with them, turn em-dashes into commas.
 */
export function cleanDraft(text: string, opts: { name?: string | null; usesEmDash?: boolean } = {}): string {
  const name = (opts.name ?? "").trim();
  let out = text.trim().replace(PREAMBLE, "");

  const chunks = out.split(/\n[^\S\n]*(?:(?:[-*_=~—–]\s*){3,}|```[\w-]*|~~~|"""|''')[^\S\n]*(?:\n|$)/);
  if (chunks.length > 1) {
    const kept = chunks.filter((c) => c.trim() && !META_CHUNK.test(c));
    if (kept.length > 0) out = kept.join("\n\n");
  }

  out = name ? out.replace(PLACEHOLDER_NAME, name) : out.replace(PLACEHOLDER_LINE, "");

  out = out
    .split("\n")
    .filter((l) => !DELIMITER_LINE.test(l) && !LABEL_LINE.test(l))
    .map((l) => l
      .replace(/^(\s*)#{1,6}\s+/, "$1")
      .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, "$1")
      .replace(/__(?=\S)([^_\n]*?\S)__/g, "$1")
      .replace(/^\s*>\s?/, ""))
    .join("\n");
  if (!opts.usesEmDash) out = out.replace(/[^\S\n]*—[^\S\n]*/g, ", ");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
