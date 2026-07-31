import { describe, test, expect } from "vitest";
import { crearPromptService } from "../src/prompt-service.ts";

const MAESTRO = `[[IDENTIDAD]]
Eres Mónica.
[[GUARDRAILS]]
Seguridad clínica antes que venta.
[[CONOCIMIENTO]]
Catálogo: HIFU 12D.
[[SOLO-TEXTO]]
Negrita con UN asterisco.`;

function fetchOk(body: string) {
  return async () => new Response(body, { status: 200 });
}
function fetchFalla() {
  return async () => {
    throw new Error("ECONNREFUSED");
  };
}
function fetchStatus(code: number) {
  return async () => new Response("", { status: code });
}

// minMaestroChars bajo: los fixtures son cortos a propósito para que los tests
// se lean. En producción el default (200) protege contra descargas truncadas.
const base = {
  masterUrl: "https://doc/export",
  reglasTexto: "R-TEXTO",
  reglasVoz: "R-VOZ",
  minMaestroChars: 10,
};

describe("promptService · texto", () => {
  test("proyecta el maestro con las reglas de texto", async () => {
    const svc = crearPromptService({ ...base, fetchImpl: fetchOk(MAESTRO) });
    const r = await svc.texto();
    expect(r.ok).toBe(true);
    expect(r.contenido).toContain("Eres Mónica");
    expect(r.contenido).toContain("HIFU 12D");
    expect(r.contenido).toContain("R-TEXTO");
    expect(r.desdeCache).toBe(false);
  });

  // Igual que el loader de nanoclaw: un fallo de red no debe dejar sin prompt.
  test("si el fetch falla, sirve la última proyección buena", async () => {
    let falla = false;
    const svc = crearPromptService({
      ...base,
      fetchImpl: (async () => {
        if (falla) throw new Error("ECONNREFUSED");
        return new Response(MAESTRO, { status: 200 });
      }) as unknown as typeof fetch,
    });
    await svc.texto();
    falla = true;
    const r = await svc.texto();
    expect(r.ok).toBe(true);
    expect(r.desdeCache).toBe(true);
    expect(r.contenido).toContain("Eres Mónica");
  });

  test("si el fetch falla y no hay cache, devuelve error (no un prompt vacío)", async () => {
    const svc = crearPromptService({ ...base, fetchImpl: fetchFalla() as unknown as typeof fetch });
    const r = await svc.texto();
    expect(r.ok).toBe(false);
    expect(r.contenido).toBe("");
  });

  test("un HTTP no-2xx cuenta como fallo", async () => {
    const svc = crearPromptService({ ...base, fetchImpl: fetchStatus(500) as unknown as typeof fetch });
    expect((await svc.texto()).ok).toBe(false);
  });

  test("un maestro vacío no reemplaza la cache buena", async () => {
    let vacio = false;
    const svc = crearPromptService({
      ...base,
      fetchImpl: (async () => new Response(vacio ? "" : MAESTRO, { status: 200 })) as unknown as typeof fetch,
    });
    await svc.texto();
    vacio = true;
    const r = await svc.texto();
    expect(r.contenido).toContain("Eres Mónica");
    expect(r.desdeCache).toBe(true);
  });
});

describe("promptService · voz", () => {
  test("devuelve prompt y conocimiento por separado", async () => {
    const svc = crearPromptService({ ...base, fetchImpl: fetchOk(MAESTRO) });
    const r = await svc.voz();
    expect(r.ok).toBe(true);
    expect(r.prompt).toContain("# Guardrails");
    expect(r.prompt).toContain("R-VOZ");
    expect(r.conocimiento).toContain("HIFU 12D");
  });

  test("SOLO-TEXTO nunca llega a la proyección de voz", async () => {
    const svc = crearPromptService({ ...base, fetchImpl: fetchOk(MAESTRO) });
    expect((await svc.voz()).prompt).not.toContain("UN asterisco");
  });

  test("si la validación falla, no la marca ok y explica por qué", async () => {
    const malo = `[[IDENTIDAD]]\nMónica.\n[[GUARDRAILS]]\nCLABE 002743089576356962 para pagar.`;
    const svc = crearPromptService({ ...base, fetchImpl: fetchOk(malo) });
    const r = await svc.voz();
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/bancari|CLABE/i);
  });
});

