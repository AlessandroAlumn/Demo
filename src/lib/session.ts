// Stateless signed sessions: `<base64url(json)>.<hmac-sha256>`. Pure functions, no Next.js imports,
// so they can be unit-tested. The cookie handling lives in auth.ts.
//
// The prototype has no passwords, but the cookie is still signed so it cannot be forged by editing it.

import { createHmac, timingSafeEqual } from "node:crypto";

export { SESSION_COOKIE } from "./session-cookie";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  /** User.id */
  uid: string;
  role: "donor" | "admin";
  /** Expiry, seconds since epoch. */
  exp: number;
};

const DEV_FALLBACK_SECRET = "alumnusb-dev-only-secret-change-me";

export function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (16+ characters) in production");
  }
  return DEV_FALLBACK_SECRET;
}

const sign = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function signSession(
  payload: Omit<SessionPayload, "exp"> & { exp?: number },
  secret = getSecret(),
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const full: SessionPayload = {
    uid: payload.uid,
    role: payload.role,
    exp: payload.exp ?? nowSeconds + SESSION_MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(
  token: string | undefined | null,
  secret = getSecret(),
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.uid !== "string" || (payload.role !== "donor" && payload.role !== "admin")) return null;
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Login names match case-insensitively ("user1" = "User1") and ignore surrounding spaces. */
export const normalizeUsername = (input: string) => input.trim().toLowerCase();
