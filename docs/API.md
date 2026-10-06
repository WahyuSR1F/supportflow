# SupportFlow API

Base URL: the same origin as the SupportFlow web app. All JSON endpoints return `application/json; charset=utf-8` and use `Cache-Control: no-store` unless noted otherwise.

## Authentication

SupportFlow uses Manus OAuth. The browser starts login at `GET /api/auth/start?redirectUri=<absolute-callback-url>`. The server binds a short-lived nonce to `supportflow_oauth_nonce`, validates the OAuth `state`, exchanges the code server-side, and creates the application session cookie `webdev_app_session`.

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /api/auth/start?redirectUri=...` | Redirect to Manus OAuth | Public |
| `GET /manus-oauth/callback` | Exchange code and create session | OAuth callback |
| `GET /api/auth/session` | Return current user or `401` | Cookie |
| `GET /manus-oauth/logout` | Clear session and redirect to `/` | Cookie optional |

The production callback must be the public URL ending in `/manus-oauth/callback`. Do not accept arbitrary post-login redirect destinations.

## Health

`GET /api/health`

Example response:

```json
{
  "ok": true,
  "service": "supportflow-web",
  "status": "operational",
  "llm": true,
  "auth": true,
  "database": true,
  "whatsapp": false
}
```

`whatsapp: true` means the required WhatsApp environment values are present; it does not prove that Meta has accepted a message or that a webhook is subscribed.

## Web Chat and Turso history

### `POST /api/chat/public`

Send the latest widget conversation context to the managed LLM and persist the latest user/assistant turn in Turso.

Request:

```json
{
  "conversationId": "northstar-widget-demo",
  "messages": [
    { "role": "user", "content": "Can I change my delivery address?" }
  ]
}
```

Response includes `status`, `confidence`, `citations`, `conversationId`, `persistence` (`turso` or `unavailable`), and `message`.

### `GET /api/chat/public/history?conversationId=<id>`

Returns up to 80 messages ordered by creation time. The endpoint is public for the embedded web widget; do not use it for private customer records without adding tenant/session authorization.

## WhatsApp Cloud API

SupportFlow provides a Meta-compatible webhook and an authenticated outbound endpoint. WhatsApp officially delivers webhook JSON for incoming messages and message status updates; the integration currently normalizes incoming text messages and persists them to Turso.

### Webhook verification: `GET /api/webhooks/whatsapp`

Configure this URL in Meta App Dashboard → WhatsApp → Configuration. Meta sends:

```text
?hub.mode=subscribe&hub.verify_token=<configured-token>&hub.challenge=<challenge>
```

SupportFlow returns the challenge only when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`. `/api/webhooks/meta` is retained as a compatible alias.

### Incoming events: `POST /api/webhooks/whatsapp`

The handler accepts Meta’s WhatsApp Business Account event envelope, validates `x-hub-signature-256` when `META_APP_SECRET` is present, extracts text messages, and writes them to conversation IDs such as `whatsapp:<wa_id>`.

Set `WHATSAPP_AUTO_REPLY=true` only after testing. When enabled, SupportFlow loads the conversation context, asks the managed LLM for a reply, sends it through the WhatsApp Messages API, and persists the assistant message.

### Outbound text: `POST /api/channels/whatsapp/send`

Requires a valid `webdev_app_session` cookie.

```json
{
  "to": "16505551234",
  "text": "Your order is ready for pickup."
}
```

The endpoint calls `POST https://graph.facebook.com/<version>/<phone-number-id>/messages` with a text payload. WhatsApp service messages are subject to the 24-hour customer-service window; outside that window, use an approved template and respect opt-in and policy requirements.

## Meta webhook test payload

Use a redacted test payload in a non-production environment:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "business-account-id",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "contacts": [{ "profile": { "name": "Customer" }, "wa_id": "16505551234" }],
        "messages": [{
          "from": "16505551234",
          "id": "wamid.example",
          "timestamp": "1749416383",
          "type": "text",
          "text": { "body": "Where is my order?" }
        }]
      }
    }]
  }]
}
```

## Webhook behavior and retries

Return `2xx` after the event is accepted. Meta retries failed deliveries, so production code should use the WhatsApp message ID as an idempotency key before expanding the handler to non-text events. The current schema stores generated message IDs and is ready for a future provider-message-id column.

## Error conventions

- `400`: invalid request body or webhook payload
- `401`: missing/invalid app session or Meta signature
- `403`: failed webhook verification
- `502`: upstream LLM/WhatsApp provider failure
- `503`: integration is not configured

## Official references

- [Meta WhatsApp webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
- [Meta WhatsApp send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
