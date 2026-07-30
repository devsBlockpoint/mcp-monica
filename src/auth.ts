import { timingSafeEqual } from "node:crypto";

/**
 * Guards the /mcp endpoint with a shared bearer token.
 *
 * Opt-in by design: when `expectedToken` is unset/empty the guard is disabled
 * and every request is authorized. This keeps local dev and the current
 * private-network nanoclaw → mcp-monica call working unchanged. In production
 * (where ElevenLabs, a SaaS, reaches /mcp over the public internet) set the
 * token to require it.
 *
 * The Authorization header may arrive as `Bearer <token>` (case-insensitive
 * scheme) or as a bare `<token>` value (ElevenLabs sends `secret_token` as the
 * raw header value). Comparison is constant-time to avoid leaking the token
 * via timing.
 */
export function isAuthorized(
  authHeader: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return true;
  if (!authHeader) return false;

  const provided = stripBearer(authHeader.trim());
  return constantTimeEquals(provided, expectedToken);
}

function stripBearer(value: string): string {
  const match = /^bearer\s+(.*)$/i.exec(value);
  return match ? match[1] : value;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; a differing length is itself a
  // mismatch, so reject early (the token length is not a meaningful secret).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
