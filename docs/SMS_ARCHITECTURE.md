# SMS architecture (Equipify)

This document describes the **foundation** for workspace-scoped transactional SMS: data model, API surfaces, provider abstraction, compliance gates, and what must be completed before **live** US SMS in production.

## Product scope (this phase)

- **Transactional / service** notifications only (e.g. work order lifecycle, schedule changes). **No marketing SMS** from this pipeline.
- **No live carrier send** until workspace policy, consent, and provider wiring are satisfied. The default outbound adapter is a **noop**; Twilio/Telnyx adapters are **placeholders** until implemented with secrets in server env only.
- **Per-alert SMS** toggles live in `organization_notification_preferences.sms_enabled` and are editable in the UI only when `smsWorkspace.smsChannelConfigurable` is true (see below).

## Data model (Postgres)

Migration: `supabase/migrations/20261215120000_workspace_sms_notifications_foundation.sql`

| Table | Purpose |
|-------|---------|
| `organization_sms_workspace_settings` | One row per org: master toggle, provider kind, self-attested `provider_configured`, `compliance_status`, `opt_in_required`, `transactional_only`, optional `sender_display_hint` (no secrets). |
| `organization_sms_recipient_consents` | Transactional opt-in per `organization_id` + E.164; `revoked_at` null = active. |
| `organization_sms_delivery_attempts` | Audit: `queued` / `skipped` / `failed` / `noop_simulated` / `sent`; `skip_code`; internal error text **not** exposed to clients. |
| `organization_sms_suppressions` | STOP / admin / bounce / complaint blocks per org + E.164. |

RLS: org members **SELECT**; **writes** via **service role** from trusted Route Handlers (same pattern as notification preferences).

## Workspace SMS gate (`smsChannelConfigurable`)

Computed server-side (see `workspaceSmsRowToDto`):

`sms_master_enabled && provider_configured && compliance_status === 'approved'`

- **`approved`** cannot be set via the public `PATCH /sms-workspace` API (operators/support use controlled processes or DB).
- Owners can set `compliance_status` to `pending_review` using **Submit compliance for review** on Settings → Workspace.

## Notification preferences API

`GET/PATCH /api/organizations/{organizationId}/notification-preferences`

- Response includes **`smsWorkspace`** (public DTO) and `meta.smsPersistenceReady`.
- **PATCH** rejects any `preferences[].smsEnabled: true` when `smsChannelConfigurable` is false (`error: sms_not_ready`).
- Persisted `sms_enabled` is forced **false** for alert types outside the **transactional send allowlist** (`work_order_completed`, `schedule_changes`) even if a client sends `true`.

## SMS workspace API

`GET/PATCH /api/organizations/{organizationId}/sms-workspace`

- **GET**: any org member (read status).
- **PATCH**: `canManageWorkspaceSettings` only; updates master toggle, opt-in requirement, provider kind, provider-configured acknowledgment, compliance (except `approved`).

## Send pipeline (server-only)

`lib/sms/queue-transactional-sms-notification.server.ts` — `queueTransactionalSmsNotification`

**Checks (in order):**

1. Alert type in transactional allowlist.
2. `transactional_only` flag on workspace SMS settings.
3. `smsChannelConfigurable` (workspace ready).
4. Per-alert `sms_enabled` for the event.
5. E.164 format.
6. Digest **quiet hours** (same HH:MM window as email digest settings).
7. Suppression list.
8. Opt-in row when `opt_in_required` is true.
9. `liveSendAllowed` input (caller passes `process.env.EQUIPIFY_SMS_SEND_ENABLED === 'true'` when ready).
10. Provider adapter (noop / Twilio placeholder / Telnyx placeholder).

**UI must never show** `error_message_internal`, provider IDs, or raw provider errors.

## Provider abstraction

- `lib/sms/sms-provider-types.server.ts` — `SmsOutboundProvider` interface.
- `lib/sms/sms-provider-registry.server.ts` — `noopSmsProvider`, Twilio/Telnyx placeholders, `resolveSmsOutboundProvider`.

## Before **live** production SMS (US)

Complete outside or alongside app work:

1. **Carrier account** (Twilio or Telnyx) with funded project.
2. **A2P 10DLC / toll-free verification** (US): brand, campaign, use-case documentation.
3. **Approved messaging use case** aligned with actual copy (transactional only in v1).
4. **Business profile** and support contact on file with carrier.
5. **Terms and privacy**: how numbers are collected, how opt-in is recorded, retention.
6. **Opt-in capture** UX for each recipient (stored in `organization_sms_recipient_consents`).
7. **STOP / HELP / START** handling (write to `organization_sms_suppressions`, halt sends).
8. **Templates / SHAFT** compliance review for message bodies.
9. **Rate limits and idempotency** for retries (`idempotencyKey` on send requests).
10. **Monitoring and cost caps** per workspace.

## Environment (optional)

| Variable | Purpose |
|----------|---------|
| `EQUIPIFY_SMS_SEND_ENABLED` | When exactly `true`, callers may pass `liveSendAllowed: true` into the queue function after other gates pass. Omit or `false` in most environments. |

Provider secrets (for example Twilio account SID and auth token) must be **server-only** and never referenced from client bundles.

## Related settings UI

- **Settings → Notifications** — matrix + link to workspace SMS anchor `#workspace-sms`.
- **Settings → Workspace** — `WorkspaceSmsStatusCard` (`#workspace-sms`) for policy toggles.
- **Settings → Integrations** — Twilio card links to workspace SMS section.
