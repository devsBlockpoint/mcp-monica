---
tool_name: escalate_to_human
edge_function: escalate-to-human
mcp_exposed: true
description: Escala la conversación a un operador humano. Cambia agent_mode='human' y crea entrada en escalation_queue.
input_schema:
  type: object
  required: [conversation_id, motivo]
  properties:
    conversation_id: { type: string, format: uuid }
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
