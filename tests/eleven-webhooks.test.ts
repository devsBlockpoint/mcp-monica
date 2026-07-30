import { describe, test, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  normalizeCallerId,
  buildInitResponse,
  verifyElevenSignature,
} from "../src/eleven-webhooks.ts";

function sign(body: string, secret: string, t: number): string {
  const h = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v0=${h}`;
}

describe("normalizeCallerId", () => {
  test("strips '+' and non-digits", () => {
    expect(normalizeCallerId("+52 668 268 0353")).toBe("6682680353");
  });
  test("drops the 52 country code from a 12-digit MX number", () => {
    expect(normalizeCallerId("526682680353")).toBe("6682680353");
  });
  test("keeps a 10-digit national number", () => {
    expect(normalizeCallerId("6682680353")).toBe("6682680353");
  });
  test("returns null for empty / anonymous / undefined", () => {
    expect(normalizeCallerId("")).toBeNull();
    expect(normalizeCallerId("anonymous")).toBeNull();
    expect(normalizeCallerId(undefined)).toBeNull();
  });
});

describe("buildInitResponse", () => {
  test("returns patient dynamic_variables when a match is found", () => {
    const r = buildInitResponse([
      { id: "p1", nombre_completo: "María López", whatsapp: "6682680353" },
    ]);
    expect(r.type).toBe("conversation_initiation_client_data");
    expect(r.dynamic_variables.patient_known).toBe("true");
    expect(r.dynamic_variables.patient_name).toBe("María López");
    expect(r.dynamic_variables.patient_id).toBe("p1");
  });
  test("returns patient_known=false with empty fields when no match", () => {
    const r = buildInitResponse([]);
    expect(r.dynamic_variables.patient_known).toBe("false");
    expect(r.dynamic_variables.patient_name).toBe("");
    expect(r.dynamic_variables.patient_id).toBe("");
  });
});

describe("verifyElevenSignature", () => {
  const secret = "whsec_test";
  const body = '{"type":"post_call_transcription","data":{"conversation_id":"c1"}}';
  const nowMs = 1_700_000_000_000;
  const t = Math.floor(nowMs / 1000);

  test("accepts a valid signature within tolerance", () => {
    expect(verifyElevenSignature(body, sign(body, secret, t), secret, nowMs, 1800)).toBe(true);
  });
  test("rejects a tampered body", () => {
    expect(verifyElevenSignature(body + "x", sign(body, secret, t), secret, nowMs, 1800)).toBe(
      false,
    );
  });
  test("rejects a wrong secret", () => {
    expect(verifyElevenSignature(body, sign(body, "other-secret", t), secret, nowMs, 1800)).toBe(
      false,
    );
  });
  test("rejects a stale timestamp (replay protection)", () => {
    expect(verifyElevenSignature(body, sign(body, secret, t - 3600), secret, nowMs, 1800)).toBe(
      false,
    );
  });
  test("rejects a malformed / empty signature header", () => {
    expect(verifyElevenSignature(body, "garbage", secret, nowMs, 1800)).toBe(false);
    expect(verifyElevenSignature(body, undefined, secret, nowMs, 1800)).toBe(false);
  });
  test("is disabled (returns true) when no secret is configured", () => {
    expect(verifyElevenSignature(body, "anything", undefined, nowMs, 1800)).toBe(true);
  });
});

