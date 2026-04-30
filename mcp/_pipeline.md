# Plumbing — Non-tool components

These endpoints exist but are **not** exposed to the AI agent. They are framework or admin-only.

## Response delivery

| Component | Folder | Used by | Notes |
|---|---|---|---|
| `chat-assistant` | `supabase/functions/chat-assistant/` | webchat, whatsapp-webhook auto-mode | Mónica core. Consumes `manifest.json`. |
| `n8n-whatsapp-agent-response` | `supabase/functions/n8n-whatsapp-agent-response/` | n8n / NanoClaw / `lead-pickup` | AI-side outbound; tags `sender_type='agent'`, respects `agent_mode`, supports `action: escalate|transfer|close|schedule_followup`. |
| `whatsapp-send` | `supabase/functions/whatsapp-send/` | `WhatsAppCRM.tsx` (after F4 cleanup) | Human CRM bypass; minimal logic. |

## Inbound

| Component | Folder | Source |
|---|---|---|
| `whatsapp-webhook` | `supabase/functions/whatsapp-webhook/` | Meta WhatsApp Cloud API |
| `n8n-whatsapp-incoming` | `supabase/functions/n8n-whatsapp-incoming/` | n8n |
| `webchat-message` | `supabase/functions/webchat-message/` | Public landing chat widget |

## System / cron

| Component | Folder | Schedule |
|---|---|---|
| `auto-return-to-bot` | `supabase/functions/auto-return-to-bot/` | `pg_cron` every 5 min |
| `send-reminders` | `supabase/functions/send-reminders/` | scheduled |

## Bridges

| Component | Folder | Direction |
|---|---|---|
| `n8n-calendar-availability` | `supabase/functions/n8n-calendar-availability/` | n8n → app |
| `n8n-calendar-sync` | `supabase/functions/n8n-calendar-sync/` | n8n → app |
| `n8n-calendar-webhook` | `supabase/functions/n8n-calendar-webhook/` | app → n8n (best-effort, fire-and-forget) |

## Admin-only

| Component | Folder | Purpose |
|---|---|---|
| `generate-clinic-images` | `supabase/functions/generate-clinic-images/` | Admin tool — image generation |
| `upload-clinic-image` | `supabase/functions/upload-clinic-image/` | Admin tool — upload to Storage |
| `use-invitation` | `supabase/functions/use-invitation/` | Auth — claim invitation token |

## Removed

`n8n-whatsapp-outgoing` — deleted in F4. Was misused by `WhatsAppCRM.tsx`; superseded by `whatsapp-send` for human path and `n8n-whatsapp-agent-response` for AI path.
