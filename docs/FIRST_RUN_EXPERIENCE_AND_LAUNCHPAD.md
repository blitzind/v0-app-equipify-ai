# First-run experience & dashboard launchpad

This document describes the **guided first-run** surfaces: welcome modal, dashboard launchpad checklist, persistence model, and how they interact with **sample data** and **permissions**.

## Goals

- Make new workspaces feel **operational immediately** (especially when sample bundles are present).
- Keep completion **honest**: checklist items flip only when matching **real org data** exists (non-sample rows / connection status / team shape).
- Avoid **blocking** work: everything is dismissible; no forced tours.
- Stay **permission-aware**: users only see checklist rows their role can complete; “Explore” links respect capabilities.

## Routes & modules

| Piece | Location |
| --- | --- |
| First-run payload | `GET /api/organizations/[organizationId]/first-run` |
| User preference PATCH | `PATCH /api/organizations/[organizationId]/first-run` `{ "action": "…" }` |
| Industry-facing copy | `lib/onboarding-industry/*` (resolved in `GET …/first-run`; labels via `lib/first-run/launchpad-copy.ts`) |
| Step applicability rules | `lib/first-run/launchpad-eligibility.ts` |
| Auth metadata keys | `lib/first-run/user-metadata.ts` |
| Dashboard checklist | `components/first-run/dashboard-launchpad.tsx` |
| Demo walkthrough + quick actions | `components/first-run/industry-demo-starter-panel.tsx` |
| Executive stat card order | `components/dashboard/executive-stat-cards.tsx` |
| Welcome modal | `components/first-run/first-run-welcome-gate.tsx` |
| Client fetch helper | `hooks/use-first-run.ts` |

## Launchpad behavior

- Rendered on the **main dashboard** (`app/(dashboard)/page.tsx`) for non–technician-focused roles (same heuristic as the executive dashboard).
- **Hidden** when the user dismissed it for this org (`equipify_launchpad_hidden_org_ids` contains `organizationId`).
- **Restore**: subtle “Show getting started checklist” control on the dashboard, or **Settings → Sample data → Show checklist on dashboard** (owners, admins, and platform admins).
- **Progress** counts only steps with `applicable: true` for the signed-in user’s effective permissions.
- **Completion sources** (high level):
  - Non-sample customers / equipment / work orders / quotes (`is_sample = false`).
  - Non-sample invoices with `status != 'draft'` (treats “sent / operational” as progress).
  - Team: **≥ 2 active members** or **≥ 1 pending, unexpired** `organization_invites` row.
  - QuickBooks: `organization_integrations.connection_status === 'connected'` for `quickbooks_online` (subject to RLS visibility for the caller).
- **Explore** links are derived from the same permission model (sample data, workspace, portal, AI Ops, imports) — omitted when the user cannot open those areas.

## Welcome modal

- Shown when `hasSampleWorkspace` is true (`demo_seed_status === 'succeeded'` **or** at least one **sample** customer exists) **and** the org id is **not** listed in `equipify_welcome_ack_org_ids`.
- **Not** shown while **platform impersonation** is active (`useAdmin().impersonation.active`), or for **technician-focused** home layouts.
- Closing the dialog (Continue, overlay, or Escape) **acks** the welcome for that org (`action: "ack_welcome"`).
- Copy is **customer-facing** (no implementation jargon).

## Onboarding tracking behavior

- **Not** stored on `organizations` rows for this phase.
- **Per user, per org** lists in Supabase Auth **`user_metadata`**:
  - `equipify_welcome_ack_org_ids: string[]`
  - `equipify_launchpad_hidden_org_ids: string[]`
- **PATCH** uses the **service role** to merge metadata for the **authenticated user only** (after `requireOrgMemberSession`).
- Switching organizations updates the UI from a fresh GET; lists are keyed by org UUID.

## Sample data UX (Settings)

- Explains **modules** included in a full import, **reset** scope (sample-marked rows only), and **idempotent** re-import after reset.
- **Owners / admins / platform admins** can surface the dashboard checklist again without touching org data.

## Industry-specific onboarding

Central config lives in **`lib/onboarding-industry/`**:

- **`operational-hints.ts`** — one-line `operationalHint` for every `WorkspaceIndustryKey` (launchpad intro).
- **`industry-overrides.ts`** — optional deltas per industry (welcome copy, checklist label/description overrides, demo hints, quick actions, stat-card priority, empty-state copy, signup bullets, AIden framing).
- **`resolve-onboarding-industry-bundle.ts`** — merges defaults + overrides; used by `GET …/first-run` and (server-side) AIden operational recommendations.

`GET /first-run` returns, among other fields: `industry`, `industryLabel`, `industryHint`, `welcomeCopy`, `launchpadSecondaryNote`, `exampleWorkflows`, `launchpad` step rows with **industry-specific labels/descriptions** where configured, `demoWalkthroughHints`, `quickActions`, `statCardPriority`, `aidenSectorFraming`, `terminology`, `dashboardEmptyCopy`, `signupExampleWorkflows`. Step **IDs**, **hrefs**, **done** rules, and **applicable** flags are unchanged — only copy is customized.

The **main dashboard** passes a single `useFirstRun` result into the launchpad, **Industry demo starter** panel, and **Executive snapshot** stat cards so industry UX does not multiply identical GETs. **Welcome gate** still performs its own fetch (acceptable; see Risks).

**AIden operational recommendations** (`POST …/aiden/operational-recommendations`) loads `organizations.industry` and injects `aidenSectorFraming` into the prompt as **tone-only** guidance; snapshot JSON remains the source of truth for facts.

## Permission & security notes

- **GET / first-run**: `requireOrgMemberSession` — any active member may read counts (RLS still applies to underlying selects).
- **PATCH**: same membership gate; updates **only** the caller’s Auth user via admin API.
- **Sample import / reset** remain **owner/admin** (plus platform admin) per `gateDemoDataManagement` — unchanged.

## Org scope & RLS

- All head-count queries filter `organization_id`.
- No service-role reads for the GET payload beyond what the user’s JWT client already uses (QuickBooks row may be invisible to some roles).

## Migrations

- **None** for this phase (preferences live in Auth metadata).

## Manual QA checklist

1. New workspace **with** sample seed: sign in → welcome modal → Continue → modal does not return on refresh.
2. Dashboard **Getting started** shows applicable steps; completing a real non-sample customer marks the first row (after reload or navigation).
3. **Hide** (X) removes the card; **Show** link restores it; Settings → Sample data **Show checklist** also restores.
4. **Technician-focused** user: no launchpad, no welcome (unless sample + welcome — technicians might still get welcome if they have sample and not ack — they use TechnicianHome - welcome gate enabled = !technicianFocused - good).
5. **Manager** with sample: welcome if not ack; launchpad if applicable steps > 0.
6. **PATCH** as non-member: 403 from `requireOrgMemberSession`.

## Risks / follow-ups

- **QuickBooks “done”** may read empty under strict RLS for some roles — step may stay incomplete even if connected; revisit with a narrow RPC if product needs uniform detection.
- **Dual fetch**: welcome gate performs its own GET; executive dashboard shares one `useFirstRun` across launchpad + industry demo panel + stat order. A shared provider could dedupe further if needed.
