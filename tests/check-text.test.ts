import { describe, expect, it } from "vitest";
import { checkStyle } from "../apps/web/src/lib/writing-style";

describe("checking any selected text", () => {
  const long = Array.from({ length: 60 }, () => "We moved the billing jobs to a queue and the failures stopped.").join(" ");

  it("checks the voice but not length or opening", () => {
    expect(checkStyle(`Hi there, ${long}`, { kind: "other" })).toEqual([]);
    expect(checkStyle(long, { kind: "message" }).some((i) => i.includes("Tighten"))).toBe(true);
  });

  it("still flags AI tells and em-dashes", () => {
    const issues = checkStyle("We leverage a seamless pipeline — it just works.", { kind: "other" });
    expect(issues.some((i) => i.includes("leverage"))).toBe(true);
    expect(issues.some((i) => i.includes("em-dash"))).toBe(true);
  });
});
