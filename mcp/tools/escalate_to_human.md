---
tool_name: escalate_to_human
edge_function: escalate-to-human
mcp_exposed: true
description: Escala la conversación a un operador humano. Cambia agent_mode='human' y crea entrada en escalation_queue.
input_schema:
  type: object
  description: "Dos vías de identidad: en TEXTO se manda conversation_id; en una LLAMADA se manda canal='llamada' + external_id."
  required: [motivo]
  properties:
    conversation_id:
      type: string
      format: uuid
      description: "Solo en texto (WhatsApp/Instagram/Messenger): el id de la conversación actual."
    canal:
      type: string
      enum: [whatsapp, llamada]
      default: whatsapp
      description: "Usar 'llamada' cuando la conversación es telefónica."
    external_id:
      type: string
      description: "Solo en llamada: el identificador de la conversación de voz en curso."
    telefono:
      type: string
      description: "Solo en llamada: el número de quien llama, solo dígitos (ej. '6682680353')."
    motivo: { type: string, description: "Razón de la escalación" }
    prioridad:
      type: string
      enum: [low, medium, high, urgent]
      default: medium
output_schema:
  type: object
  properties:
    success: { type: boolean }
    escalation_id: { type: ["string", "null"], format: uuid }
    warning:
      type: string
      description: "Presente si escalation_queue insert falló pero la conversación se marcó OK"
side_effects:
  - "UPDATE whatsapp_conversations SET status='escalated', escalation_level=1, agent_mode='human'"
  - "INSERT escalation_queue (status='pending', reason=motivo, priority=prioridad)"
  - "En canal='llamada': UPSERT de la conversación por (channel,external_id) — durante la llamada todavía no existe; se crea ya marcada como escalada."
auth: service_role
errors:
  - code: conversation_not_found
    when: conversation_id no existe (HTTP 404)
  - code: validation_failed
    when: campos inválidos (HTTP 400)
implementation_status: implemented
related_db_tables: [whatsapp_conversations, escalation_queue]
---

# escalate_to_human

Wrapper sobre `conversations-control action='escalate'` documentado como tool para que el LLM lo descubra fácilmente.

## Cuándo invocar
- Caso fuera de scope (queja, tema legal, complejidad médica)
- Usuario pide expresamente hablar con humano
- Sentiment muy negativo detectado

## En una llamada de voz

Durante una llamada la conversación todavía no existe en la base (se crea al colgar),
así que la identidad va por el canal:

```
{ "canal": "llamada",
  "external_id": "<id de la conversación de voz en curso>",
  "telefono": "<número de quien llama, solo dígitos>",
  "motivo": "...", "prioridad": "high" }
```

La escalación queda registrada al instante y **sobrevive al cierre de la llamada**:
el webhook post-call respeta `status='escalated'` en vez de marcarla resuelta.
