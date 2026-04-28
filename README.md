# mcp-monica

MCP server que expone al LLM (Mónica, vía nanoclaw) las edge functions de negocio de ÉLEVÉ alojadas en Supabase.

## Qué es y qué no es

**Es** un thin proxy: lee `mcp/manifest.json`, registra cada tool en el MCP server, y al ser invocada hace `POST` a la edge function correspondiente en Supabase con auth `service_role`.

**No es** lógica de negocio. La verdad del dominio (citas, pacientes, pagos) vive en Supabase Edge Functions y Postgres. Si una tool pide un comportamiento nuevo, el cambio va en la edge function, no acá.

## Quick start

```bash
cp ../.env.example .env
# completar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run mcp:build
npm start
# server escuchando en MCP_PORT (default 3000)
curl http://localhost:3000/health  # → {"status":"ok"}
```

## Estructura

- `mcp/` — registry source of truth (markdown frontmatter + generator). Pre-existe; no se modifica desde acá.
- `src/` — implementación del MCP server.
- `tests/` — tests unitarios e integración con Vitest.
- `docs/` — guías de desarrollo (tool-registry, auth, agregar tool nueva).

## Cómo agregar una tool

Ver [`docs/new-tool.md`](docs/new-tool.md). Resumen: crear `mcp/tools/<nombre>.md` con frontmatter, correr `npm run mcp:build`, commitear ambos archivos.

## Contratos

- **Inbound (MCP)**: protocolo MCP estándar sobre HTTP/SSE. Los clientes (nanoclaw) descubren tools dinámicamente al conectar.
- **Outbound (Supabase)**: HTTPS POST a `${SUPABASE_URL}/functions/v1/${edge_function}` con `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` y `Content-Type: application/json`.

## Mapeo de errores

| HTTP | MCP |
|---|---|
| 2xx | Tool result OK |
| 4xx | MCP error con `code` y `message` del payload (visible al LLM para que reaccione) |
| 5xx | MCP error genérico ("Internal error"), sin filtrar detalles. Stack logueado solo del lado del server. |
| Timeout (>10s) | MCP error timeout |

## Variables de entorno

Ver `.env.example` en el monorepo raíz. Las relevantes para mcp-monica:

- `SUPABASE_URL` — URL del proyecto Supabase de ÉLEVÉ.
- `SUPABASE_SERVICE_ROLE_KEY` — secreto, NO commitear. Permite invocar edge functions con auth=service_role.
- `MCP_PORT` — puerto interno (default 3000). En docker-compose se accede desde la red `eleve-net`.

## Repo padre

Este repo es subproyecto del monorepo [`devsBlockpoint/eleve-nanoclaw`](https://github.com/devsBlockpoint/eleve-nanoclaw) (a crear). Para levantar todo el stack ÉLEVÉ con nanoclaw + mcp-monica + docker-compose, ver el README del monorepo.
