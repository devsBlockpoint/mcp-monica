import { describe, test, expect } from "vitest";
import { calcularSync, hashContenido } from "../src/eleven-sync.ts";

const proyeccionOk = {
  ok: true,
  prompt: "# Personality\nMónica.\n# Guardrails\nSeguridad clínica antes que venta.",
  conocimiento: "Catálogo: HIFU 12D.",
  errores: [] as string[],
};

describe("hashContenido", () => {
  test("es estable para el mismo contenido", () => {
    expect(hashContenido("abc")).toBe(hashContenido("abc"));
  });
  test("cambia si el contenido cambia", () => {
    expect(hashContenido("abc")).not.toBe(hashContenido("abd"));
  });
});

describe("calcularSync", () => {
  test("primera vez (sin estado previo): publica todo", () => {
    const r = calcularSync(proyeccionOk, null);
    expect(r.debePublicar).toBe(true);
    expect(r.acciones).toContain("prompt");
    expect(r.acciones).toContain("conocimiento");
  });

  test("sin cambios: no publica nada", () => {
    const previo = calcularSync(proyeccionOk, null).hashes;
    const r = calcularSync(proyeccionOk, previo);
    expect(r.debePublicar).toBe(false);
    expect(r.acciones).toEqual([]);
  });

  test("si solo cambió el prompt, no re-publica el conocimiento", () => {
    const previo = calcularSync(proyeccionOk, null).hashes;
    const r = calcularSync({ ...proyeccionOk, prompt: proyeccionOk.prompt + "\nAlgo nuevo." }, previo);
    expect(r.acciones).toEqual(["prompt"]);
  });

  test("si solo cambió el conocimiento, no re-publica el prompt", () => {
    const previo = calcularSync(proyeccionOk, null).hashes;
    const r = calcularSync({ ...proyeccionOk, conocimiento: "Catálogo nuevo." }, previo);
    expect(r.acciones).toEqual(["conocimiento"]);
  });

  // La red de seguridad: el maestro lo edita el negocio y se propaga solo.
  test("si la proyección es inválida, NO publica aunque haya cambiado", () => {
    const mala = { ok: false, prompt: "x", conocimiento: "y", errores: ["contiene una CLABE"] };
    const r = calcularSync(mala, null);
    expect(r.debePublicar).toBe(false);
    expect(r.motivo).toMatch(/valida/i);
    expect(r.acciones).toEqual([]);
  });

  test("una proyección inválida no pisa los hashes ya publicados", () => {
    const previo = calcularSync(proyeccionOk, null).hashes;
    const mala = { ok: false, prompt: "otro", conocimiento: "otro", errores: ["mal"] };
    const r = calcularSync(mala, previo);
    expect(r.hashes).toEqual(previo);
  });
});

