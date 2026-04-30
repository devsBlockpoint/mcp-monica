---
tool_name: send_payment_link
edge_function: send-payment-link
mcp_exposed: true
description: Envía un link de pago al usuario para anticipos (ELEVEGLOW $300, anticipo de cita).
input_schema:
  type: object
  required: [whatsapp, monto, concepto]
  properties:
    whatsapp: { type: string }
    monto: { type: number }
    concepto: { type: string, description: "Ej. 'Anticipo ELEVEGLOW', 'Anticipo cita HIFU'" }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    payment_url: { type: string, format: uri }
side_effects:
  - "Crea registro de intent de pago en pasarela elegida"
auth: service_role
implementation_status: blocked_on_payment_gateway
related_db_tables: []
---

# send_payment_link

**No implementar hasta que la pasarela esté decidida** (pendiente del REQ §9).

## Cuándo invocar (eventualmente)
- ELEVEGLOW: el usuario aceptó reservar
- Anticipo de cita: cita está en `Pendiente de Anticipo` y usuario lo solicita
