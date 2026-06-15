---
tool_name: capture_lead_from_chat
edge_function: capture-lead-from-chat
mcp_exposed: true
description: Registra un lead a partir de una conversación entrante. Multicanal (WhatsApp, Instagram, Messenger).
input_schema:
  type: object
  required: [nombre, conversation_id]
  properties:
    nombre: { type: string }
    channel: { type: string, enum: [whatsapp, instagram, messenger], default: whatsapp, description: "Canal de origen de la conversación. Default whatsapp." }
    whatsapp: { type: string, description: "Número de teléfono (solo dígitos, 10-15 caracteres). Opcional cuando channel=instagram/messenger." }
    external_id: { type: string, description: "Identificador scoped del canal: IGSID (Instagram) o PSID (Messenger). Para whatsapp usar el campo whatsapp." }
    conversation_id: { type: string, format: uuid }
    motivo: { type: string, description: "Opcional" }
    payload: { type: object, description: "Opcional, jsonb arbitrario" }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    lead_id: { type: string, format: uuid }
side_effects:
  - "INSERT leads (source_page y source_form se derivan del canal: '{channel}_inbound' / '{channel}_organic', conversation_id linked)"
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
- Usuario contactó por cualquier canal directo (WhatsApp, Instagram, Messenger) sin pasar por formulario web
- Mónica recolectó nombre + intención mínima

## Notas
- Pasar el `conversation_id` actual para evitar doble-trigger del trigger DB
- Para WhatsApp: pasar `whatsapp` (o `external_id`) con el número de teléfono
- Para Instagram/Messenger: pasar `channel` y `external_id` (IGSID/PSID); no se exige teléfono
