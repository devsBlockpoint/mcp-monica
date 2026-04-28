# CLAUDE.md — mcp-monica (DEV index)

Entry point para Claude Code cuando trabajás dentro del subproyecto `mcp-monica`.

> Este `CLAUDE.md` es de desarrollo. mcp-monica NO carga ningún system prompt en runtime; es un servidor MCP, no un agente.

## Qué hay acá

```
mcp-monica/
├── README.md                # entry humano
├── CLAUDE.md                # este archivo
├── package.json             # Node + TS
├── Dockerfile
├── src/
│   ├── index.ts             # entry: env, arranca server
│   ├── server.ts            # MCP SDK wiring
│   ├── tools-loader.ts      # parse manifest, devuelve definiciones MCP
│   ├── supabase-client.ts   # POST a edge functions
│   ├── errors.ts            # HTTP → MCP errors
│   └── health.ts            # /health endpoint
├── tests/
│   ├── errors.test.ts
│   ├── supabase-client.test.ts
│   ├── tools-loader.test.ts
│   └── server.test.ts
├── mcp/                     # registry — preexistente, NO MODIFICAR estructura
│   ├── README.md            # formato del frontmatter
│   ├── _pipeline.md         # plumbing endpoints (no son tools)
│   ├── _generator.ts        # md → manifest.json
│   ├── manifest.json        # generado
│   └── tools/*.md           # tools (frontmatter source of truth)
└── docs/
    ├── tool-registry.md
    ├── edge-functions-map.md
    ├── auth.md
    └── new-tool.md
```

## Por dónde empezar según la tarea

| Tarea | Empezá por |
|---|---|
| Entender el server | [`docs/tool-registry.md`](docs/tool-registry.md), `src/server.ts`, `src/tools-loader.ts` |
| Agregar una tool nueva | [`docs/new-tool.md`](docs/new-tool.md) |
| Saber qué edge function llama cada tool | [`docs/edge-functions-map.md`](docs/edge-functions-map.md) |
| Cambiar manejo de errores | `src/errors.ts` + `tests/errors.test.ts` |
| Modificar transporte / wiring MCP | `src/server.ts`, `src/index.ts` |
| Tocar autenticación | [`docs/auth.md`](docs/auth.md), `src/supabase-client.ts` |

## Convenciones

- **Sin lógica de negocio acá**. La lógica vive en Supabase Edge Functions. Si una request requiere transformaciones de datos no triviales, eso va en la edge function, no en mcp-monica.
- **Naming de tools**: snake_case en español (LLM-facing, ej. `agendar_cita`). Edge function path: kebab-case en inglés (ej. `book-appointment`). Definido por el registry; este server lo respeta.
- **TDD**: cada módulo en `src/` tiene su test en `tests/`. Vitest (`npm test`).
- **Errores HTTP**: 2xx OK, 4xx visible al LLM (mapeado), 5xx genérico (no filtrar internals al LLM).
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

## Repo padre

Este repo es subproyecto. El monorepo padre es `devsBlockpoint/eleve-nanoclaw` y aloja docs cross-proyecto, docker-compose, ADRs.
