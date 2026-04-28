import { describe, test, expect } from "vitest";
import { mapHttpToMcpError } from "../src/errors.ts";

describe("mapHttpToMcpError", () => {
  test("4xx with message in body returns InvalidParams with body data", () => {
    const result = mapHttpToMcpError(400, { message: "Slot ya no disponible" });
    expect(result.code).toBe(-32602);
    expect(result.message).toBe("Slot ya no disponible");
    expect(result.data).toEqual({ message: "Slot ya no disponible" });
  });

  test("4xx with error field falls back to error", () => {
    const result = mapHttpToMcpError(400, { error: "Bad input" });
    expect(result.code).toBe(-32602);
    expect(result.message).toBe("Bad input");
  });

  test("4xx without message defaults to 'Bad request'", () => {
    const result = mapHttpToMcpError(404, {});
    expect(result.code).toBe(-32602);
    expect(result.message).toBe("Bad request");
  });

  test("5xx returns generic InternalError, hides body", () => {
    const result = mapHttpToMcpError(500, { stack: "secret stack" });
    expect(result.code).toBe(-32603);
    expect(result.message).toBe("Internal error");
    expect(result.data).toBeUndefined();
  });

  test("status 0 (timeout sentinel) returns timeout error", () => {
    const result = mapHttpToMcpError(0);
    expect(result.code).toBe(-32603);
    expect(result.message).toBe("Edge function timeout");
  });

  test("2xx throws (caller bug)", () => {
    expect(() => mapHttpToMcpError(200, { ok: true })).toThrow();
  });
});
