# WhatsApp (Zavu) — alerts, assistant & MCP

All WhatsApp messaging goes through **Zavu** (`api.zavu.dev`). The backend sends
outbound messages/PDFs and receives inbound ones via webhook; replies are written
by **Claude** over real data from the DB (it never invents figures).

Sender (bot number): `+1 555-991-9064`.

## How WhatsApp Business works (important)

WhatsApp does **not** deliver proactive (business-initiated) messages outside the
24-hour window unless you use a **Meta-approved template**. That's why there are
**two paths**, and both are implemented:

| Path | When it delivers | Endpoint |
|------|------------------|----------|
| **A — Template (proactive)** | always, without the user writing first | `POST /api/notify/forecast-ready` |
| **B — wa.me (reactive)** | user writes first → opens 24h window → bot replies free-form | `GET /api/notify/whatsapp-link` + webhook |

> While the template is `pending` Meta approval, use path B.

## Endpoints

| Method | Path | What it does |
|--------|------|--------------|
| `POST` | `/api/notify/whatsapp` | Send a raw text message (auth) |
| `POST` | `/api/notify/covenant/{scenario}` | Build the covenant alert from the DB and send it |
| `POST` | `/api/notify/ask` | Question → Claude answers (optional `to` to also reply via WhatsApp) |
| `GET`  | `/api/notify/whatsapp-link` | `wa.me` link to the bot with a prefilled text (path B) |
| `POST` | `/api/notify/forecast-ready` | Send the "forecast ready" template (path A) |
| `GET/POST` | `/api/notify/automations` | Cron catalogue + per-user toggle |
| `POST` | `/api/notify/whatsapp/webhook` | **Zavu webhook** (inbound messages) |
| `GET`  | `/api/reports/pdf/{token}` | Serves the generated PDF (Zavu downloads it) |

## Inbound webhook

Register it in Zavu (already set on the sender):

```
https://<backend>/api/notify/whatsapp/webhook
```

Flow: Zavu posts `message.inbound` → the `x-zavu-signature` is **verified**
(`ZAVU_WEBHOOK_SECRET`, HMAC-SHA256, robust to plain and Svix schemes) → it
returns `200` immediately and processes in the **background** (even if slow):
Claude writes the analysis and **text + the report PDF** are sent over WhatsApp.

Payload: `{ type:"message.inbound", senderId, data:{ from, text, channel, messageId } }`.

## PDF generation (server-side)

`models/pdf_report.py` builds the report with **fpdf2** (pure Python) from the DB
+ Claude narrative. It's published to an ephemeral store and served at
`/api/reports/pdf/{token}` so Zavu can fetch it and deliver it as a document.

## Crons (APScheduler)

Start when `ENABLE_SCHEDULER=1` (in the API lifespan). They send to
`ZAVU_RECIPIENTS`:

| Cron | Cadence |
|------|---------|
| `weekly_digest` | Mondays 08:00 |
| `covenant_watch` | hourly → alerts when a scenario flips to WATCH/BREACH |
| `monthly_report` | 1st of month, 08:00 (PDF if `PUBLIC_REPORT_URL` is set) |

## MCP server

`python mcp_server.py` (stdio) exposes the forecast + Zavu as tools for Claude
(Claude Desktop or the API's `mcp_servers`): `get_covenant`, `get_weekly_digest`,
`ask_forecast`, `send_whatsapp`, `send_covenant_alert`. Same DB, same integration.

```json
{ "mcpServers": { "altis": { "command": "python", "args": ["mcp_server.py"] } } }
```

## Environment variables

| Var | Purpose |
|-----|---------|
| `ZAVU_API_KEY` | Zavu API key (without it → dry-run, never breaks) |
| `ZAVU_SENDER` | Sender ID of the profile (`Zavu-Sender` header) |
| `ZAVU_RECIPIENTS` | cron recipients (E.164, comma-separated) |
| `ZAVU_WEBHOOK_SECRET` | `whsec_…` secret to validate the webhook signature |
| `ZAVU_TEMPLATE_ID` | approved template for proactive sends (path A) |
| `ZAVU_WHATSAPP_NUMBER` | bot number for the wa.me link (path B) |
| `PUBLIC_BASE_URL` / `RAILWAY_PUBLIC_DOMAIN` | public base for the PDF URL |
