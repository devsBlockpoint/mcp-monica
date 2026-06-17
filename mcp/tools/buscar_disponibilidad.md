---
tool_name: buscar_disponibilidad
edge_function: check-availability
mcp_exposed: true
description: Devuelve los slots de horario disponibles para una fecha dada.
input_schema:
  type: object
  required: [fecha]
  properties:
    fecha:
      type: string
      format: date
      description: "YYYY-MM-DD"
    esteticista_id:
      type: string
      format: uuid
      description: "Opcional — filtra por esteticista específica"
    servicio_nombre:
      type: string
      description: "Nombre exacto del servicio (de obtener_servicios). Determina la duración para calcular slots que no se empalmen. Si se omite, se asume 60 min."
output_schema:
  type: object
  properties:
    fecha: { type: string, format: date }
    horasDisponibles:
      type: array
      items: { type: string, description: "HH:MM" }
    esteticistas:
      type: array
      items: { type: string }
    mensaje: { type: string }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [citas, esteticistas]
---

# buscar_disponibilidad

Consulta horarios libres considerando todas las esteticistas activas y citas existentes.

## Cuándo invocar
- Usuario propone una fecha — siempre llamar antes de `agendar_cita`
- Si la respuesta de `buscar_disponibilidad` tiene >5 minutos, re-llamar antes de `agendar_cita`

## Notas
- Filtra esteticistas con `estatus='Activa'`.
- **Pasá `servicio_nombre`** (el que el usuario eligió, de `obtener_servicios`) para que los slots respeten la duración real del tratamiento y no se empalmen.
- Considera la duración de las citas existentes: ocupa el bloque completo `[inicio, inicio+duración)`, no solo la hora de inicio.
