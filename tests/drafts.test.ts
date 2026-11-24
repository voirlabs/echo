import { describe, expect, it } from "vitest";
import { draftTarget, normalizeUrl } from "../apps/web/src/lib/draft-key";
import { toDraftKind } from "../apps/web/src/lib/writing-style";

describe("normalizeUrl", () => {
  it("drops the fragment, tracking params and a trailing slash, and sorts the query", () => {
    expect(normalizeUrl("https://Jobs.Example.com/apply/42/?utm_source=x&b=2&a=1#form")).toBe("https://jobs.example.com/apply/42?a=1&b=2");
  });
  it("keeps the root path and rejects non-web links", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("draftTarget", () => {
  it("gives every other draft its own key, so one page can hold several", () => {
    const a = draftTarget("https://boards.example.com/acme/jobs/9?utm_campaign=x");
    const b = draftTarget("https://boards.example.com/acme/jobs/9/#apply");
    expect(a?.key).toMatch(/^d-/);
    expect(a?.key).not.toBe(b?.key);
    expect(a?.url).toBe("https://boards.example.com/acme/jobs/9");
    expect(a?.url).toBe(b?.url);
  });
  it("makes a standalone draft without a link, and refuses a bad one", () => {
    expect(draftTarget("")).toMatchObject({ url: "" });
    expect(draftTarget(undefined)?.key).toMatch(/^d-/);
    expect(draftTarget("ftp://example.com/x")).toBeNull();
  });
});

describe("draft kinds", () => {
  it("maps the names older clients send", () => {
    expect(toDraftKind("proposal")).toBe("application");
    expect(toDraftKind("cover-letter")).toBe("application");
    expect(toDraftKind("text")).toBe("other");
    expect(toDraftKind("post")).toBe("post");
    expect(toDraftKind(undefined)).toBeUndefined();
  });
});
