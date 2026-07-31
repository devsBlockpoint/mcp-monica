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
  test("drops the legacy 521 WhatsApp-MX prefix", () => {
    // This one used to fall through untouched, so the same caller arriving as
    // 521… and as 52… produced two different channel_identities rows.
    expect(normalizeCallerId("5216682680353")).toBe("6682680353");
    expect(normalizeCallerId("+521 668 268 0353")).toBe("6682680353");
  });
  test("drops a bare leading 1 on an 11-digit number", () => {
    expect(normalizeCallerId("16682680353")).toBe("6682680353");
  });
  test("every MX shape collapses to one identity key", () => {
    // The whole point: one person, one external_id, whatever the carrier sends.
    const formas = ["6682680353", "526682680353", "5216682680353", "16682680353", "+52 668-268-0353"];
    const claves = new Set(formas.map((f) => normalizeCallerId(f)));
    expect(claves.size, `se generaron claves distintas: ${[...claves].join(", ")}`).toBe(1);
  });
  test("returns null for empty / anonymous / undefined", () => {
    expect(normalizeCallerId("")).toBeNull();
    expect(normalizeCallerId("anonymous")).toBeNull();
    expect(normalizeCallerId(undefined)).toBeNull();
  });
});

describe("buildInitResponse", () => {
  const conocida = {
    patient_known: true,
    patient_id: "p1",
    patient_name: "María López",
    patient_context:
      "CONTEXTO DE MARÍA LÓPEZ (de contactos anteriores):\nÚltimo contacto: hace 3 días por WhatsApp.",
  };

  test("returns patient dynamic_variables when a match is found", () => {
    const r = buildInitResponse(conocida);
    expect(r.type).toBe("conversation_initiation_client_data");
    expect(r.dynamic_variables.patient_known).toBe("true");
    expect(r.dynamic_variables.patient_name).toBe("María López");
    expect(r.dynamic_variables.patient_id).toBe("p1");
  });

  test("carries the pre-rendered living record through to the agent", () => {
    // This is the wiring that makes A01 real: without it the record exists in
    // the database but never reaches anything Mónica reads.
    const r = buildInitResponse(conocida);
    expect(r.dynamic_variables.patient_context).toContain("hace 3 días");
  });

  test("returns patient_known=false with empty fields when no match", () => {
    const r = buildInitResponse({ patient_known: false, patient_context: "" });
    expect(r.dynamic_variables.patient_known).toBe("false");
    expect(r.dynamic_variables.patient_name).toBe("");
    expect(r.dynamic_variables.patient_id).toBe("");
    expect(r.dynamic_variables.patient_context).toBe("");
  });

  test("every variable is a string even when the edge function fails", () => {
    // If the call errored, ctx is undefined. Leaving a variable undefined makes
    // ElevenLabs substitute the literal "{{patient_context}}" into speech —
    // Mónica would read the template out loud to the caller.
    const r = buildInitResponse(undefined);
    for (const [k, v] of Object.entries(r.dynamic_variables)) {
      expect(typeof v, `dynamic_variables.${k}`).toBe("string");
    }
    expect(r.dynamic_variables.patient_known).toBe("false");
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

