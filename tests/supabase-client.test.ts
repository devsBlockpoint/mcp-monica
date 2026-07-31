import { describe, test, expect } from "vitest";
import { callEdgeFunction } from "../src/supabase-client.ts";

const baseConfig = {
  baseUrl: "https://example.supabase.co",
  serviceRoleKey: "test-key",
  timeoutMs: 1000,
};

function mockFetch(response: { status: number; body?: unknown; delay?: number }): typeof fetch {
  return (async (_input: string | URL, init?: RequestInit) => {
    if (response.delay) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, response.delay);
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          });
        }
      });
    }
    const bodyText = response.body === undefined ? "" : JSON.stringify(response.body);
    return new Response(bodyText, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("callEdgeFunction", () => {
  test("returns ok:true with parsed body on 200", async () => {
    const fetchImpl = mockFetch({ status: 200, body: { success: true, cita: { id: "abc" } } });
    const result = await callEdgeFunction(
      { ...baseConfig, fetchImpl },
      "book-appointment",
      { nombre: "Ana" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ success: true, cita: { id: "abc" } });
    }
  });

  test("posts to correct URL with auth header and JSON body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = (async (input: string | URL, init?: RequestInit) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    }) as typeof fetch;

    await callEdgeFunction(
      { ...baseConfig, fetchImpl },
      "check-availability",
      { fecha: "2026-05-01" },
    );

    expect(capturedUrl).toBe("https://example.supabase.co/functions/v1/check-availability");
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(capturedInit?.body).toBe(JSON.stringify({ fecha: "2026-05-01" }));
  });

  test("4xx returns ok:false with mapped MCP error and body data", async () => {
    const fetchImpl = mockFetch({ status: 400, body: { message: "Slot ya no disponible" } });
    const result = await callEdgeFunction(
      { ...baseConfig, fetchImpl },
      "book-appointment",
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(-32602);
      expect(result.error.message).toBe("Slot ya no disponible");
    }
  });

  test("5xx returns ok:false with generic InternalError", async () => {
    const fetchImpl = mockFetch({ status: 500, body: { stack: "secret" } });
    const result = await callEdgeFunction(
      { ...baseConfig, fetchImpl },
      "book-appointment",
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(-32603);
      expect(result.error.message).toBe("Internal error");
      expect(result.error.data).toBeUndefined();
    }
  });

  test("timeout returns ok:false with timeout error", async () => {
    const fetchImpl = mockFetch({ status: 200, body: { ok: 1 }, delay: 2000 });
    const result = await callEdgeFunction(
      { ...baseConfig, timeoutMs: 100, fetchImpl },
      "slow-function",
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Edge function timeout");
    }
  });
});

describe("token por llamada (authOverride)", () => {
  const base = { baseUrl: "https://x.supabase.co", serviceRoleKey: "SERVICE_ROLE" };
  const espia = () => {
    const calls: any[] = [];
    const f = async (url: any, init: any) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    return { calls, f: f as unknown as typeof fetch };
  };

  test("sin override manda la service_role", async () => {
    const { calls, f } = espia();
    await callEdgeFunction({ ...base, fetchImpl: f }, "book-appointment", {});
    expect(calls[0].init.headers.Authorization).toBe("Bearer SERVICE_ROLE");
  });

  test("con override manda ESE token y no la service_role", async () => {
    // Sin esto, ingest-call-transcript recibiría la service_role, la compararía
    // contra su INGEST_CALL_TOKEN y devolvería 401 en cada entrega: ElevenLabs
    // reintenta, falla, y los transcripts nunca llegan al CRM — en silencio.
    const { calls, f } = espia();
    await callEdgeFunction({ ...base, fetchImpl: f }, "ingest-call-transcript", {}, "INGEST_TOK");
    expect(calls[0].init.headers.Authorization).toBe("Bearer INGEST_TOK");
  });

  test("un override vacío cae a la service_role", async () => {
    // Si la env var existe pero está vacía, no debe romper el reenvío.
    const { calls, f } = espia();
    await callEdgeFunction({ ...base, fetchImpl: f }, "ingest-call-transcript", {}, "");
    expect(calls[0].init.headers.Authorization).toBe("Bearer SERVICE_ROLE");
  });
});
