import {
  parseMaestro,
  proyectarTexto,
  proyectarVoz,
  validarProyeccionVoz,
} from "./prompt-projection.ts";

/**
 * Servicio de proyección: baja el prompt maestro y devuelve la versión de cada canal.
 *
 * Guarda en memoria la última proyección buena y la sirve si el maestro no se
 * puede bajar. Es el mismo criterio que ya usa el loader de nanoclaw
 * (`system-prompt-loader.ts`): un fallo de red nunca debe dejar al agente sin
 * prompt, ni servirle uno vacío.
 */

export interface PromptServiceDeps {
  /** URL de exportación en texto del documento maestro. */
  masterUrl: string;
  /** Contenido de las reglas del canal de texto (prompt/canal-texto.md). */
  reglasTexto: string;
  /** Contenido de las reglas del canal de voz (prompt/canal-voz.md). */
  reglasVoz: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Por debajo de este tamaño se asume que la descarga vino rota y se prefiere
   * la cache. Es política, no constante: se inyecta para poder probarla.
   */
  minMaestroChars?: number;
}

export interface ResultadoTexto {
  ok: boolean;
  contenido: string;
  desdeCache: boolean;
  error?: string;
}

export interface ResultadoVoz {
  ok: boolean;
  prompt: string;
  conocimiento: string;
  desdeCache: boolean;
  errores: string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Por debajo de esto asumimos que la descarga vino rota y preferimos la cache. */
const MIN_MAESTRO_CHARS = 200;

export function crearPromptService(deps: PromptServiceDeps) {
  let cacheMaestro: string | null = null;

  /** Devuelve el maestro fresco, o null si no se pudo (el llamador decide). */
  async function bajarMaestro(): Promise<string | null> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetchImpl(deps.masterUrl, { signal: controller.signal });
      if (!res.ok) return null;
      const texto = await res.text();
      // Una descarga truncada o vacía no debe pisar una cache buena.
      if (texto.trim().length < (deps.minMaestroChars ?? MIN_MAESTRO_CHARS)) return null;
      cacheMaestro = texto;
      return texto;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async function resolverMaestro(): Promise<{ texto: string | null; desdeCache: boolean }> {
    const fresco = await bajarMaestro();
    if (fresco) return { texto: fresco, desdeCache: false };
    return { texto: cacheMaestro, desdeCache: cacheMaestro !== null };
  }

  return {
    /** Proyección para nanoclaw (canal de texto). */
    async texto(): Promise<ResultadoTexto> {
      const { texto, desdeCache } = await resolverMaestro();
      if (!texto) {
        return { ok: false, contenido: "", desdeCache: false, error: "no se pudo obtener el maestro" };
      }
      return {
        ok: true,
        contenido: proyectarTexto(parseMaestro(texto), deps.reglasTexto),
        desdeCache,
      };
    },

    /**
     * Proyección para ElevenLabs (canal de voz). `ok:false` significa que NO debe
     * publicarse: el maestro trae algo que en una llamada haría daño.
     */
    async voz(): Promise<ResultadoVoz> {
      const { texto, desdeCache } = await resolverMaestro();
      if (!texto) {
        return {
          ok: false,
          prompt: "",
          conocimiento: "",
          desdeCache: false,
          errores: ["no se pudo obtener el maestro"],
        };
      }
      const { prompt, conocimiento } = proyectarVoz(parseMaestro(texto), deps.reglasVoz);
      const val = validarProyeccionVoz(prompt);
      return { ok: val.ok, prompt, conocimiento, desdeCache, errores: val.errores };
    },
  };
}

