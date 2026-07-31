import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Helpers for the two ElevenLabs Conversational AI webhooks that mcp-monica
 * hosts for the Mónica voice agent:
 *   - conversation-initiation: caller_id -> patient lookup -> dynamic_variables
 *   - post-call: verify HMAC signature, then persist/forward the outcome
 */

/**
 * Extract a Mexican national (10-digit) phone from an ElevenLabs caller_id.
 *
 * This must produce the SAME canonical form as `normalizarTelefono()` in
 * eleve's `supabase/functions/_shared/telefono.ts`, because whatever comes out
 * of here becomes the `external_id` in `channel_identities`, which has
 * UNIQUE(channel, external_id). Two shapes for the same person means two
 * parallel identities, and the crosswalk stops working.
 *
 * It is duplicated rather than imported because mcp-monica is a separate repo
 * with its own Docker build context — there is no import path to eleve. Keep
 * the two in sync; the shapes are covered by tests on both sides.
 *
 * Previously this only understood a 12-digit `52` prefix and missed the
 * 13-digit `521` legacy WhatsApp-MX prefix, so the same caller arriving in the
 * two formats produced two different identities.
 */
export function normalizeCallerId(caller?: string): string | null {
  if (!caller) return null;
  const d = caller.replace(/\D/g, "");
  if (!d) return null;
  // 52 + 1 + national (13) — legacy WhatsApp MX shape.
  if (d.length === 13 && d.startsWith("521")) return d.slice(3);
  // 52 + national (12)
  if (d.length === 12 && d.startsWith("52")) return d.slice(2);
  // 1 + national (11)
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  // Already national, or foreign/partial: returned as-is, never guessed.
  return d;
}

export interface InitResponse {
  type: "conversation_initiation_client_data";
  dynamic_variables: Record<string, string>;
}

/**
 * Map a `patient-context` edge-function result into the ElevenLabs initiation
 * response.
 *
 * `patient_context` is the pre-rendered "who is this and where are they at"
 * block (A01, the living record). It is rendered edge-side on purpose: the same
 * renderer serves the text channel too, so both channels read the exact same
 * words. Rendering it here would fork it into two versions that drift.
 *
 * ElevenLabs dynamic variables must be strings — an absent value has to be ""
 * rather than null/undefined, or the substitution leaks the literal token into
 * what Mónica says out loud.
 */
export function buildInitResponse(ctx: unknown): InitResponse {
  const c = (ctx ?? null) as Record<string, unknown> | null;
  const known = c?.patient_known === true;
  return {
    type: "conversation_initiation_client_data",
    dynamic_variables: {
      patient_known: known ? "true" : "false",
      patient_name: typeof c?.patient_name === "string" ? c.patient_name : "",
      patient_id: typeof c?.patient_id === "string" ? c.patient_id : "",
      // Empty string when there is nothing worth saying. The prompt is written
      // so that an empty block simply disappears instead of being narrated.
      patient_context: typeof c?.patient_context === "string" ? c.patient_context : "",
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

