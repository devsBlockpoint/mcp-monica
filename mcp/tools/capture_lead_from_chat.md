---
tool_name: capture_lead_from_chat
edge_function: capture-lead-from-chat
mcp_exposed: true
description: Registra un lead a partir de una conversación entrante (cuando el usuario llegó por WhatsApp, no por formulario).
input_schema:
  type: object
  required: [nombre, whatsapp, conversation_id]
  properties:
    nombre: { type: string }
    whatsapp: { type: string, description: "Solo dígitos, 10-15 caracteres (normalizado server-side)" }
    conversation_id: { type: string, format: uuid }
    motivo: { type: string, description: "Opcional" }
    payload: { type: object, description: "Opcional, jsonb arbitrario" }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    lead_id: { type: string, format: uuid }
side_effects:
  - "INSERT leads (source_page='whatsapp_inbound', source_form='whatsapp_organic', conversation_id linked)"
  - "DB trigger dispatches lead-pickup → CRM notified"
auth: service_role
errors:
  - code: conversation_not_found
    when: conversation_id no existe (HTTP 404)
  - code: invalid_whatsapp
    when: whatsapp con formato inválido (HTTP 400)
  - code: validation_failed
    when: campos inválidos (HTTP 400)
implementation_status: implemented
related_db_tables: [leads, whatsapp_conversations]
---

# capture_lead_from_chat

## Cuándo invocar
- Usuario contactó por WhatsApp directo (sin pasar por formulario web)
- Mónica recolectó nombre + intención mínima

## Notas
- Pasar el `conversation_id` actual para evitar doble-trigger del trigger DB
