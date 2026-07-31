import { describe, test, expect } from "vitest";
import {
  parseMaestro,
  proyectarTexto,
  proyectarVoz,
  validarProyeccionVoz,
} from "../src/prompt-projection.ts";

const MAESTRO = `SYSTEM PROMPT — MÓNICA

[[IDENTIDAD]]
Eres Mónica, asesora de ÉLÉVÉ.

[[TONO]]
Trato de usted por defecto.

[[GUARDRAILS]]
Seguridad clínica antes que venta.

[[CONOCIMIENTO]]
Catálogo: HIFU 12D, Criolipólisis.

[[SOLO-TEXTO]]
Negrita con UN asterisco: *$1,290*.
`;

describe("parseMaestro", () => {
  test("separa cada bloque marcado", () => {
    const m = parseMaestro(MAESTRO);
    expect(m.bloques.IDENTIDAD).toContain("asesora de ÉLÉVÉ");
    expect(m.bloques.TONO).toContain("usted por defecto");
    expect(m.bloques.GUARDRAILS).toContain("Seguridad clínica");
    expect(m.bloques.CONOCIMIENTO).toContain("HIFU 12D");
    expect(m.bloques["SOLO-TEXTO"]).toContain("UN asterisco");
  });

  test("no filtra el contenido de un bloque dentro de otro", () => {
    const m = parseMaestro(MAESTRO);
    expect(m.bloques.IDENTIDAD).not.toContain("usted por defecto");
    expect(m.bloques.GUARDRAILS).not.toContain("HIFU");
  });

  test("el preámbulo antes de la primera marca no se pierde", () => {
    const m = parseMaestro(MAESTRO);
    expect(m.preambulo).toContain("SYSTEM PROMPT");
  });

  // Degradación segura: el negocio puede tardar en poner las marcas.
  test("sin marcas: marca sinMarcas y trata todo como canon", () => {
    const m = parseMaestro("Documento entero sin ninguna marca.");
    expect(m.sinMarcas).toBe(true);
    expect(m.canonCrudo).toContain("Documento entero");
  });

  test("con al menos una marca, sinMarcas es false", () => {
    expect(parseMaestro(MAESTRO).sinMarcas).toBe(false);
  });

  test("ignora marcas desconocidas sin romper", () => {
    const m = parseMaestro("[[IDENTIDAD]]\nA\n[[INVENTADA]]\nB\n");
    expect(m.bloques.IDENTIDAD).toContain("A");
    expect(m.sinMarcas).toBe(false);
  });
});

describe("proyectarTexto", () => {
  test("incluye canon, conocimiento, SOLO-TEXTO y las reglas de canal", () => {
    const out = proyectarTexto(parseMaestro(MAESTRO), "REGLAS-TEXTO");
    expect(out).toContain("asesora de ÉLÉVÉ");
    expect(out).toContain("HIFU 12D");
    expect(out).toContain("UN asterisco");
    expect(out).toContain("REGLAS-TEXTO");
  });

  test("sin marcas: devuelve el maestro completo + reglas de canal", () => {
    const out = proyectarTexto(parseMaestro("Todo el documento."), "REGLAS-TEXTO");
    expect(out).toContain("Todo el documento.");
    expect(out).toContain("REGLAS-TEXTO");
  });
});

describe("proyectarVoz", () => {
  test("el prompt lleva canon y reglas de voz, pero NO el conocimiento", () => {
    const { prompt } = proyectarVoz(parseMaestro(MAESTRO), "REGLAS-VOZ");
    expect(prompt).toContain("asesora de ÉLÉVÉ");
    expect(prompt).toContain("Seguridad clínica");
    expect(prompt).toContain("REGLAS-VOZ");
    expect(prompt).not.toContain("HIFU 12D"); // el catálogo va a la KB
  });

  test("SOLO-TEXTO nunca llega a la voz (el bug que ya ocurrió)", () => {
    const { prompt } = proyectarVoz(parseMaestro(MAESTRO), "REGLAS-VOZ");
    expect(prompt).not.toContain("UN asterisco");
  });

  test("el conocimiento sale aparte, para la Knowledge Base", () => {
    const { conocimiento } = proyectarVoz(parseMaestro(MAESTRO), "REGLAS-VOZ");
    expect(conocimiento).toContain("HIFU 12D");
  });

  test("usa los encabezados que recomienda ElevenLabs", () => {
    const { prompt } = proyectarVoz(parseMaestro(MAESTRO), "REGLAS-VOZ");
    expect(prompt).toContain("# Guardrails");
    expect(prompt).toContain("# Personality");
  });
});

describe("validarProyeccionVoz", () => {
  const ok = "# Personality\nMónica.\n# Guardrails\nSeguridad clínica antes que venta.";

  test("acepta una proyección válida", () => {
    expect(validarProyeccionVoz(ok).ok).toBe(true);
  });

  test("rechaza si viene vacía o demasiado corta", () => {
    expect(validarProyeccionVoz("").ok).toBe(false);
    expect(validarProyeccionVoz("hola").ok).toBe(false);
  });

  test("rechaza una CLABE (18 dígitos) — nunca debe dictarse en voz", () => {
    const r = validarProyeccionVoz(`${ok}\nCLABE 002743089576356962`);
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/bancari|CLABE|dígitos/i);
  });

  test("rechaza un número de tarjeta (16 dígitos, con o sin guiones)", () => {
    expect(validarProyeccionVoz(`${ok}\n5204-1661-1731-2498`).ok).toBe(false);
    expect(validarProyeccionVoz(`${ok}\n5204166117312498`).ok).toBe(false);
  });

  test("rechaza frases de otro canal", () => {
    const r = validarProyeccionVoz(`${ok}\nLe respondo por aquí en el chat.`);
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/canal/i);
  });

  test("rechaza si falta el bloque de guardrails", () => {
    const r = validarProyeccionVoz("# Personality\nMónica, asesora de la clínica ÉLÉVÉ en Los Mochis.");
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/guardrail/i);
  });

  test("avisa si excede el presupuesto de tamaño de ElevenLabs", () => {
    const r = validarProyeccionVoz(ok + "\n" + "palabra ".repeat(20000));
    expect(r.ok).toBe(false);
    expect(r.errores.join(" ")).toMatch(/tamaño|token/i);
  });

  test("un teléfono normal de 10 dígitos NO se confunde con datos bancarios", () => {
    expect(validarProyeccionVoz(`${ok}\nTeléfono 6683965199.`).ok).toBe(true);
  });
});

