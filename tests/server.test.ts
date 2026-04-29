import { describe, test, expect, vi } from "vitest";
import { createMcpServer } from "../src/server.ts";
import type { ToolDefinition } from "../src/tools-loader.ts";

const sampleTools: ToolDefinition[] = [
  {
    name: "agendar_cita",
    description: "Crea cita",
    inputSchema: { type: "object", properties: { fecha: { type: "string" } } },
    edgeFunction: "book-appointment",
  },
];

describe("createMcpServer", () => {
  test("listTools returns tool definitions in MCP shape", async () => {
    const callEdgeFn = vi.fn(async () => ({ ok: true as const, data: {} }));
    const server = createMcpServer({ tools: sampleTools, callEdgeFn });
    const list = await server._handlers.listTools();
    expect(list.tools).toHaveLength(1);
    expect(list.tools[0].name).toBe("agendar_cita");
    expect(list.tools[0].description).toBe("Crea cita");
    expect(list.tools[0].inputSchema).toEqual({
      type: "object",
      properties: { fecha: { type: "string" } },
    });
  });

  test("callTool routes to callEdgeFn with correct edge function name and arguments", async () => {
    const callEdgeFn = vi.fn(async (_name: string, _input: unknown) => ({
      ok: true as const,
      data: { success: true, cita: { id: "x" } },
    }));
    const server = createMcpServer({ tools: sampleTools, callEdgeFn });
    const result = await server._handlers.callTool({
      params: { name: "agendar_cita", arguments: { fecha: "2026-05-01" } },
    });
    expect(callEdgeFn).toHaveBeenCalledWith("book-appointment", { fecha: "2026-05-01" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ success: true, cita: { id: "x" } });
    expect(result.isError).toBeFalsy();
  });

  test("callTool returns isError:true when callEdgeFn returns ok:false", async () => {
    const callEdgeFn = vi.fn(async () => ({
      ok: false as const,
      error: { code: -32602, message: "Slot ya no disponible" },
    }));
    const server = createMcpServer({ tools: sampleTools, callEdgeFn });
    const result = await server._handlers.callTool({
      params: { name: "agendar_cita", arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Slot ya no disponible");
  });

  test("callTool with unknown tool name returns isError:true", async () => {
    const callEdgeFn = vi.fn(async () => ({ ok: true as const, data: {} }));
    const server = createMcpServer({ tools: sampleTools, callEdgeFn });
    const result = await server._handlers.callTool({
      params: { name: "no_existe", arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("no_existe");
  });
});
