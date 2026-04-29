import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

  // Single HTTP server: /health for healthcheck, /mcp/sse for MCP transport.
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: tools.length }));
      return;
    }

    if (url.pathname === "/mcp/sse") {
      const transport = new SSEServerTransport("/mcp/sse", res);
      await mcpServer.connect(transport);
      // SSEServerTransport keeps `res` open; do NOT call res.end() here.
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.log(`mcp-monica: listening on http://0.0.0.0:${port}`);
    console.log(`  health: GET  /health`);
    console.log(`  mcp:    GET  /mcp/sse`);
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
