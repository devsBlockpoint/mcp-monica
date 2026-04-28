# Tool Registry — pipeline md → manifest → MCP

El "registry" de mcp-monica vive en `mcp/` y es la **single source of truth** para qué tools expone el server.

## Pipeline

```
mcp/tools/<nombre>.md  (markdown con frontmatter)
       │
       │  npm run mcp:build
       ▼
mcp/_generator.ts  (parse, validate, filter)
       │
       ▼
mcp/manifest.json  (committed)
       │
       │  boot del server
       ▼
src/tools-loader.ts  (lee manifest)
       │
       ▼
src/server.ts  (registra cada tool en el MCP SDK)
```

## Frontmatter requerido

Documentado en [`mcp/README.md`](../mcp/README.md). Resumen:

- `tool_name` (snake_case ES, LLM-facing)
- `edge_function` (kebab-case EN, folder en `supabase/functions/`)
- `mcp_exposed` (bool)
- `description`
- `input_schema` (JSON Schema)
- `implementation_status` (`implemented` | `pending` | `blocked_on_payment_gateway` | `deprecated`)

## Filtros

`_generator.ts` excluye del manifest:
- Tools con `mcp_exposed: false`.
- Tools con `implementation_status` distinto de `implemented` (a menos que se invoque con `--include-pending`).

Por defecto, mcp-monica solo expone tools listas para producción. Las pending quedan documentadas pero no llamables.

## Validación al build

`_generator.ts` falla con código de salida ≠ 0 si:
- Falta un campo requerido del frontmatter.
- `tool_name` no es snake_case.
- Hay duplicados de `tool_name`.
- `implementation_status: implemented` pero `supabase/functions/<edge_function>/` no existe en el repo padre (asume layout monorepo Supabase preexistente; si no aplica en este monorepo, esa validación pasa solo cuando estés en el repo Supabase).

## Hot-reload (no, todavía)

`manifest.json` se bundlea en la imagen Docker. Cambiar tools = rebuild + redeploy. Si en el futuro necesitamos hot-reload (refetch del manifest cada N seg), se agrega como feature opcional sin breaking changes.
