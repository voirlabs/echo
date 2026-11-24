import { describe, expect, it } from "vitest";
import { safeNext } from "../apps/web/src/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/oauth/authorize?client_id=x")).toBe("/oauth/authorize?client_id=x");
  });
  it("refuses open redirects", () => {
    for (const v of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, "/x\r\nSet-Cookie: a=b"]) {
      expect(safeNext(v as string | null, "/home")).toBe("/home");
    }
  });
});
