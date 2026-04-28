import { readFile } from "node:fs/promises";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  edgeFunction: string;
}

interface ManifestToolEntry {
  tool_name?: string;
  edge_function?: string;
  description?: string;
  input_schema?: object;
}

interface Manifest {
  version?: string;
  tools?: ManifestToolEntry[];
}

export async function loadTools(manifestPath: string): Promise<ToolDefinition[]> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (err) {
    throw new Error(`Cannot read manifest at ${manifestPath}: ${(err as Error).message}`);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest is not valid JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(manifest.tools)) {
    throw new Error(`Manifest 'tools' must be an array`);
  }

  return manifest.tools.map((entry, idx) => {
    if (!entry.tool_name || typeof entry.tool_name !== "string") {
      throw new Error(`Manifest entry [${idx}]: missing or invalid 'tool_name'`);
    }
    if (!entry.edge_function || typeof entry.edge_function !== "string") {
      throw new Error(`Manifest entry [${idx}] (${entry.tool_name}): missing or invalid 'edge_function'`);
    }
    return {
      name: entry.tool_name,
      description: entry.description ?? "",
      inputSchema: entry.input_schema ?? { type: "object" },
      edgeFunction: entry.edge_function,
    };
  });
}
