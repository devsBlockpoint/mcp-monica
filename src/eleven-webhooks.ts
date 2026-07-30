import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Helpers for the two ElevenLabs Conversational AI webhooks that mcp-monica
 * hosts for the Mónica voice agent:
 *   - conversation-initiation: caller_id -> patient lookup -> dynamic_variables
 *   - post-call: verify HMAC signature, then persist/forward the outcome
 */

/** Extract a Mexican national (10-digit) phone from an ElevenLabs caller_id. */
export function normalizeCallerId(caller?: string): string | null {
  if (!caller) return null;
  const digits = caller.replace(/\D/g, "");
  if (!digits) return null;
  // Drop a leading 52 country code from a 12-digit number -> 10-digit national.
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  return digits;
}

export interface InitResponse {
  type: "conversation_initiation_client_data";
  dynamic_variables: Record<string, string>;
}

/**
 * Map a search-patient result (the `pacientes` array, untyped as it comes from
 * an edge function) into the ElevenLabs initiation response.
 */
export function buildInitResponse(patients: unknown): InitResponse {
  const list = Array.isArray(patients) ? patients : [];
  const p = (list[0] ?? null) as Record<string, unknown> | null;
  const name = p && typeof p.nombre_completo === "string" ? p.nombre_completo : "";
  const id = p && typeof p.id === "string" ? p.id : "";
  return {
    type: "conversation_initiation_client_data",
    dynamic_variables: {
      patient_known: p ? "true" : "false",
      patient_name: name,
      patient_id: id,
    },
  };
}

/**
 * Verify an ElevenLabs post-call webhook signature.
 * Header format: `t=<unix_seconds>,v0=<hex_hmac_sha256>` where the HMAC is over
 * `${t}.${rawBody}` keyed by the workspace webhook secret. Rejects stale
 * timestamps (replay protection). Opt-in: when no secret is configured the
 * check is disabled (returns true) so the endpoint works before the secret is
 * set — set ELEVENLABS_WEBHOOK_SECRET in production to enforce it.
 */
export function verifyElevenSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
  nowMs: number,
  toleranceSec: number,
): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const kv of signatureHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i === -1) continue;
    parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const t = Number(parts.t);
  const v0 = parts.v0;
  if (!Number.isFinite(t) || !v0) return false;
  if (Math.abs(nowMs / 1000 - t) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return constantTimeEquals(expected, v0);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

