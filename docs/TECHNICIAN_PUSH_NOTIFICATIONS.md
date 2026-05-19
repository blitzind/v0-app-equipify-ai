# Technician mobile push notifications

Production push for the Equipify technician iOS app: device registry, Expo delivery, and `communication_events` audit.

## Schema

### `public.user_push_devices`

| Column | Description |
|--------|-------------|
| `user_id` | `auth.users` — must match `auth.uid()` for client writes |
| `organization_id` | Active workspace |
| `expo_push_token` | Expo push token (`ExponentPushToken[…]`) |
| `platform` | `ios` \| `android` \| `unknown` |
| `last_seen` | Updated on each registration |

Unique: `(user_id, organization_id, expo_push_token)`.

**RLS:** Users may select/insert/update/delete only their own rows in orgs where `is_org_member(organization_id)`.

### `communication_events` (existing)

Push delivery is audited with:

- `channel = 'push'`
- `provider = 'expo'`
- `event_type` = alert type (`work_assigned`, `schedule_changed`, …)
- `recipient_kind = 'user'`, `recipient_user_id` = technician
- `scheduled_reminder_key` = idempotency key (`tech_push:…`)

## Alert types

| `event_type` | Use |
|--------------|-----|
| `work_assigned` | New assignment |
| `schedule_changed` | `scheduled_on` / time change |
| `urgent_callback` | Priority callback |
| `notes_added` | Note on assigned WO |
| `signature_needed` | `completed_pending_signature` |

## API (Next.js)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/organizations/{organizationId}/mobile/push-devices` | Register token |
| `DELETE` | `/api/organizations/{organizationId}/mobile/push-devices` | Remove token (`all: true` on sign-out) |
| `POST` | `/api/organizations/{organizationId}/mobile/push-devices/test` | QA test to self |

Mobile app uses **Supabase RLS upsert** on `user_push_devices` (same contract as POST).

## Worker

- **Inline:** `sendTechnicianPushNotification()` (service role) — audit insert + Expo send + status update.
- **Cron:** `GET/POST /api/cron/process-technician-push-queue` every 5 minutes (retries `delivery_status = queued`).

## Server environment (never in mobile)

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_ACCESS_TOKEN` | For live send | Expo push API auth |
| `EQUIPIFY_PUSH_LIVE_SEND` | Optional | Set `0` to force audit-only / noop |
| `CRON_SECRET` | Cron | Protects queue processor |
| `SUPABASE_SERVICE_ROLE_KEY` | Delivery | Service role client |

## Emitting from product code

```ts
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { emitWorkOrderTechnicianPush } from "@/lib/push/emit-work-order-technician-push.server"

const admin = createServiceRoleClient()
await emitWorkOrderTechnicianPush(admin!, {
  organizationId,
  recipientUserId: assignedUserId,
  workOrderId,
  alertType: "work_assigned",
  workOrderTitle,
  customerName,
})
```

Wire this from trusted server paths when assignments or schedules change (web drawer save, automation, etc.).

## Tests

```bash
pnpm test:technician-push
```

## Manual QA

1. Apply migration `20261220120000_user_push_devices_technician_push.sql`.
2. Set `EXPO_ACCESS_TOKEN` on Vercel; deploy equipify-app.
3. On device: sign in → More → Alerts → Enable notifications → **Registered**.
4. `POST …/mobile/push-devices/test` (session cookie or mobile after register) → notification arrives.
5. Sign out → row removed from `user_push_devices`.
6. Confirm `communication_events` row: `channel=push`, `provider=expo`, no token in `body`/`metadata`.
