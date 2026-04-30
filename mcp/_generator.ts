#!/usr/bin/env tsx
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, "tools");
const FUNCTIONS_DIR = join(__dirname, "..", "..", "supabase", "functions");
const MANIFEST_PATH = join(__dirname, "manifest.json");

const REQUIRED_KEYS = [
  "tool_name",
  "edge_function",
  "mcp_exposed",
  "description",
  "input_schema",
  "implementation_status",
] as const;

const VALID_STATUS = new Set([
  "implemented",
  "pending",
  "blocked_on_payment_gateway",
  "deprecated",
]);

const args = new Set(process.argv.slice(2));
const includePending = args.has("--include-pending");
const skipFsCheck = args.has("--skip-fs-check") || process.env.MCP_SKIP_FN_FS_CHECK === "1";

interface ToolFrontmatter {
  tool_name: string;
  edge_function: string;
  mcp_exposed: boolean;
  description: string;
  input_schema: unknown;
  output_schema?: unknown;
  side_effects?: string[];
  auth?: string;
  errors?: Array<{ code: number; when: string }>;
  implementation_status: string;
  related_db_tables?: string[];
}

const errors: string[] = [];
const tools: ToolFrontmatter[] = [];
const seen = new Set<string>();

const files = readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));

for (const file of files) {
  const path = join(TOOLS_DIR, file);
  const { data } = matter(readFileSync(path, "utf8"));
  const fm = data as Partial<ToolFrontmatter>;

  for (const key of REQUIRED_KEYS) {
    if (fm[key] === undefined || fm[key] === null) {
      errors.push(`${file}: missing required key '${key}'`);
    }
  }

  if (typeof fm.tool_name === "string") {
    if (!/^[a-z][a-z0-9_]*$/.test(fm.tool_name)) {
      errors.push(`${file}: tool_name must be snake_case (got '${fm.tool_name}')`);
    }
    if (seen.has(fm.tool_name)) {
      errors.push(`${file}: duplicate tool_name '${fm.tool_name}'`);
    }
    seen.add(fm.tool_name);
  }

  if (
    typeof fm.implementation_status === "string" &&
    !VALID_STATUS.has(fm.implementation_status)
  ) {
    errors.push(
      `${file}: invalid implementation_status '${fm.implementation_status}' (must be one of ${[...VALID_STATUS].join(", ")})`,
    );
  }

  if (!skipFsCheck && fm.implementation_status === "implemented" && typeof fm.edge_function === "string") {
    const fnDir = join(FUNCTIONS_DIR, fm.edge_function);
    if (!existsSync(fnDir)) {
      errors.push(
        `${file}: implementation_status='implemented' but supabase/functions/${fm.edge_function}/ does not exist`,
      );
    }
  }

  tools.push(fm as ToolFrontmatter);
}

if (errors.length) {
  console.error("Manifest generation failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

const exposed = tools.filter((t) => {
  if (!t.mcp_exposed) return false;
  if (t.implementation_status === "implemented") return true;
  if (includePending && t.implementation_status === "pending") return true;
  return false;
});

const manifest = {
  version: "1",
  generated_at: new Date().toISOString(),
  tools: exposed.map((t) => ({
    tool_name: t.tool_name,
    edge_function: t.edge_function,
    description: t.description,
    input_schema: t.input_schema,
    output_schema: t.output_schema ?? null,
  })),
};

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `manifest.json written with ${manifest.tools.length} tool(s) (${tools.length - exposed.length} excluded).`,
);
