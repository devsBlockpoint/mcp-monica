import { describe, test, expect } from "vitest";
import { isAuthorized } from "../src/auth.ts";

describe("isAuthorized", () => {
  // Opt-in: when no token is configured, the guard is disabled so local dev
  // and the current private-network nanoclaw call keep working unchanged.
  test("authorizes any request when no token is configured", () => {
    expect(isAuthorized(undefined, undefined)).toBe(true);
    expect(isAuthorized("anything", "")).toBe(true);
  });

  test("authorizes a Bearer header matching the configured token", () => {
    expect(isAuthorized("Bearer s3cret-token", "s3cret-token")).toBe(true);
  });

  // ElevenLabs' secret_token becomes the raw Authorization header value
  // (no scheme), so a bare token must also be accepted.
  test("authorizes a raw token header without the Bearer scheme", () => {
    expect(isAuthorized("s3cret-token", "s3cret-token")).toBe(true);
  });

  test("accepts a case-insensitive bearer scheme", () => {
    expect(isAuthorized("bearer s3cret-token", "s3cret-token")).toBe(true);
  });

  test("rejects a wrong token", () => {
    expect(isAuthorized("Bearer wrong", "s3cret-token")).toBe(false);
  });

  test("rejects when the header is missing but a token is required", () => {
    expect(isAuthorized(undefined, "s3cret-token")).toBe(false);
  });

  // Length mismatch must not throw (timing-safe compare) and must be rejected.
  test("rejects a token that is a prefix of the expected token", () => {
    expect(isAuthorized("Bearer s3cret-toke", "s3cret-token")).toBe(false);
  });
});
