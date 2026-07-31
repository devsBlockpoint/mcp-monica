/**
 * Proyector de prompt — una fuente maestra, dos proyecciones (texto y voz).
 *
 * El prompt maestro de Mónica lo edita el negocio en un solo documento. Este
 * módulo lo parte por marcas de sección y compone la versión de cada canal,
 * agregando las reglas propias del canal (que viven en el repo).
 *
 * Existe porque mantener dos prompts a mano se rompió en producción: cuando el
 * maestro pasó a v4.0, la voz se quedó en v3.5, y reglas escritas para WhatsApp
 * se filtraron a las llamadas (Mónica llegó a dictar una CLABE dígito por dígito
 * y a decir "por aquí en el chat" estando al teléfono).
 */

export const BLOQUES = [
  "IDENTIDAD",
  "CONTEXTO",
  "TONO",
  "OBJETIVO",
  "GUARDRAILS",
  "HERRAMIENTAS",
  "CONOCIMIENTO",
  "SOLO-TEXTO",
] as const;

export type Bloque = (typeof BLOQUES)[number];

export interface Maestro {
  /** Texto antes de la primera marca (encabezado del documento). */
  preambulo: string;
  /** Contenido por bloque. Un bloque ausente queda como "". */
  bloques: Record<Bloque, string>;
  /** Marcas presentes en el documento pero que no reconocemos. */
  desconocidos: Record<string, string>;
  /** true si el documento todavía no tiene ninguna marca conocida. */
  sinMarcas: boolean;
  /** El documento completo, tal cual. Es el fallback cuando `sinMarcas`. */
  canonCrudo: string;
}

const MARCA = /^\s*\[\[([A-ZÁÉÍÓÚÑ0-9_-]+)\]\]\s*$/i;

/** Parte el maestro por marcas `[[BLOQUE]]`. Tolerante: nunca lanza. */
export function parseMaestro(texto: string): Maestro {
  const bloques = Object.fromEntries(BLOQUES.map((b) => [b, ""])) as Record<Bloque, string>;
  const desconocidos: Record<string, string> = {};
  const preambulo: string[] = [];

  let actual: string | null = null;
  const buffer: string[] = [];

  const volcar = () => {
    const contenido = buffer.join("\n").trim();
    buffer.length = 0;
    if (actual === null) return;
    const nombre = actual.toUpperCase();
    if ((BLOQUES as readonly string[]).includes(nombre)) {
      const b = nombre as Bloque;
      bloques[b] = bloques[b] ? `${bloques[b]}\n\n${contenido}` : contenido;
    } else {
      // No se descarta en silencio: se conserva para poder reportarlo.
      desconocidos[nombre] = desconocidos[nombre] ? `${desconocidos[nombre]}\n\n${contenido}` : contenido;
    }
  };

  for (const linea of texto.split("\n")) {
    const m = MARCA.exec(linea);
    if (m) {
      volcar();
      actual = m[1];
      continue;
    }
    if (actual === null) preambulo.push(linea);
    else buffer.push(linea);
  }
  volcar();

  const sinMarcas = BLOQUES.every((b) => !bloques[b]) && Object.keys(desconocidos).length === 0;

  return {
    preambulo: preambulo.join("\n").trim(),
    bloques,
    desconocidos,
    sinMarcas,
    canonCrudo: texto.trim(),
  };
}

/** Bloques de comportamiento (todo menos conocimiento y lo exclusivo de un canal). */
const COMPORTAMIENTO: Bloque[] = [
  "IDENTIDAD",
  "CONTEXTO",
  "TONO",
  "OBJETIVO",
  "GUARDRAILS",
  "HERRAMIENTAS",
];

function unir(partes: (string | undefined)[]): string {
  return partes.filter((p) => p && p.trim()).join("\n\n");
}

/**
 * Proyección TEXTO (nanoclaw): lleva todo — comportamiento, conocimiento y las
 * reglas exclusivas de texto. nanoclaw tiene contexto grande, no hace falta RAG.
 */
export function proyectarTexto(m: Maestro, reglasCanal: string): string {
  if (m.sinMarcas) return unir([m.canonCrudo, reglasCanal]);
  return unir([
    m.preambulo,
    ...COMPORTAMIENTO.map((b) => m.bloques[b]),
    m.bloques.CONOCIMIENTO,
    m.bloques["SOLO-TEXTO"],
    reglasCanal,
  ]);
}

/**
 * Proyección VOZ (ElevenLabs): el prompt queda liviano con los encabezados que
 * recomienda su guía (el modelo presta atención extra a `# Guardrails`), y el
 * conocimiento sale por separado para cargarse como Knowledge Base con RAG.
 *
 * `SOLO-TEXTO` se excluye a propósito: ese es el bug que ya ocurrió.
 */
export function proyectarVoz(
  m: Maestro,
  reglasCanal: string,
): { prompt: string; conocimiento: string } {
  if (m.sinMarcas) {
    // Sin marcas no se puede separar con seguridad; se entrega el maestro y la
    // validación de abajo actúa como red (detectará datos bancarios y frases de
    // otro canal si el documento los trae).
    return { prompt: unir([m.canonCrudo, reglasCanal]), conocimiento: "" };
  }

  const prompt = unir([
    "# Personality",
    m.bloques.IDENTIDAD,
    "# Environment",
    m.bloques.CONTEXTO,
    "# Tone",
    m.bloques.TONO,
    "# Goal",
    m.bloques.OBJETIVO,
    "# Guardrails",
    m.bloques.GUARDRAILS,
    "# Tools",
    m.bloques.HERRAMIENTAS,
    reglasCanal,
  ]);

  return { prompt, conocimiento: m.bloques.CONOCIMIENTO };
}

export interface Validacion {
  ok: boolean;
  errores: string[];
}

/** ~2000 tokens es lo recomendado por ElevenLabs; esto es el tope duro con holgura. */
/**
 * Presupuesto del prompt de voz, en caracteres (~4.500 tokens).
 *
 * ElevenLabs recomienda prompts cortos; este es ~2× esa guía y es una decisión
 * deliberada: el kernel de comportamiento de Mónica —directivas no negociables,
 * banderas rojas clínicas, reglas duras de tools, sanitización— no se puede
 * recortar sin perder cosas que deben aplicar SIEMPRE, y no pueden vivir en la
 * Knowledge Base porque un miss del RAG las apagaría en silencio.
 *
 * Subido de 16.000 a 18.000 para dejar margen: con el prompt pegado al límite,
 * cualquier edición del negocio en el maestro bloquearía la publicación.
 * Lo que NO cabe acá va a la Knowledge Base, donde un miss produce una consulta
 * y no un daño (§0 obliga a escalar en vez de improvisar).
 */
const MAX_CHARS = 18_000;
const MIN_CHARS = 40;

/** 16+ dígitos seguidos (con espacios o guiones) = tarjeta o CLABE, nunca un teléfono. */
const BANCARIO = /(?:\d[ -]?){16,}/;

const FRASES_DE_OTRO_CANAL = [
  "por aquí en el chat",
  "por aqui en el chat",
  "por aquí por el chat",
  "escríbame",
  "escribame",
  "por escrito",
  "por este medio",
];

/**
 * Puerta de seguridad antes de publicar a producción. El maestro lo edita el
 * negocio y se propaga solo, así que una edición rota llegaría al agente vivo.
 */
export function validarProyeccionVoz(prompt: string): Validacion {
  const errores: string[] = [];
  const texto = (prompt ?? "").trim();

  if (texto.length < MIN_CHARS) {
    errores.push(`La proyección está vacía o es demasiado corta (${texto.length} chars).`);
    return { ok: false, errores };
  }
  if (texto.length > MAX_CHARS) {
    errores.push(
      `Excede el presupuesto de tamaño para voz (${texto.length} chars > ${MAX_CHARS}); sube latencia y costo en tokens.`,
    );
  }
  if (BANCARIO.test(texto)) {
    errores.push("Contiene lo que parece una CLABE o tarjeta (16+ dígitos): en voz no se dictan datos bancarios.");
  }
  // Una frase de otro canal citada DENTRO de la regla que la prohíbe no es un
  // error: es el guardrail funcionando. Sin esto la validación se dispara con su
  // propio texto —"Nunca digas 'por aquí en el chat'"— y bloquea la publicación
  // por la única línea que garantiza que Mónica no lo diga.
  const NEGACION = /(nunca|no digas|no diga|jamás|jamas|evita|evitá|prohibid|elimín|elimin|🚫|❌)/;
  const lineasConFrase = (f: string) =>
    texto.split("\n").filter((l) => l.toLowerCase().includes(f));

  const bajo = texto.toLowerCase();
  const filtrada = FRASES_DE_OTRO_CANAL.find((f) => {
    if (!bajo.includes(f)) return false;
    // Solo es hallazgo si aparece en alguna línea SIN marca de prohibición.
    return lineasConFrase(f).some((l) => !NEGACION.test(l.toLowerCase()));
  });
  if (filtrada) {
    errores.push(`Contiene una frase de otro canal ("${filtrada}"): en una llamada no aplica.`);
  }
  if (!/^#\s*guardrails/im.test(texto)) {
    errores.push("Falta el bloque `# Guardrails` (ElevenLabs le da peso extra a ese encabezado).");
  }

  return { ok: errores.length === 0, errores };
}

