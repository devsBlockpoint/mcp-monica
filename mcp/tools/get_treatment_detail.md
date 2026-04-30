---
tool_name: get_treatment_detail
edge_function: get-treatment-detail
mcp_exposed: true
description: Información detallada de un tratamiento específico (mecanismo, equipo, sesiones, contraindicaciones).
input_schema:
  type: object
  required: [slug]
  properties:
    slug: { type: string, description: "Identificador slug del tratamiento (ej. 'hifu-12d')" }
output_schema:
  type: object
  properties:
    slug: { type: string }
    nombre: { type: string }
    descripcion: { type: string }
    precio_regular: { type: integer }
    duracion_minutos: { type: integer }
    para_quien:
      type: array
      items: { type: string }
    no_para_quien:
      type: array
      items: { type: string }
    proceso:
      type: array
      items: { type: string }
    faqs:
      type: array
      items:
        type: object
        properties:
          q: { type: string }
          a: { type: string }
errors:
  - code: treatment_not_found
    when: slug no existe (HTTP 404)
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [servicios_paquetes, servicios_sesiones, equipos]
---

# get_treatment_detail

## Cuándo invocar
- Usuario pregunta "¿qué hace el HIFU?", "¿es doloroso?"
- Antes de cierre — surfacear info técnica para construir confianza
