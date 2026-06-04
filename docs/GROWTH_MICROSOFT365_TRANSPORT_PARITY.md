# Microsoft 365 Native Transport Parity (Phase 6.35A)

Native Gmail and Microsoft 365 share one transport plane: `executeTransportSend` → provider adapters → `delivery_attempts` → attribution touch hook.

QA marker: `growth-microsoft365-transport-parity-v1`

## Capabilities

| Capability | Implementation |
|------------|----------------|
| Graph send | Draft create + `/messages/{id}/send` (returns message + conversation ids) |
| OAuth | `/api/platform/growth/provider-setup/microsoft/start` + `callback` |
| Token refresh | `refreshMicrosoftMailboxTokensLive` in transport + inbox sync + mailbox validate |
| Inbox sync | `createMicrosoftInboxSyncAdapter` (Graph inbox folder) |
| Delivery tracking | `provider_message_id`, `provider_thread_id`, `rfc_message_id` on attempts |
| Mailbox health | Same sender health pipeline (provider-family agnostic) |
| Warmup / routing / attribution | Reuse existing sender_account + delivery_attempt hooks |

## OAuth scopes

Default: `Mail.Send`, `Mail.Read`, `User.Read`, `offline_access`

**Reconnect** existing Microsoft mailboxes after deploy to grant `Mail.Read` for inbox sync.

## Env

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `MICROSOFT_TENANT_ID` (optional, default `common`)
- `INTEGRATION_OAUTH_STATE_SECRET`
- `GROWTH_PROVIDER_CREDENTIALS_PEPPER`

## Tests

`pnpm test:growth-microsoft365-transport-parity`
