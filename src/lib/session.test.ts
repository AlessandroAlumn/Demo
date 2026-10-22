import { describe, expect, it } from "vitest";
import { normalizeUsername, signSession, verifySession } from "./session";

const SECRET = "test-secret-with-16-plus-chars";
const NOW = 1_800_000_000;

describe("session cookie", () => {
  it("round-trips a signed session", () => {
    const token = signSession({ uid: "u1", role: "donor" }, SECRET, NOW);
    expect(verifySession(token, SECRET, NOW + 10)).toEqual({
      uid: "u1",
      role: "donor",
      exp: NOW + 7 * 24 * 60 * 60,
    });
  });

  it("rejects a tampered payload (e.g. donor edited into admin)", () => {
    const token = signSession({ uid: "u1", role: "donor" }, SECRET, NOW);
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ uid: "u1", role: "admin", exp: NOW + 999_999 }),
    ).toString("base64url");
    expect(verifySession(`${forgedBody}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signSession({ uid: "u1", role: "admin" }, "another-secret-16-chars-x", NOW);
    expect(verifySession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects expired sessions", () => {
    const token = signSession({ uid: "u1", role: "donor", exp: NOW + 5 }, SECRET, NOW);
    expect(verifySession(token, SECRET, NOW + 4)).not.toBeNull();
    expect(verifySession(token, SECRET, NOW + 5)).toBeNull();
  });

  it("rejects garbage", () => {
    for (const bad of [undefined, null, "", "abc", "a.b.c", "x.y"]) {
      expect(verifySession(bad, SECRET, NOW)).toBeNull();
    }
  });
});

describe("normalizeUsername", () => {
  it("is case-insensitive and trims", () => {
    expect(normalizeUsername("  USER1 ")).toBe("user1");
    expect(normalizeUsername("User10")).not.toBe(normalizeUsername("User1"));
  });
});
