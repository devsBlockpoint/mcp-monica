---
tool_name: search_patient
edge_function: search-patient
mcp_exposed: true
description: Busca pacientes por número de WhatsApp o nombre parcial. Pasá al menos UNO de los dos.
input_schema:
  type: object
  description: "Al menos UNO de whatsapp o nombre debe estar presente."
  properties:
    whatsapp: { type: string, description: "Solo dígitos, búsqueda exacta. Opcional si pasás nombre." }
    nombre: { type: string, description: "Substring case-insensitive. Opcional si pasás whatsapp." }
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
related_db_tables: [pacientes]
---

# search_patient

Mónica usa esto cuando el usuario menciona ser un paciente existente y necesita referenciar historial.

## Cuándo invocar
- Usuario dice "soy Carla, ya tuve consulta"
- Usuario pregunta por su última cita y no se conoce su contexto

## Notas
- Si el WhatsApp del usuario coincide con un paciente, usar ese match — no preguntar nombre
