# Communications Center — Phase 2

Phase 2 deepens visibility and adds safe operational recovery actions
without turning the Communications Center into a full inbox or
messaging platform. It builds on Phase 1 and keeps every existing
subsystem (email, workflow, portal, prospect, invoice, quote,
work-order, certificate) intact.

## What changed

### Entity continuity (embedded panels)
`RecentCommunicationsCard` is now embedded into:

| Surface | File | Notes |
| --- | --- | --- |
| Work-order drawer | `components/drawers/work-order-drawer.tsx` | Below the scheduling-events card. |
| Quote drawer | `components/drawers/quote-drawer.tsx` | Below the timeline section. |
| Invoice detail view | `components/drawers/invoice-detail-view.tsx` | Below the service lifecycle on the Info tab. |
| Prospect drawer | `components/prospects/prospect-drawer.tsx` | Renders alongside the existing Follow-up timeline. |
| Customer detail page | `app/(dashboard)/customers/[id]/page.tsx` | New panel above the legacy notification timeline; both kept for continuity. |

Each card opens the same Phase 1 detail drawer (no duplicated UI) and
exposes a "View all" deep link into `/communications` with the
entity / customer filters preserved.

### Operational recovery
- `POST /api/.../communications/[eventId]/retry` now requires
  **`canManageCommunications`** (owner / admin / manager) — viewers
  and techs see the read-only feed but can't requeue customer-facing
  sends. Retries also reject any non-`failed`/`bounced` row up front
  with a `409`.
- The Phase 1 detail drawer surfaces a **Retry / resend** button when
  the row is retriable and the caller has the capability. Successful
  retries flip the local pill to `queued` without a refetch and toast
  the manager. The button degrades to a "restricted to managers"
  hint for users who can see the drawer but not act.

### Compose-draft foundation
- New endpoint `POST /api/.../communications/drafts` writes a
  `communication_events` row with `delivery_status='pending'` and
  `metadata.is_draft=true`. **No provider send happens.** Drafts
  appear in the feed with the violet/gray "Draft" pill.
- New `<ComposeDraftDialog>` exposed from the Communications Center
  toolbar (manager-only). The dialog supports channel, subject,
  one-line summary, body, recipient address, and an optional
  `relatedEntityType + id` link. Drafts are intentionally inert until
  a future phase wires them into the live send routes (invoice email,
  quote email, work-order summary, prospect follow-up).
- Existing live send routes are untouched. Compose never duplicates
  sending logic — it only persists intent.

### Detail-drawer polish
- Related-entity, automation-source, and AI-assistant sections each
  render in their own coloured callout for at-a-glance scanning.
- Raw metadata is now collapsed behind a `<details>` toggle and shows
  a redaction notice clarifying that provider IDs / signed URLs are
  intentionally not exposed.
- The "Coming in Phase 2" placeholder remains as a hint for future
  threading / SMS / voicemail surfaces.

### Permissions
- `canManageCommunications` (Phase 1) gates retry + compose-draft.
- `canViewCommunications` (Phase 1) still gates feed + embedded cards.
- No new roles or RLS policies. RLS continues to be authoritative.

## Files changed
```
app/(dashboard)/customers/[id]/page.tsx
app/api/organizations/[organizationId]/communications/[eventId]/retry/route.ts
app/api/organizations/[organizationId]/communications/drafts/route.ts                (new)
components/communications/communications-feed-page.tsx
components/communications/compose-draft-dialog.tsx                                   (new)
components/communications/feed-detail-drawer.tsx
components/drawers/invoice-detail-view.tsx
components/drawers/quote-drawer.tsx
components/drawers/work-order-drawer.tsx
components/prospects/prospect-drawer.tsx
docs/COMMUNICATIONS_PHASE2.md                                                        (new)
lib/admin/master-context.generated.ts                                                (regenerated)
```

## Architectural decisions
1. **No new tables.** Drafts piggy-back on `communication_events`
   using the existing `delivery_status='pending'` + `metadata.is_draft`
   pattern. Phase 1's synthetic-status detector already labels them
   correctly in the feed.
2. **Retry stays "queue only".** The route flips the row to `queued`
   and timestamps the request; provider resend hooks (Resend / Twilio)
   ship later as a webhook ingestion service. This keeps Phase 2 from
   reproducing send logic that already lives in domain routes.
3. **Permissions over routes.** Access gates moved into the routes
   themselves rather than spawning a parallel "manage" surface. A
   single `canManageCommunications` boolean covers both retry and
   compose; the UI hides controls and the server enforces the same
   invariant.
4. **Embedded cards reuse the Phase 1 endpoint.** `RecentCommunicationsCard`
   calls `/communications/feed?entityType=…&entityId=…` so we never
   duplicate entity-resolution or stat aggregation logic.
5. **Drafts never auto-send.** The compose dialog's saved row is
   inert until a future phase explicitly hands it to the existing
   email / SMS send routes. Phase 2 stays additive on the wire.

## Migration notes
None. No DDL changes; everything builds on existing tables and
columns.

## TODO roadmap (future phases)

### Provider delivery sync
- Resend webhook → flip `pending → sent`, `sent → delivered`,
  capture bounces.
- Twilio webhook → SMS delivery + reply ingestion.
- Map provider IDs into `provider_message_id` (already on the row).
- Backoff + retry policy stored on the workspace.

### Threaded conversations
- Add `parent_communication_id uuid references communication_events(id)`
  (additive, nullable, idempotent) for reply chains.
- Group by `parent_communication_id` in the feed when present.
- Drawer renders a thread tree instead of single-row metadata.

### SMS / voicemail / call logs
- `channel='sms'` already in the enum. Add `voicemail` and `call`
  via additive constraint update when the provider lands.
- Recipient resolution: extend `recipient_kind` for `phone_number`
  (additive) and capture inbound transcripts in `body`.

### Inbox / omnichannel
- Group by customer or thread, with read/unread state per user
  (already supported via `communication_event_reads`).
- Promote the central feed to a left-pane / right-pane view when
  inbound replies start landing.

### Customer-reply handling + AI
- Inbound parse → `direction='inbound'` row + thread link.
- AI summary on long threads → `metadata.ai_summary` and the drawer
  surfaces it under "AI assistant".
- AI sentiment → `metadata.ai_sentiment` (positive / neutral /
  negative / urgent) with a tinted badge.

### Campaigns / reviews / referrals
- `event_type='campaign_send'` plus `metadata.campaign_id` so the
  feed groups by campaign and shows fan-out counts.
- Review / referral sequences re-use the workflow engine — Phase 1's
  automation badge already surfaces the run.

### Embedded compose handoff
- Phase 3: "Send draft now" wires the saved draft to the appropriate
  domain send route (invoice / quote / WO summary / prospect
  follow-up) based on `relatedEntityType`. Draft → live event in the
  same row, just flipping `is_draft=false` + `delivery_status='sent'`.

## Verification
- `pnpm exec tsc --noEmit` clean across the changed files.
- `pnpm build` passes; new `/communications/drafts` route is
  dynamic (`ƒ`), retry stays dynamic (`ƒ`).
- `pnpm update:master-context` refreshed.
- Manual: managers see the Compose draft + Retry buttons; viewers
  and techs see the panels but no controls.

## Deploy notes
None beyond a Next.js redeploy. No env changes, no Supabase
migrations, no provider configuration required.
