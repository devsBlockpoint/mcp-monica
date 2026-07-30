import { describe, test, expect } from "vitest";
import { handleToolHttpCall } from "../src/tool-http.ts";
import type { ToolDefinition } from "../src/tools-loader.ts";
import type { EdgeFunctionResult } from "../src/supabase-client.ts";

const tools: ToolDefinition[] = [
  {
    name: "buscar_disponibilidad",
    edgeFunction: "check-availability",
    description: "",
    inputSchema: {},
  },
];

describe("handleToolHttpCall", () => {
  test("returns 200 with the edge function data on success", async () => {
    const callEdgeFn = async (): Promise<EdgeFunctionResult> => ({
      ok: true,
      data: { horasDisponibles: ["11:00"] },
    });
    const r = await handleToolHttpCall(tools, callEdgeFn, "buscar_disponibilidad", {
      fecha: "2026-08-01",
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ horasDisponibles: ["11:00"] });
  });

  test("forwards the tool's edge function name and args to callEdgeFn", async () => {
    let seen: { name?: string; input?: unknown } = {};
    const callEdgeFn = async (name: string, input: unknown): Promise<EdgeFunctionResult> => {
      seen = { name, input };
      return { ok: true, data: {} };
    };
    await handleToolHttpCall(tools, callEdgeFn, "buscar_disponibilidad", { fecha: "x" });
    expect(seen.name).toBe("check-availability");
    expect(seen.input).toEqual({ fecha: "x" });
  });

  test("returns 404 for an unknown tool (without calling the edge function)", async () => {
    let called = false;
    const callEdgeFn = async (): Promise<EdgeFunctionResult> => {
      called = true;
      return { ok: true, data: {} };
    };
    const r = await handleToolHttpCall(tools, callEdgeFn, "no_existe", {});
    expect(r.status).toBe(404);
    expect(called).toBe(false);
  });

  test("maps a 4xx edge error (code -32602) to 400 with the message", async () => {
    const callEdgeFn = async (): Promise<EdgeFunctionResult> => ({
      ok: false,
      error: { code: -32602, message: "Slot ya no disponible" },
    });
    const r = await handleToolHttpCall(tools, callEdgeFn, "buscar_disponibilidad", {});
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "Slot ya no disponible" });
  });

  test("maps an internal edge error (code -32603) to 500 without leaking details", async () => {
    const callEdgeFn = async (): Promise<EdgeFunctionResult> => ({
      ok: false,
      error: { code: -32603, message: "Internal error" },
    });
    const r = await handleToolHttpCall(tools, callEdgeFn, "buscar_disponibilidad", {});
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal error" });
  });

  test("defaults missing args to an empty object", async () => {
    let seenInput: unknown = "unset";
    const callEdgeFn = async (_n: string, input: unknown): Promise<EdgeFunctionResult> => {
      seenInput = input;
      return { ok: true, data: {} };
    };
    await handleToolHttpCall(tools, callEdgeFn, "buscar_disponibilidad", undefined);
    expect(seenInput).toEqual({});
  });
});

