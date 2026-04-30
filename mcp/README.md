# MCP Tool Registry

Single source of truth for the tools the Mónica AI agent can invoke. Each `tools/<name>.md` file is parsed by `_generator.ts` to produce `manifest.json`, which `chat-assistant` consumes at runtime.

## How to add a tool

1. Create `tools/<tool_name>.md` with the frontmatter schema below.
2. Run `npm run mcp:build` to regenerate `manifest.json`.
3. Commit both the new doc and the updated manifest.
4. If the tool maps to a new edge function, add the corresponding folder under `supabase/functions/` and implement it.

## Frontmatter schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `tool_name` | snake_case string | yes | What the LLM sees when invoking. Spanish preferred for ÉLEVÉ. |
| `edge_function` | kebab-case string | yes | Folder name under `supabase/functions/`. May be `pending` until implemented. |
| `mcp_exposed` | boolean | yes | `false` for plumbing/admin-only — won't appear in manifest. |
| `description` | string | yes | One-line summary the LLM uses to decide when to call. |
| `input_schema` | JSON Schema | yes | Validates the LLM's tool call payload. |
| `output_schema` | JSON Schema | yes | Documents the response. |
| `side_effects` | array of strings | yes | Empty array for pure read tools. |
| `auth` | string | yes | Usually `service_role`. |
| `errors` | array of `{code, when}` | optional | Error contract. |
| `implementation_status` | enum | yes | `implemented`, `pending`, `blocked_on_payment_gateway`, `deprecated`. |
| `related_db_tables` | array of strings | optional | For provenance. |

## Naming convention

- **Tool name** (LLM-facing): `snake_case`, Spanish — `obtener_servicios`.
- **Edge function path**: `kebab-case`, English — `get-services`.
- **Tool doc filename**: matches `tool_name` — `obtener_servicios.md`.

## What's not in the registry

Plumbing endpoints (`whatsapp-send`, `n8n-whatsapp-agent-response`, `whatsapp-webhook`, etc.) are documented in `_pipeline.md` instead. They are framework, not tools.
