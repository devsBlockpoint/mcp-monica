---
tool_name: reschedule_appointment
edge_function: reschedule-appointment
mcp_exposed: true
description: Reagenda una cita a nueva fecha/hora. Mantiene el mismo paciente y servicio.
input_schema:
  type: object
  required: [cita_id, nueva_fecha, nueva_hora]
  properties:
    cita_id: { type: string, format: uuid }
    nueva_fecha: { type: string, format: date }
    nueva_hora: { type: string, pattern: "^[0-9]{2}:[0-9]{2}", description: "HH:MM" }
    tipo:
      type: string
      enum: [antes, despues]
      description: "Opcional — si se omite, estatus default 'Reprogramada'"
output_schema:
  type: object
  properties:
    success: { type: boolean }
    cita_id: { type: string, format: uuid }
    fecha: { type: string, format: date }
    hora: { type: string }
side_effects:
  - "UPDATE citas SET fecha, hora, estatus"
  - "POST n8n-calendar-webhook (event_type='update')"
auth: service_role
errors:
  - code: cita_not_found
    when: cita_id no existe (HTTP 404)
  - code: cita_already_cancelled
    when: cita ya cancelada (HTTP 400)
  - code: cita_already_completed
    when: cita ya realizada (HTTP 400)
  - code: slot_unavailable
    when: nuevo slot no disponible (HTTP 409)
implementation_status: implemented
related_db_tables: [citas, esteticistas]
---

# reschedule_appointment

## Cuándo invocar
- Usuario quiere cambiar fecha de cita existente
- Llamar `buscar_disponibilidad` antes para confirmar el nuevo slot
