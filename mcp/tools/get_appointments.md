---
tool_name: get_appointments
edge_function: get-appointments
mcp_exposed: true
description: Lista citas próximas o pasadas de un paciente identificado por WhatsApp.
input_schema:
  type: object
  description: "Al menos UNO de los filtros de identificación o rango debe estar presente."
  properties:
    paciente_whatsapp: { type: string, description: "Solo dígitos" }
    paciente_id: { type: string, format: uuid }
    fecha_desde: { type: string, format: date }
    fecha_hasta: { type: string, format: date }
    estatus:
      type: string
      enum: [Confirmada, Realizada, Cancelada, Reprogramada, "Pendiente de Anticipo"]
    timeframe:
      type: string
      enum: [upcoming, past, all]
output_schema:
  type: object
  properties:
    citas:
      type: array
      description: "Hasta 50 resultados, ordenados por fecha+hora ASC"
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          fecha: { type: string, format: date }
          hora: { type: string, description: "HH:MM" }
          paciente_nombre: { type: string }
          paciente_whatsapp: { type: string }
          servicio_nombre: { type: string }
          estatus: { type: string }
          esteticista_nombre: { type: string }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [citas, pacientes]
---

# get_appointments

## Cuándo invocar
- Usuario pregunta "¿qué fecha tengo?", "¿cuándo es mi próxima cita?"
- Antes de proponer reagendar — confirmar la cita actual
