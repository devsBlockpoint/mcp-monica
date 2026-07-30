import type { ToolDefinition } from "./tools-loader.ts";
import type { EdgeFunctionResult } from "./supabase-client.ts";

export interface ToolHttpResponse {
  status: number;
  body: unknown;
}

/**
 * Plain-REST tool call, for consumers that can't speak MCP JSON-RPC
 * (e.g. ElevenLabs webhook/server tools): POST /tools/<name> with the tool
 * arguments as a flat JSON body -> flat JSON result. Reuses the same tool
 * manifest and edge-function proxy as the MCP transport; the caller layer
 * (src/index.ts) enforces the bearer-token guard before this runs.
 */
export async function handleToolHttpCall(
  tools: ToolDefinition[],
  callEdgeFn: (name: string, input: unknown) => Promise<EdgeFunctionResult>,
  toolName: string,
  args: unknown,
): Promise<ToolHttpResponse> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return { status: 404, body: { error: `Tool "${toolName}" not found` } };
  }

  const result = await callEdgeFn(tool.edgeFunction, args ?? {});
  if (result.ok) {
    return { status: 200, body: result.data };
  }

  // -32602 = invalid params / terminal 4xx (safe to surface to the caller);
  // anything else (e.g. -32603) is an internal error -> generic 500.
  const status = result.error.code === -32602 ? 400 : 500;
  return { status, body: { error: result.error.message } };
}

