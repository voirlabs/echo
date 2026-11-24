import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp } from "../apps/web/src/lib/client-ip";
import { rateLimit } from "../apps/web/src/lib/rate-limit";
import { normalizeQuestions } from "../apps/web/src/lib/draft-questions";
import { cleanDraft } from "../apps/web/src/lib/writing-prompts";
import { checkStyle } from "../apps/web/src/lib/writing-style";

describe("clientIp", () => {
  const h = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});
  it("takes the address the trusted proxy added, not what the client sent", () => {
    expect(clientIp(h("6.6.6.6, 203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIp(h("6.6.6.6, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
  });
  it("shares one bucket without a proxy, and copes with a missing header", () => {
    expect(clientIp(h("1.2.3.4"), 0)).toBe("direct");
    expect(clientIp(h(), 1)).toBe("unknown");
    expect(clientIp(h("1.2.3.4"), 3)).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("allows max requests per window, then reports a wait", () => {
    const id = `t-${Math.random()}`;
    expect(rateLimit(id, 2, 60_000).ok).toBe(true);
    expect(rateLimit(id, 2, 60_000).ok).toBe(true);
    const third = rateLimit(id, 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });
});

describe("normalizeQuestions", () => {
  it("keeps question/answer pairs and drops junk", () => {
    const q = normalizeQuestions([{ question: "Describe similar work", answer: "Stripe billing." }, 5, { answer: "x" }]);
    expect(q).toHaveLength(1);
    expect(q[0].question).toBe("Describe similar work");
    expect(normalizeQuestions("x")).toEqual([]);
  });
});

describe("checkStyle", () => {
  it("flags a greeting opener on an application, not elsewhere", () => {
    expect(checkStyle("Hi there, I can help with your project.", { kind: "application" }).join(" ")).toMatch(/greeting/i);
    expect(checkStyle("Hi there, I can help with your project.", { kind: "email" }).join(" ")).not.toMatch(/greeting/i);
  });
  it("accepts a greeting when that is the writer's habit", () => {
    expect(checkStyle("Hi there, your checkout drops sessions.", { kind: "application", opening: "greeting" }).join(" ")).not.toMatch(/greeting/i);
  });
  it("keeps AI-tell words the writer uses in their own samples", () => {
    const text = "Your pipeline needs a robust solution and we can leverage the queue you already run.";
    expect(checkStyle(text).join(" ")).toMatch(/leverage/);
    expect(checkStyle(text, { allowedTells: ["leverage", "robust solution"] }).join(" ")).not.toMatch(/AI-sounding/);
  });
  it("returns nothing for empty text", () => {
    expect(checkStyle("   ")).toEqual([]);
  });
  it("lets a message open with a greeting and caps its length", () => {
    expect(checkStyle("Hi Sam, thanks for the quick reply.", { kind: "message" }).join(" ")).not.toMatch(/greeting/i);
    const long = Array.from({ length: 200 }, () => "word").join(" ");
    expect(checkStyle(long, { kind: "message" }).join(" ")).toMatch(/under 150 words/);
    expect(checkStyle(long, { kind: "application" }).join(" ")).not.toMatch(/under/);
  });
});

describe("cleanDraft", () => {
  it("drops a preamble, labels and markdown, and fills the name", () => {
    const out = cleanDraft("Here's the draft:\n\n**Cover letter**\nYour checkout drops sessions — I can fix it.\n\n[Your Name]", { name: "Sam" });
    expect(out).toBe("Your checkout drops sessions, I can fix it.\n\nSam");
  });
  it("keeps em-dashes for a writer who uses them", () => {
    expect(cleanDraft("A — B", { usesEmDash: true })).toBe("A — B");
  });
});

describe("site config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("hides optional links when unset and trims trailing slashes", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com/");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "");
    const site = await import("../apps/web/src/lib/site");
    expect(site.APP_URL).toBe("https://app.example.com");
    expect(site.TERMS_URL).toBeNull();
    expect(site.PRIVACY_URL).toBeNull();
  });
  it("reads the legal links from env", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "https://example.com/privacy/");
    const site = await import("../apps/web/src/lib/site");
    expect(site.PRIVACY_URL).toBe("https://example.com/privacy");
  });
});

describe("page fields", () => {
  it("keeps well-formed fields, drops bad ones, and caps values", async () => {
    const { normalizeFields } = await import("../apps/web/src/lib/page-fields");
    const fields = normalizeFields([
      { id: "f1", label: " Why   this role? ", kind: "long", maxLength: 500, required: true, selector: "#why", value: "Because." },
      { id: "f1", label: "duplicate id", selector: "#x" },
      { id: "nope", label: "bad id", selector: "#y" },
      { id: "f2", label: "No selector" },
      { id: "f3", label: "Email", kind: "weird", selector: "input[name=email]", value: "x".repeat(20000) },
      "junk",
    ]);
    expect(fields.map((f) => f.id)).toEqual(["f1", "f3"]);
    expect(fields[0]).toMatchObject({ label: "Why this role?", kind: "long", maxLength: 500, required: true });
    expect(fields[1]).toMatchObject({ kind: "long", maxLength: null });
    expect(fields[1]!.value.length).toBe(10000);
  });
  it("turns the values into the draft's text", async () => {
    const { fieldsText } = await import("../apps/web/src/lib/page-fields");
    const f = (id: string, label: string, value: string) => ({ id, label, kind: "long" as const, maxLength: null, required: false, selector: "#" + id, value });
    expect(fieldsText([f("f1", "Cover letter", "Hello."), f("f2", "Phone", "")])).toBe("Hello.");
    expect(fieldsText([f("f1", "Why us?", "A."), f("f2", "Why you?", "B.")])).toBe("Why us?\nA.\n\nWhy you?\nB.");
  });
});
