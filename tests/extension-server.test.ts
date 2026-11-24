import { describe, expect, it } from "vitest";
import { originPattern, parseServerUrl } from "../apps/extension/src/shared/server";

describe("parseServerUrl", () => {
  it("adds https to a bare host and trims trailing slashes", () => {
    expect(parseServerUrl(" echo.example.com/ ")).toEqual({ ok: true, url: "https://echo.example.com", origin: "https://echo.example.com" });
    expect(parseServerUrl("https://example.com/echo/")).toMatchObject({ ok: true, url: "https://example.com/echo" });
  });

  it("allows plain http only for this computer", () => {
    expect(parseServerUrl("http://localhost:3000")).toMatchObject({ ok: true, url: "http://localhost:3000" });
    expect(parseServerUrl("http://echo.example.com")).toMatchObject({ ok: false });
    expect(parseServerUrl("localhost:3400")).toMatchObject({ ok: true, url: "http://localhost:3400" });
  });

  it("refuses empty input, other schemes and credentials in the address", () => {
    expect(parseServerUrl("")).toMatchObject({ ok: false });
    expect(parseServerUrl("ftp://echo.example.com")).toMatchObject({ ok: false });
    expect(parseServerUrl("https://user:pw@echo.example.com")).toMatchObject({ ok: false });
  });
});

describe("originPattern", () => {
  it("asks for the host on any port", () => {
    expect(originPattern("http://localhost:3400")).toBe("http://localhost/*");
    expect(originPattern("https://echo.example.com/sub")).toBe("https://echo.example.com/*");
  });
});
