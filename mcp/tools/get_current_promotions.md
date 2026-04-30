---
tool_name: get_current_promotions
edge_function: get-current-promotions
mcp_exposed: true
description: Devuelve las promociones activas configuradas en ofertas_config (Ofertas Doradas, etc.).
input_schema:
  type: object
  properties: {}
output_schema:
  type: object
  properties:
    promociones:
      type: array
      description: "Filtro: WHERE activo=true AND fecha_fin >= now() ORDER BY fecha_fin ASC"
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          nombre: { type: string }
          fecha_inicio: { type: string, format: date }
          fecha_fin: { type: string, format: date }
          activo: { type: boolean }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [ofertas_config]
---

# get_current_promotions

Reemplaza el bloque hardcoded "🌟 OFERTAS DORADAS 🌟" del system prompt original.

## Cuándo invocar
- Usuario pregunta por "ofertas doradas", "promociones", "descuentos"
- Antes de cierre conversacional — Mónica puede surfacear ofertas relevantes
