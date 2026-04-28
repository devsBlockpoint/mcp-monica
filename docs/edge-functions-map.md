# Edge Functions Map

Mapeo entre tools del MCP, edge functions de Supabase y tablas afectadas. **Source of truth: cada `mcp/tools/<nombre>.md`** (campo `related_db_tables` y `side_effects`). Este doc es resumen humano.

## Tools `implemented` (expuestas en runtime)

> Lista derivada de `mcp/manifest.json` actual. Para regenerar: `npm run mcp:build`.

| Tool (LLM) | Edge function | Tablas afectadas | Side effects |
|---|---|---|---|
| `agendar_cita` | `book-appointment` | `citas`, `pacientes`, `esteticistas` | INSERT pacientes (si nuevo), INSERT citas (Pendiente de Anticipo), auto-asigna esteticista |
| `buscar_disponibilidad` | `check-availability` | `citas`, `esteticistas` | Solo lectura |

## Tools `pending` (documentadas, no expuestas hasta migrar)

| Tool | Edge function | Estado |
|---|---|---|
| `cancel_appointment` | `cancel-appointment` | pending |
| `reschedule_appointment` | `reschedule-appointment` | pending |
| `get_appointments` | `get-appointments` | pending |
| `obtener_servicios` | `get-services` | pending |
| `get_treatment_detail` | `get-treatment-detail` | pending |
| `get_current_promotions` | `get-current-promotions` | pending |
| `search_patient` | `search-patient` | pending |
| `capture_lead_from_chat` | `capture-lead-from-chat` | pending |
| `send_payment_link` | `send-payment-link` | blocked_on_payment_gateway |
| `escalate_to_human` | `escalate-to-human` | pending |

## Cómo se llaman

mcp-monica hace siempre el mismo shape de request hacia Supabase:

```
POST ${SUPABASE_URL}/functions/v1/${edge_function}
Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json

<body = input validado por input_schema>
```

Si tu edge function usa `auth: service_role` (lo que asume mcp-monica), no necesita lógica de auth adicional — el JWT es válido y bypassa RLS.
