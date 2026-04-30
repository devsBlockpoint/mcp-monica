---
tool_name: obtener_servicios
edge_function: get-services
mcp_exposed: true
description: Lista los servicios disponibles (paquetes y sesiones individuales) con precios y duración.
input_schema:
  type: object
  properties: {}
output_schema:
  type: object
  properties:
    paquetes:
      type: array
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          nombre: { type: string }
          precio_regular: { type: integer }
          precio_especial: { type: integer }
          categoria: { type: string }
          sesiones: { type: integer }
          ahorro: { type: integer }
          descripcion: { type: string }
    serviciosIndividuales:
      type: array
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          nombre: { type: string }
          precio_regular: { type: integer }
          categoria: { type: string }
          duracion_minutos: { type: integer }
          descripcion: { type: string }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [servicios_paquetes, servicios_sesiones]
---

# obtener_servicios

Devuelve el catálogo de servicios. Mónica lo usa cuando el usuario pregunta "¿qué tratamientos tienen?", "¿qué hacen para celulitis?", o cuando necesita listar opciones antes de un agendamiento.

## Cuándo invocar
- Usuario pregunta por servicios, tratamientos, paquetes
- Antes de proponer agendamiento, para confirmar IDs y precios

## Cuándo NO invocar
- Usuario ya seleccionó servicio específico — pasar directo a `buscar_disponibilidad`
