# Auth — service_role y secretos

mcp-monica usa exclusivamente la **service_role key** de Supabase para invocar edge functions.

## Qué significa service_role

Es un JWT con privilegios elevados que bypassea Row Level Security (RLS). Las edge functions que validan `auth.role() === 'service_role'` aceptan estas requests.

**Implicaciones de seguridad:**
- mcp-monica con la service_role key puede leer/escribir cualquier tabla. Por eso es secreto crítico.
- mcp-monica NO está expuesto a Internet en producción. Solo es accesible desde la red interna de docker-compose por nanoclaw.
- Si un atacante consigue acceso a mcp-monica, tiene acceso al backend de ÉLEVÉ. Mitigaciones:
  - Container sin puertos expuestos al host (`expose:`, no `ports:`).
  - Firewall a nivel red (Easypanel maneja esto por defecto en stacks privados).
  - Rotación periódica de la key.

## Dónde vive el secreto

- **Dev local**: en `.env` del monorepo raíz, montado al container vía docker-compose. NUNCA commitear `.env`.
- **Easypanel**: en el panel de env vars del servicio mcp-monica. Encriptado at-rest.

## Qué NO usamos

- **anon key**: no la usamos. mcp-monica no expone funcionalidad pública.
- **JWT del usuario final**: el agente actúa como sistema, no como un usuario; la service_role es la representación correcta.

## Auditoría

Si necesitás trazar qué tool llamó qué edge function, los logs de Supabase Edge Functions registran cada invocación con timestamp y body. Del lado mcp-monica, cada tool call se loguea con `tool_name`, `edge_function`, status HTTP, y duración (sin loguear body por privacidad — los inputs pueden tener PII del paciente).
