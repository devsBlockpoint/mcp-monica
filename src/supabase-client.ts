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
        Authorization: `Bearer ${config.serviceRoleKey}`,
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
