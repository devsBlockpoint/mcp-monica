import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadTools } from "./tools-loader.ts";
import { callEdgeFunction } from "./supabase-client.ts";
import { createMcpServer } from "./server.ts";
import { startHealthServer } from "./health.ts";

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

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const port = Number(process.env.MCP_PORT ?? "3000");

  const manifestPath =
    process.env.MCP_MONICA_MANIFEST_PATH ?? join(__dirname, "..", "mcp", "manifest.json");

  const tools = await loadTools(manifestPath);
  console.log(`mcp-monica: loaded ${tools.length} tools from ${manifestPath}`);

  const callEdgeFn = (name: string, input: unknown) =>
    callEdgeFunction({ baseUrl: supabaseUrl, serviceRoleKey }, name, input);

  const { server: mcpServer } = createMcpServer({ tools, callEdgeFn });

  // Stateless StreamableHTTP transport (no session state — each request
  // is independent). Replaces the deprecated SSEServerTransport. The
  // Claude Code MCP client connects via this transport at /mcp.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });
  await mcpServer.connect(transport);

  // Single HTTP server: /health for healthcheck, /mcp for MCP transport
  // (POST for client-to-server, GET for server-to-client streaming).
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: tools.length }));
      return;
    }

    if (url.pathname === "/mcp") {
      try {
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
