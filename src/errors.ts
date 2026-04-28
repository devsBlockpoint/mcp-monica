export interface McpErrorPayload {
  code: number;
  message: string;
  data?: unknown;
}

export function mapHttpToMcpError(status: number, body?: unknown): McpErrorPayload {
  if (status >= 200 && status < 300) {
    throw new Error(`mapHttpToMcpError called with success status ${status}`);
  }

  if (status === 0) {
    return { code: -32603, message: "Edge function timeout" };
  }

  if (status >= 400 && status < 500) {
    const b = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
    const message =
      (typeof b.message === "string" && b.message) ||
      (typeof b.error === "string" && b.error) ||
      "Bad request";
    return { code: -32602, message, data: body };
  }

  // 5xx and any other unexpected non-success status
  return { code: -32603, message: "Internal error" };
}
