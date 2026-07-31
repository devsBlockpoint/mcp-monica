import { mapHttpToMcpError, type McpErrorPayload } from "./errors.ts";

export interface SupabaseClientConfig {
  baseUrl: string;
  serviceRoleKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type EdgeFunctionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: McpErrorPayload };

const DEFAULT_TIMEOUT_MS = 10_000;

export async function callEdgeFunction(
  config: SupabaseClientConfig,
  name: string,
  input: unknown,
  /**
   * Token alternativo para ESTA llamada, en lugar de la service_role.
   *
   * Existe para las edge functions que traen su propio guard (hoy
   * `ingest-call-transcript` con INGEST_CALL_TOKEN). Sin esto, la función
   * recibiría la service_role y la compararía contra su token propio: 401 en
   * cada entrega, y los transcripts dejarían de llegar al CRM en silencio,
   * porque ElevenLabs reintenta y falla sin que nadie se entere.
   */
  authOverride?: string,
): Promise<EdgeFunctionResult> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/functions/v1/${name}`;
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authOverride || config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: mapHttpToMcpError(0) };
    }
    return { ok: false, error: { code: -32603, message: "Network error" } };
  } finally {
    clearTimeout(timeoutId);
  }

  let body: unknown = undefined;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (response.ok) {
    return { ok: true, data: body };
  }

  return { ok: false, error: mapHttpToMcpError(response.status, body) };
}
