---
tool_name: agendar_cita
edge_function: book-appointment
mcp_exposed: true
description: Crea una cita en estatus 'Pendiente de Anticipo'. Auto-asigna esteticista con menos citas ese día.
input_schema:
  type: object
  required: [nombre, whatsapp, fecha, hora, servicio_nombre]
  properties:
    nombre: { type: string }
    whatsapp: { type: string, description: "Solo dígitos, 10-15 caracteres" }
    fecha: { type: string, format: date }
    hora: { type: string, pattern: "^[0-9]{2}:[0-9]{2}", description: "HH:MM 24h" }
    servicio_nombre: { type: string }
    servicio_id: { type: string, format: uuid, description: "Opcional" }
    esteticista_id: { type: string, format: uuid, description: "Opcional" }
    notas: { type: string, description: "Opcional" }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    cita_id: { type: string, format: uuid }
    mensaje: { type: string }
    datos_pago:
      type: object
      properties:
        banco: { type: string }
        titular: { type: string }
        clabe: { type: string }
        concepto: { type: string }
        monto: { type: string }
side_effects:
  - "INSERT pacientes (si whatsapp no existe)"
  - "INSERT citas (estatus='Pendiente de Anticipo')"
  - "Auto-asigna esteticista con menos citas ese día"
  - "Notifica n8n-calendar-webhook (best-effort vía useCitas en frontend; aquí no aplica)"
auth: service_role
errors:
  - code: validation_failed
    when: Campos requeridos vacíos o inválidos
  - code: horario_no_disponible
    when: Slot ya no disponible
implementation_status: implemented
related_db_tables: [citas, pacientes, esteticistas]
---

# agendar_cita

Confirma una cita después de que el usuario eligió un slot.

## Cuándo invocar
- Usuario confirmó nombre, WhatsApp, fecha, hora y servicio
- `buscar_disponibilidad` reciente confirmó el slot

## Cuándo NO invocar
- Datos faltantes — pedirlos al usuario primero
- Slot caducado (>5 min) — re-validar disponibilidad
