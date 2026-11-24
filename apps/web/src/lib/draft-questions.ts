// Application questions and their drafted answers, stored on Draft.questions as
// [{ question, answer }]. The column is untyped Json and the payload comes from
// an assistant or a browser, so every read and write goes through normalizeQuestions.

interface DraftQuestion {
  question: string;
  answer: string;
}

const MAX_QUESTIONS = 10;
const MAX_QUESTION_LEN = 1000;
const MAX_ANSWER_LEN = 5000;

export function normalizeQuestions(raw: unknown): DraftQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: DraftQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const question = String(r.question ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LEN);
    // An answer may be blank; a question may not, since it identifies the row.
    if (!question) continue;
    const answer = String(r.answer ?? "").trim().slice(0, MAX_ANSWER_LEN);
    out.push({ question, answer });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}
