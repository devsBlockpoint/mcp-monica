---
tool_name: search_patient
edge_function: search-patient
mcp_exposed: true
description: Busca pacientes por número de WhatsApp, external_id de canal o nombre parcial. Pasá al menos UNO.
input_schema:
  type: object
  description: "Al menos UNO de whatsapp, external_id o nombre debe estar presente."
  properties:
    channel: { type: string, enum: [whatsapp, instagram, messenger], description: "Canal de origen. Si se pasa, la búsqueda se hace por identidad de canal (channel + external_id). Default whatsapp." }
    whatsapp: { type: string, description: "Solo dígitos, búsqueda exacta. Opcional si pasás external_id o nombre." }
    external_id: { type: string, description: "Identificador scoped del canal: IGSID (Instagram) o PSID (Messenger). Para whatsapp usar el campo whatsapp." }
    nombre: { type: string, description: "Substring case-insensitive. Opcional si pasás whatsapp o external_id." }
output_schema:
  type: object
  properties:
    pacientes:
      type: array
      description: "Hasta 10 resultados"
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          nombre_completo: { type: string }
          whatsapp: { type: string }
          telefono: { type: string }
          email: { type: ["string", "null"] }
          fecha_nacimiento: { type: ["string", "null"], format: date }
          notas: { type: ["string", "null"] }
side_effects: []
auth: service_role
implementation_status: implemented
related_db_tables: [pacientes, channel_identities]
---

# search_patient

Mónica usa esto cuando el usuario menciona ser un paciente existente y necesita referenciar historial.

## Cuándo invocar
- Usuario dice "soy Carla, ya tuve consulta"
- Usuario pregunta por su última cita y no se conoce su contexto

## Notas
- Si el WhatsApp del usuario coincide con un paciente, usar ese match — no preguntar nombre
- Para canales no-WhatsApp (Instagram/Messenger): pasar `channel` + `external_id`; la búsqueda se hace por identidad de canal, NUNCA por colisión de dígitos (evita fuga de PII cruzada)
