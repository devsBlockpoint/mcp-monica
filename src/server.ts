import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition } from "./tools-loader.ts";
import type { EdgeFunctionResult } from "./supabase-client.ts";

export interface ServerDeps {
  tools: ToolDefinition[];
  callEdgeFn: (name: string, input: unknown) => Promise<EdgeFunctionResult>;
}

export interface McpServerHandle {
  server: Server;
  // Exposed for tests; do not use from production code paths
  _handlers: {
    listTools: () => Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }>;
    callTool: (req: {
      params: { name: string; arguments?: Record<string, unknown> };
    }) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      isError?: boolean;
    }>;
  };
}

export function createMcpServer(deps: ServerDeps): McpServerHandle {
  const server = new Server(
    { name: "mcp-monica", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const toolsByName = new Map(deps.tools.map((t) => [t.name, t]));

  const listTools: McpServerHandle["_handlers"]["listTools"] = async () => ({
    tools: deps.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });

  const callTool: McpServerHandle["_handlers"]["callTool"] = async (req) => {
    const { name, arguments: args = {} } = req.params;
    const tool = toolsByName.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    const result = await deps.callEdgeFn(tool.edgeFunction, args);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error.message }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result.data) }],
    };
  };

  server.setRequestHandler(ListToolsRequestSchema, listTools);
  server.setRequestHandler(CallToolRequestSchema, callTool);

  return { server, _handlers: { listTools, callTool } };
}
