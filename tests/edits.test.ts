import { describe, expect, it } from "vitest";
import { editedMeaningfully, wordsChanged } from "../apps/web/src/lib/edits";

const draft =
  "Hi Dana, I read your post about the billing jobs failing at night. I moved a similar system to a queue last year and the failures stopped. I can start on Monday and would send a short plan first.";

describe("telling whether the user changed a draft", () => {
  it("counts words added and removed, ignoring case and punctuation", () => {
    expect(wordsChanged("We moved it.", "we moved it")).toBe(0);
    expect(wordsChanged("We moved it to a queue.", "We moved it to a plain queue.")).toBe(1);
    expect(wordsChanged("one two three", "one four three")).toBe(2);
  });

  it("ignores typo fixes, punctuation and spacing", () => {
    expect(editedMeaningfully(draft, draft)).toBe(false);
    expect(editedMeaningfully(draft, draft.replace("Monday", "monday").replace(/\. /g, ".\n\n"))).toBe(false);
    expect(editedMeaningfully(draft, draft.replace("similar", "simlar"))).toBe(false);
  });

  it("sees reworded sentences and added lines", () => {
    const reworded = draft.replace("I can start on Monday and would send a short plan first.", "Happy to start this week. First thing I'd send you is a one-page plan.");
    expect(editedMeaningfully(draft, reworded)).toBe(true);
    expect(editedMeaningfully(draft, `${draft}\n\nI've also run on-call for a payments team, so night failures are familiar.`)).toBe(true);
  });

  it("needs a few words changed, and a share of a long text", () => {
    expect(editedMeaningfully("Short note here.", "Short reply here.")).toBe(false);
    const long = Array.from({ length: 40 }, () => draft).join(" ");
    expect(editedMeaningfully(long, `${long} Thanks for reading this.`)).toBe(false);
  });

  it("never offers an empty text", () => {
    expect(editedMeaningfully(draft, "   ")).toBe(false);
  });
});
