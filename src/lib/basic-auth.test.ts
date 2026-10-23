import { describe, expect, it } from "vitest";
import { isAuthorized, isHealthCheck, safeEqual } from "./basic-auth";

const header = (credentials: string) => `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;

describe("basic auth gate", () => {
  it("accepts exactly the expected user and password", () => {
    expect(isAuthorized(header("demo:s3cret"), "demo:s3cret")).toBe(true);
    expect(isAuthorized(`basic ${Buffer.from("demo:s3cret").toString("base64")}`, "demo:s3cret")).toBe(true); // scheme is case-insensitive
  });

  it("rejects a wrong password, a wrong user, a prefix and an extension", () => {
    for (const wrong of ["demo:nope", "other:s3cret", "demo:s3cre", "demo:s3crets", "demo", ":", ""]) {
      expect(isAuthorized(header(wrong), "demo:s3cret"), wrong).toBe(false);
    }
  });

  it("rejects missing, malformed and non-basic headers", () => {
    expect(isAuthorized(null, "demo:s3cret")).toBe(false);
    expect(isAuthorized("", "demo:s3cret")).toBe(false);
    expect(isAuthorized("Bearer abc", "demo:s3cret")).toBe(false);
    expect(isAuthorized("Basic !!!not-base64!!!", "demo:s3cret")).toBe(false);
  });

  it("handles passwords with colons and non-ASCII characters", () => {
    expect(isAuthorized(header("demo:pa:ss"), "demo:pa:ss")).toBe(true);
    expect(isAuthorized(header("demo:contraseña-ñ"), "demo:contraseña-ñ")).toBe(true);
    expect(isAuthorized(header("demo:contrasena-n"), "demo:contraseña-ñ")).toBe(false);
  });

  it("safeEqual compares whole strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("only the health check stays open", () => {
    expect(isHealthCheck("/api/health")).toBe(true);
    expect(isHealthCheck("/api/admin/at-risk")).toBe(false);
    expect(isHealthCheck("/es/admin")).toBe(false);
  });
});
