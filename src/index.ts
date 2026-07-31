import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadTools } from "./tools-loader.ts";
import { callEdgeFunction } from "./supabase-client.ts";
import { createMcpServer } from "./server.ts";
import { startHealthServer } from "./health.ts";
import { isAuthorized } from "./auth.ts";
import { handleToolHttpCall } from "./tool-http.ts";
import { normalizeCallerId, buildInitResponse, verifyElevenSignature } from "./eleven-webhooks.ts";
import { crearPromptService } from "./prompt-service.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** Read the raw request body as a string (needed to verify HMAC signatures). */
async function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const port = Number(process.env.MCP_PORT ?? "3000");
  // Optional bearer token guarding /mcp. Unset = guard disabled (safe only on a
  // private network). Set it before exposing /mcp to an external MCP client
  // (e.g. ElevenLabs) over the public internet. See src/auth.ts.
  const mcpAuthToken = process.env.MCP_AUTH_TOKEN;
  // Secret used to verify ElevenLabs post-call webhook HMAC signatures. Unset =
  // verification disabled (opt-in). Set it in production. See eleven-webhooks.ts.
  const elevenWebhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  // Optional Supabase edge function to forward the full post-call payload to
  // (transcript/analysis records). Unset = just log the summary.
  const postCallEdgeFn = process.env.ELEVEN_POSTCALL_EDGE_FN;

  const manifestPath =
    process.env.MCP_MONICA_MANIFEST_PATH ?? join(__dirname, "..", "mcp", "manifest.json");

  const tools = await loadTools(manifestPath);
  console.log(`mcp-monica: loaded ${tools.length} tools from ${manifestPath}`);

  // Proyector de prompt: una fuente maestra -> proyección por canal. Opcional:
  // si no hay URL de maestro configurada, el endpoint responde 503 y nanoclaw
  // sigue con la fuente que tenga configurada hoy.
  const promptDir = process.env.MONICA_PROMPT_DIR ?? join(__dirname, "..", "prompt");
  const masterUrl = process.env.MONICA_PROMPT_MASTER_URL;
  let promptService: ReturnType<typeof crearPromptService> | null = null;
  if (masterUrl) {
    try {
      const [reglasTexto, reglasVoz] = await Promise.all([
        readFile(join(promptDir, "canal-texto.md"), "utf8"),
        readFile(join(promptDir, "canal-voz.md"), "utf8"),
      ]);
      promptService = crearPromptService({ masterUrl, reglasTexto, reglasVoz });
      console.log(`mcp-monica: proyector de prompt activo (reglas de canal desde ${promptDir})`);
    } catch (err) {
      console.error("mcp-monica: no se pudieron leer las reglas de canal; proyector desactivado:", err);
    }
  }

  const callEdgeFn = (name: string, input: unknown, authOverride?: string) =>
    callEdgeFunction({ baseUrl: supabaseUrl, serviceRoleKey }, name, input, authOverride);

  // Single HTTP server: /health for healthcheck, /mcp for MCP transport
  // (POST for client-to-server, GET for server-to-client streaming).
  //
  // Stateless StreamableHTTP: a fresh Server instance + transport are
  // created per request (the MCP Server type does not allow re-using a
  // single instance across multiple transport connections — it errors
  // with "Already connected to a transport" on the second request).
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: tools.length }));
      return;
    }

    if (url.pathname === "/mcp") {
      if (!isAuthorized(req.headers.authorization, mcpAuthToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      const { server } = createMcpServer({ tools, callEdgeFn });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
        enableJsonResponse: true,
      });
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      try {
        await server.connect(transport);
        const body = req.method === "POST" ? await readBody(req) : undefined;
        await transport.handleRequest(req, res, body);
      } catch (err) {
        console.error("mcp-monica: transport error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "transport_error" }));
        }
      }
      return;
    }

    // REST tool-gateway for non-MCP consumers (e.g. ElevenLabs webhook tools):
    // POST /tools/<name> with the tool args as a flat JSON body. Same bearer
    // token guard as /mcp; the service_role key never leaves this server.
    if (url.pathname.startsWith("/tools/")) {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      if (!isAuthorized(req.headers.authorization, mcpAuthToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      const toolName = decodeURIComponent(url.pathname.slice("/tools/".length));
      let args: unknown;
      try {
        args = await readBody(req);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_json" }));
        return;
      }
      const { status, body } = await handleToolHttpCall(tools, callEdgeFn, toolName, args);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    // Proyección del prompt para el canal de TEXTO. nanoclaw la consume con su
    // recarga periódica (AGENT_SYSTEM_PROMPT_URL) y cachea en disco, así que un
    // 503 acá nunca lo deja sin prompt: sigue con su última copia buena.
    if (url.pathname === "/prompt/texto") {
      // Mismo guard que /mcp y /tools. Esta proyección lleva el prompt COMPLETO:
      // precios, márgenes, playbook de ventas, reglas de escalamiento y los datos
      // bancarios de respaldo de §6.2 (CLABE y titular). Sin token, cualquiera con
      // la URL se descarga la operación comercial entera.
      if (!isAuthorized(req.headers.authorization, mcpAuthToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      if (!promptService) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "proyector_no_configurado" }));
        return;
      }
      const r = await promptService.texto();
      if (!r.ok) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "maestro_no_disponible", detalle: r.error }));
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Prompt-Desde-Cache": String(r.desdeCache),
      });
      res.end(r.contenido);
      return;
    }

    // ElevenLabs conversation-initiation webhook: look up the patient by caller
    // id and return dynamic variables for the Mónica voice agent.
    if (url.pathname === "/webhooks/eleven-init") {
      if (!isAuthorized(req.headers.authorization, mcpAuthToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      let callerId: string | null = null;
      try {
        const payload = (await readBody(req)) as { caller_id?: unknown } | undefined;
        callerId = normalizeCallerId(
          typeof payload?.caller_id === "string" ? payload.caller_id : undefined,
        );
      } catch {
        callerId = null;
      }
      // patient-context resuelve la identidad Y devuelve el expediente vivo ya
      // redactado (A01). Antes esto llamaba a search-patient, que solo traía el
      // nombre: Mónica reconocía a la persona pero no sabía nada de lo hablado
      // antes, así que cada llamada empezaba de cero.
      let contexto: unknown;
      if (callerId) {
        const result = await callEdgeFn("patient-context", {
          channel: "llamada",
          external_id: callerId,
          telefono: callerId,
        });
        if (result.ok) contexto = result.data;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(buildInitResponse(contexto)));
      return;
    }

    // ElevenLabs post-call webhook: verify the HMAC signature, then log the
    // outcome (business writes already happened via tools during the call) and
    // optionally forward the transcript to a Supabase edge function.
    if (url.pathname === "/webhooks/eleven-post-call") {
      const raw = await readRawBody(req);
      const sig = req.headers["elevenlabs-signature"];
      const sigHeader = Array.isArray(sig) ? sig[0] : sig;
      if (!verifyElevenSignature(raw, sigHeader, elevenWebhookSecret, Date.now(), 1800)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_signature" }));
        return;
      }
      let data: { data?: { conversation_id?: unknown; analysis?: { call_successful?: unknown } } } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        /* keep empty on non-JSON body */
      }
      console.log(
        `mcp-monica: post-call conversation=${String(data?.data?.conversation_id)} ` +
          `successful=${String(data?.data?.analysis?.call_successful)}`,
      );
      if (postCallEdgeFn && raw) {
        // Si la edge function tiene su propio guard (INGEST_CALL_TOKEN), se le
        // manda ESE token y no la service_role: de lo contrario rechazaría cada
        // entrega con 401 y las llamadas nunca llegarían al CRM.
        await callEdgeFn(postCallEdgeFn, data, process.env.INGEST_CALL_TOKEN);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.log(`mcp-monica: listening on http://0.0.0.0:${port}`);
    console.log(`  health: GET            /health`);
    console.log(`  mcp:    POST/GET/DELETE /mcp  (StreamableHTTP transport)`);
  });

  // startHealthServer kept as helper module for future split scenarios.
  void startHealthServer;

  // Graceful shutdown
  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
