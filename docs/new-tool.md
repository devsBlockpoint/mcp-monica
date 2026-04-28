# Agregar una tool nueva — walkthrough

Pasos para exponer una nueva edge function al LLM.

## 1. ¿La edge function existe en Supabase?

- **Sí, ya implementada y testeada**: avanzá.
- **No**: implementala primero del lado Supabase. Este doc asume que ya hay un endpoint `POST ${SUPABASE_URL}/functions/v1/<nombre>` funcionando.

## 2. Crear `mcp/tools/<tool_name>.md`

Convención: `tool_name` en snake_case en español (ej. `obtener_servicios`).

```markdown
---
tool_name: obtener_servicios
edge_function: get-services
mcp_exposed: true
description: Lista los servicios estéticos disponibles en el catálogo.
input_schema:
  type: object
  properties:
    categoria:
      type: string
      description: "Filtrar por categoría (opcional)"
output_schema:
  type: object
  properties:
    servicios:
      type: array
      items:
        type: object
        properties:
          id: { type: string }
          nombre: { type: string }
          precio: { type: number }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [servicios]
---

# obtener_servicios

Devuelve el catálogo de servicios. Si se pasa `categoria`, filtra.

## Cuándo invocar
- Usuario pregunta qué servicios hay
- Antes de `agendar_cita` si el usuario no especificó qué quiere
```

## 3. Regenerar el manifest

```bash
npm run mcp:build
```

Si el generator se queja de validación (campo faltante, edge_function no encontrada, etc.), corregí.

## 4. Test local

```bash
npm test                              # debería pasar; los tests están parametrizados sobre el manifest
npm start                             # arranca server
curl http://localhost:3000/health     # debe responder ok
```

Conectá un cliente MCP (ej. nanoclaw apuntando local) y verificá que la nueva tool aparece en `tools/list` y responde a `tools/call`.

## 5. Commit

```bash
git add mcp/tools/obtener_servicios.md mcp/manifest.json
git commit -m "feat(tools): expose obtener_servicios"
```

## 6. Build & deploy

Imagen Docker se reconstruye en CI/CD; redeploy de Easypanel toma el nuevo manifest sin que toques nada más.
