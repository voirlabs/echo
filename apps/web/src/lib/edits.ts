// Whether the user changed a generated draft enough that their version is worth
// learning from. Pure, with no imports.

const MAX_WORDS = 3000;

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean)
    .slice(0, MAX_WORDS);

/** Words added or removed between the two texts (a word-level diff, ignoring case and punctuation). */
export function wordsChanged(before: string, after: string): number {
  const a = words(before);
  const b = words(after);
  // Longest common subsequence, one row at a time.
  let prev = new Uint16Array(b.length + 1);
  let row = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, row[j - 1]!);
    }
    [prev, row] = [row, prev];
  }
  const common = prev[b.length]!;
  return a.length - common + (b.length - common);
}

/**
 * True when the final text differs meaningfully from what was generated: a few
 * words reworded, not a fixed typo or changed punctuation. At least 4 words
 * added or removed, and at least 5% of all the words.
 */
export function editedMeaningfully(generated: string, final: string): boolean {
  if (!final.trim()) return false;
  const changed = wordsChanged(generated, final);
  const total = words(generated).length + words(final).length;
  return changed >= 4 && changed / Math.max(total, 1) >= 0.05;
}
