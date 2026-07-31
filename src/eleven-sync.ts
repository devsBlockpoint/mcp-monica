import { createHash } from "node:crypto";

/**
 * Decide QUÉ hay que publicar en el agente de voz de ElevenLabs — sin publicarlo.
 *
 * Se separa el cálculo del envío a propósito: así la decisión (¿cambió algo?,
 * ¿es seguro publicarlo?) se puede probar sin red y correr en dry-run antes de
 * tocar el agente vivo. ElevenLabs no hace polling, así que el push es un job
 * aparte; esta función es su cerebro.
 */

export interface Proyeccion {
  /** false = la validación de voz falló; no debe publicarse. */
  ok: boolean;
  prompt: string;
  conocimiento: string;
  errores: string[];
}

export interface HashesPublicados {
  prompt: string;
  conocimiento: string;
}

export interface PlanSync {
  debePublicar: boolean;
  /** Qué partes cambiaron: "prompt" y/o "conocimiento". */
  acciones: ("prompt" | "conocimiento")[];
  /** Hashes que quedarían registrados si se publica. Si no se publica, los previos. */
  hashes: HashesPublicados;
  motivo?: string;
}

export function hashContenido(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex").slice(0, 16);
}

export function calcularSync(p: Proyeccion, publicado: HashesPublicados | null): PlanSync {
  // Una proyección inválida nunca se publica y nunca pisa el estado bueno:
  // el maestro lo edita el negocio y llega acá sin revisión humana.
  if (!p.ok) {
    return {
      debePublicar: false,
      acciones: [],
      hashes: publicado ?? { prompt: "", conocimiento: "" },
      motivo: `la proyección no pasó la validación: ${p.errores.join("; ")}`,
    };
  }

  const nuevos: HashesPublicados = {
    prompt: hashContenido(p.prompt),
    conocimiento: hashContenido(p.conocimiento),
  };

  const acciones: ("prompt" | "conocimiento")[] = [];
  if (!publicado || publicado.prompt !== nuevos.prompt) acciones.push("prompt");
  if (!publicado || publicado.conocimiento !== nuevos.conocimiento) acciones.push("conocimiento");

  return {
    debePublicar: acciones.length > 0,
    acciones,
    hashes: nuevos,
    motivo: acciones.length === 0 ? "sin cambios respecto de lo publicado" : undefined,
  };
}

