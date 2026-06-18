---
tool_name: actualizar_datos_contacto
edge_function: update-contact-data
mcp_exposed: true
description: Completa o corrige los datos de identidad del contacto (nombre, teléfono, correo) de una conversación.
input_schema:
  type: object
  required: [conversation_id]
  properties:
    conversation_id: { type: string, format: uuid, description: "ID de la conversación actual." }
    nombre_completo: { type: string, description: "Nombre y apellido del cliente, concatenados." }
    telefono: { type: string, description: "Teléfono (solo dígitos). Si matchea un paciente existente, vincula la conversación a ese paciente." }
    correo: { type: string, description: "Correo electrónico." }
output_schema:
  type: object
  properties:
    success: { type: boolean }
    paciente_id: { type: string, description: "Paciente vinculado, si se resolvió." }
side_effects: ["UPDATE whatsapp_conversations", "UPDATE pacientes/leads (si vacíos)", "UPSERT channel_identities"]
auth: service_role
implementation_status: implemented
related_db_tables: [whatsapp_conversations, pacientes, leads, channel_identities]
---

# actualizar_datos_contacto

Escribe los datos del contacto donde el resto del sistema los lee (conversación, paciente, lead) para "saber con quién se habla" y mejorar la atribución.

## Cuándo invocar
- El `contact_name` viene **ilegible**: vacío, solo dígitos, igual al id del canal (PSID/IGSID), o sin letras → pedir el nombre real y llamar esta tool.
- El cliente da su teléfono o correo y aún no están registrados.

## Notas
- La conversación se **pisa** con el dato provisto (es la etiqueta del chat). Paciente y lead se **completan solo si el campo está vacío** (no se sobrescriben datos ya cargados).
- Pasar `telefono` solo dígitos. Si matchea un paciente, la conversación queda vinculada a ese paciente automáticamente.
- No crea pacientes (eso ocurre al agendar con `agendar_cita`).
