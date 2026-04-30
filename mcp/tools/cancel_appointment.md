---
tool_name: cancel_appointment
edge_function: cancel-appointment
mcp_exposed: true
description: Cancela una cita, registrando el motivo. La cita queda con estatus='Cancelada'.
input_schema:
  type: object
  required: [cita_id]
  properties:
    cita_id: { type: string, format: uuid }
    motivo: { type: string, description: "Razón de la cancelación" }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    cita_id: { type: string }
side_effects:
  - "UPDATE citas SET estatus='Cancelada', motivo_cancelacion=motivo"
  - "POST n8n-calendar-webhook (event_type='cancel')"
auth: service_role
errors:
  - code: cita_not_found
    when: cita_id no existe (HTTP 404)
  - code: cita_already_cancelled
    when: La cita ya está en estatus 'Cancelada' (HTTP 400)
implementation_status: implemented
related_db_tables: [citas]
---

# cancel_appointment

## Cuándo invocar
- Usuario pide cancelar explícitamente
- Confirmar con el usuario antes de invocar — la acción no es reversible

## Cuándo NO invocar
- Si el usuario quiere cambiar fecha — usar `reschedule_appointment` en su lugar
