# Communications Center — Phase 3

Phase 3 connects the Phase 2 draft compose flow to the existing
live send routes and improves delivery lifecycle visibility, without
replacing any existing email, workflow, portal, or automation
infrastructure.

## What shipped

### 1. Draft Send Hand-Off

- New endpoint:
  `POST /api/organizations/{orgId}/communications/{id}/send`
- Input: a Phase 2 draft row in `communication_events`
  (`event_type='communication_draft'` or `metadata.is_draft=true`).
- Behaviour:
  1. Permission gate (`canManageCommunications`).
  2. Rejects rows that aren't drafts, or drafts already in flight.
  3. Resolves the live send route via
     [`lib/communications/draft-handoff.ts`](../lib/communications/draft-handoff.ts):
     - `invoice` → `/api/email/invoice`
     - `quote` → `/api/email/quote`
     - `work_order` → `/api/email/work-order-summary`
     - `prospect` → `/api/organizations/{orgId}/prospects/{id}/follow-up`
  4. Marks the draft row `delivery_status='queued'` with a
     `metadata.handoff_*` payload (route, started_at, dispatched_by).
  5. Forwards the call **server-to-server** to the live route with
     the caller's session cookie. Live routes still enforce their
     own permission gates (`canEditInvoices`, `canEditQuotes`,
     `canEditWorkOrders`, `canManageProspects`) — this preserves
     billing-tier and feature gates exactly as today.
  6. Settles the draft row to `sent` (with `sent_at`) on success or
     `failed` (with `failed_at` + `error_message`) on failure.
- The live route also writes its own `communication_events` row with
  the provider message ID. The feed now shows both: the draft
  (lifecycle history) and the live send (the canonical record).
  Drafts carry `metadata.handoff_route_label` so the UI can label
  them "Sent via invoice email" etc.

> Sending logic is **never duplicated**. The hand-off endpoint only
> orchestrates — provider behaviour, audit logging, and templates
> live in the existing routes.

### 2. Lifecycle visibility

- New helper: [`lib/communications/lifecycle.ts`](../lib/communications/lifecycle.ts)
  produces an ordered list of lifecycle steps from a single event row
  (Created → Drafted → Hand-off → Queued → Sent → Delivered, with
  branches for Failed / Bounced / Simulated / Skipped).
- New component: `components/communications/lifecycle-timeline.tsx`
  renders the steps as a vertical timeline inside the detail drawer.
- The drawer now surfaces `delivered_at` / `failed_at` / hand-off
  metadata wherever the underlying row has it. No new columns were
  added — Phase 3 reads what `communication_events` already carries.

### 3. Retry / recovery improvements

`POST /api/organizations/{orgId}/communications/{id}/retry`:

- Refuses retries while the row is still `queued` or `pending`
  (HTTP 409 `already_queued`).
- 30 s cooldown between retry attempts (HTTP 429 `retry_cooldown`
  with `cooldownSecondsRemaining`).
- Tracks `metadata.retry_count` so future provider sync work has a
  basis for backoff or exhaustion logic.
- Drawer UI now shows a friendlier failure block with a one-line
  hint via `explainFailure()` for common failure shapes (invalid
  recipient, rate limit, permission denied, archived record).

### 4. Detail drawer polish

- Lifecycle timeline section.
- "Draft hand-off" section that explains what will happen on send
  and surfaces blockers (missing recipient / unsupported entity).
- "Send draft now" button (manager-only) replaces the previous
  read-only Phase 2 footer for drafts. Honours blockers and
  disables itself once the draft has been dispatched.
- Failure block uses red-tinted card with manager-friendly hints.
- Roadmap section now reflects Phase 3 → Phase 4 (provider sync,
  threaded conversations, SMS).

### 5. Embedded continuity

`RecentCommunicationsCard` is now embedded on:

- Equipment detail (Service tab) — scoped by `entity_type=equipment`
  + `customerId` so service confirmations and certificate releases
  surface against the asset.
- Maintenance plan drawer — scoped by `entity_type=maintenance_plan`
  + `customerId` so reminder runs and plan-driven WO summaries are
  visible inline.

Both cards reuse the same lightweight `/communications/feed` query
introduced in Phase 1 and respect `canViewCommunications`.

### 6. Provider synchronization foundation (docs only)

Phase 3 does **not** ship a webhook ingestion system. It documents
the shape so a future phase can land minimally and safely:

- **Resend webhook sync** — accept the `email.delivered`,
  `email.bounced`, `email.opened`, `email.complained` events and
  upsert against `communication_events` rows by
  `provider_message_id`. Update `delivered_at`, `failed_at`,
  `error_message`, `metadata.bounce_reason`. The retry endpoint
  already keys off `delivery_status='bounced'`.
- **Twilio sync** — same pattern for SMS (`MessageStatus`
  callbacks). Map `delivered`, `failed`, `undelivered` into the
  same `communication_events` columns. Provider message ID is
  Twilio's `MessageSid`.
- **Inbound replies** — store as `direction='inbound'` rows with
  `recipient_kind='user'` (org receives) and a foreign key into
  the originating event via
  `metadata.in_reply_to_event_id`. The detail drawer is already
  set up to render inbound bodies — only the ingestion plumbing
  is missing.
- **Threaded conversations** — derive a `thread_id` server-side
  from the originating outbound event. No schema change needed:
  `metadata.thread_id` (UUID) on the first outbound, copied to
  every reply. The feed can group by `metadata.thread_id` later.
- **Webhook security** — Resend signs payloads with `Svix`;
  Twilio uses `X-Twilio-Signature`. New routes must verify
  signatures before touching the DB.
- **Idempotency** — both providers can replay; treat
  `provider_message_id + status` as the dedupe key.

### 7. Safety

- All send / retry endpoints require `canManageCommunications`.
- Drafts never auto-send — sending requires an explicit click on
  "Send draft now".
- The hand-off endpoint forwards the user's session cookie so the
  live route's existing permission and billing gates still fire.
- Provider payloads / signed URLs / secrets are never exposed in
  the drawer. Raw metadata view continues to be admin-only and
  is collapsed by default.
- Existing email audit behaviour is untouched (live routes write
  their own `communication_events` rows exactly as before).

## Files changed

```
app/api/organizations/[organizationId]/communications/[communicationId]/send/route.ts   (new)
app/api/organizations/[organizationId]/communications/[eventId]/retry/route.ts          (cooldown + queued guard)
lib/communications/draft-handoff.ts                                                    (new)
lib/communications/lifecycle.ts                                                        (new)
components/communications/lifecycle-timeline.tsx                                       (new)
components/communications/feed-detail-drawer.tsx                                       (lifecycle + send + failure UX)
components/drawers/maintenance-plan-drawer.tsx                                         (RecentCommunicationsCard)
app/(dashboard)/equipment/[id]/page.tsx                                                (RecentCommunicationsCard)
docs/COMMUNICATIONS_PHASE3.md                                                          (new — this file)
```

## Migrations

None. Phase 3 reads existing columns and `metadata` only.

## TODO roadmap

- [ ] Resend webhook ingestion route + signature verification.
- [ ] Twilio status-callback ingestion + signature verification.
- [ ] Inbound reply storage + drawer rendering.
- [ ] `metadata.thread_id` derivation on outbound writes + feed
      grouping toggle.
- [ ] Surface `metadata.handoff_route_label` in `RecentCommunicationsCard`
      so embedded panels show the live send route inline.
- [ ] Promote drafts → live event linkage so the feed can collapse
      a draft's lifecycle row into the canonical send row when both
      are present.
- [ ] Backoff schedule + retry exhaustion (`metadata.retry_count`).
- [ ] AI summary of failure clusters in the KPI strip.
