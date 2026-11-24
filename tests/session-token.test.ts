import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  createDeviceToken,
  passwordMatches,
  readDeviceToken,
  readSessionToken,
  setupProblem,
  SESSION_MAX_AGE_SECONDS,
} from "../apps/web/src/lib/session-token";

const SECRET = "a".repeat(32);

describe("owner session", () => {
  const saved = { password: process.env.ADMIN_PASSWORD, secret: process.env.SESSION_SECRET };
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct horse";
    process.env.SESSION_SECRET = SECRET;
  });
  const EPOCH = "0b7f3a52-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  afterEach(() => {
    for (const [name, value] of [["ADMIN_PASSWORD", saved.password], ["SESSION_SECRET", saved.secret]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("explains what is missing before anyone can sign in", () => {
    expect(setupProblem()).toBeNull();
    process.env.SESSION_SECRET = "short";
    expect(setupProblem()).toMatch(/SESSION_SECRET/);
    delete process.env.ADMIN_PASSWORD;
    expect(setupProblem()).toMatch(/ADMIN_PASSWORD/);
  });

  it("refuses a password shorter than 12 characters", async () => {
    process.env.ADMIN_PASSWORD = "short pass1";
    expect(setupProblem()).toMatch(/too short.*openssl rand -base64 18/);
    expect(await passwordMatches("short pass1")).toBe(false);
    expect(await createSessionToken(EPOCH)).toBeNull();
  });

  it("checks the password", async () => {
    expect(await passwordMatches("correct horse")).toBe(true);
    expect(await passwordMatches("correct hors")).toBe(false);
    expect(await passwordMatches("")).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(await passwordMatches("")).toBe(false);
  });

  it("issues a token that carries its epoch until it expires", async () => {
    const now = Date.now();
    const token = await createSessionToken(EPOCH, now);
    expect(token).toBeTruthy();
    expect(await readSessionToken(token, now)).toBe(EPOCH);
    expect(await readSessionToken(token, now + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBeNull();
  });

  it("refuses tampered, malformed, old-format or missing tokens", async () => {
    const token = (await createSessionToken(EPOCH))!;
    const [v, epoch, exp, sig] = token.split(".");
    expect(await readSessionToken(`${v}.${epoch}.${Number(exp) + 1000}.${sig}`)).toBeNull();
    expect(await readSessionToken(`${v}.other-epoch.${exp}.${sig}`)).toBeNull();
    expect(await readSessionToken(`${token}.extra`)).toBeNull();
    expect(await readSessionToken("v1.abc.def")).toBeNull();
    expect(await readSessionToken("")).toBeNull();
    expect(await readSessionToken(undefined)).toBeNull();
    expect(await createSessionToken("not.an.epoch")).toBeNull();
    // A device token is signed with the same key but is never a session.
    expect(await readSessionToken(await createDeviceToken())).toBeNull();
  });

  it("signs everyone out when the password or secret changes", async () => {
    const token = await createSessionToken(EPOCH);
    process.env.ADMIN_PASSWORD = "a new password";
    expect(await readSessionToken(token)).toBeNull();
    process.env.ADMIN_PASSWORD = "correct horse";
    process.env.SESSION_SECRET = "b".repeat(32);
    expect(await readSessionToken(token)).toBeNull();
  });

  it("issues device tokens that can't be forged", async () => {
    const device = (await createDeviceToken())!;
    expect(await readDeviceToken(device)).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readDeviceToken(device.replace(/^d1\.[^.]+/, "d1.made-up"))).toBeNull();
    expect(await readDeviceToken(await createSessionToken(EPOCH))).toBeNull();
  });

  it("issues nothing when the instance is not set up", async () => {
    delete process.env.SESSION_SECRET;
    expect(await createSessionToken(EPOCH)).toBeNull();
  });
});
