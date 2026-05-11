# Usage metering & enforcement (Phase 60.2 / 60.3)

Companion to `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` (entitlements & feature gates). This document covers **numeric usage**, **counters**, and **where limits are enforced vs displayed**.

## Seat counting policy (Phase 60.3)

| Category | Counts toward plan “reserved” seats? |
|----------|--------------------------------------|
| **`organization_members.status = 'active'`** | Yes, unless the member’s profile email is on the **platform-admin allowlist** (`EQUIPIFY_PLATFORM_ADMIN_EMAILS`). |
| **`organization_members.status = 'invited'`** (Supabase-auth / roster invite) | Yes (same billable-email rule). |
| **`organization_invites` with `status = 'pending'` and `expires_at` in the future** | Yes (token onboarding invites). |
| **`accepted` / `expired` / `revoked` invites** | No. |
| **`suspended` members** | No (not active or invited). |
| **Accepting a token invite** | Does not increase reserved total *if* the invite was already counted as pending (swap pending → active). |

**Enforcement surfaces:** `fetchOrganizationSeatMetrics` (`lib/billing/seat-counts.ts`) → `loadOrgBillingContext` / `evaluateSeatInvite`; `GET /api/organizations/[organizationId]/seat-metrics` for **billing** + **team** UI; `checkOrgInviteEligibility` on **`/api/invites/create`** and **`/api/organizations/.../invite-member`** (recheck before insert). **Platform admins** skip the numeric seat cap when inviting (`skipSeatCap` in `QuotaEvaluationOptions`) but still respect billing state.

**Invite acceptance (`/api/invites/accept`):** No extra seat check (reserved total unchanged when pending token becomes active). Documented defense-in-depth deferred if product wants DB constraints.

## Architecture summary

| Piece | Role |
|-------|------|
| `organization_subscriptions` | Plan id, trial, billing status — drives limits via `getPlanLimits` / `getEffectivePlanId`. |
| `lib/billing/usage.ts` | **Equipment** + **API** rollup; `seatsUsed` = **active members only** (legacy KPI — not the enforcement total). |
| `lib/billing/seat-counts.ts` | **Authoritative reserved seat math** for enforcement + honest UI (60.3). |
| `organization_api_usage_monthly` | DB table for monthly `api_calls` per org (`month_start` = UTC month). **Select** via RLS for members; **writes** intended for service role only. |
| `lib/billing/record-eligibility.ts` | Pure evaluation: billing state, equipment cap, seat cap, **usage count verify** (60.2). |
| `lib/billing/server-guard.ts` | `requireCanCreateRecord`, `requireWithinPlanLimit`, `loadOrgBillingContext` — wires eligibility to HTTP-oriented guards. |
| `ai_usage_logs` | Per-request AI logging; powers `evaluateAiPlanGate` MTD request/cost caps (`lib/ai/plan-gate.ts`). |
| `organizations.ai_monthly_budget_cents` | Workspace AI **budget** (warn/block) — `lib/ai/budget.ts`. |
| `follow_up_automation_usage_events` | Audit/telemetry for follow-up automation; not a hard plan cap today. |

## Enforcement matrix

Statuses: **enforced** | **partial** | **display-only** | **planned** | **needs follow-up**

| Category | Plan limit source | Storage / helper | UI display | Server enforcement | Reset window | Status |
|----------|-------------------|------------------|------------|--------------------|--------------|--------|
| **Team seats** | `PLAN_LIMITS.users` | `fetchOrganizationSeatMetrics` + `GET .../seat-metrics` | Billing + Team UI (reserved bar + breakdown) | `requireCanCreateRecord` (`team_invite`), `checkOrgInviteEligibility`, `requireWithinPlanLimit`, `/api/invites/create`, `/api/organizations/.../invite-member` | N/A (live count) | **enforced** (server); `getOrganizationUsage.seatsUsed` remains active-only for legacy/aux |
| **Equipment / assets** | `PLAN_LIMITS.equipment` | Count: `equipment` non-archived (`getOrganizationUsage`) | Billing Usage bar | `enforceCanCreateRecord` (equipment), `requireCanCreateRecord` in conversion flows | N/A | **enforced** on guarded server paths; direct Supabase inserts may bypass (RLS) |
| **Customers** | No numeric cap in `PLAN_LIMITS` | — | — | Billing state only (`evaluateStandardCreate`) | — | **n/a** |
| **Work orders / quotes / invoices / etc.** | No per-type numeric cap | — | — | Billing state only | — | **n/a** (beyond billing) |
| **Maintenance plans** | Feature + billing | — | — | `requireMaintenancePlanCreate` | — | **enforced** (feature + billing) |
| **AI requests** | Per-task caps in `AiTaskDefinition` + plan tier | `ai_usage_logs` | AI usage settings / ops | `evaluateAiPlanGate` + budget precheck | Calendar month (UTC) for MTD task aggregation | **enforced** where tasks use plan gate; not every AI touchpoint may use the same task id |
| **AI spend** | Org budget (not plan tier table) | `ai_usage_logs` + org settings | Settings → AI usage | `precheckOrganizationAiBudget` (warn/block) | Calendar month | **enforced** when configured |
| **API calls (plan allowance)** | `apiCallsMonthly` Growth/Scale | `organization_api_usage_monthly.api_calls` | Billing Usage bar | **None** — no app increment | UTC calendar month row | **display-only** — counter not incremented by app code yet |
| **Public developer API** (future) | Scale `api_access` (expected) | TBD key + request logs | Settings → API (planned) | **Planned** — must tie to reliable counters | UTC month | **planned** — see **`docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`**; distinct from dashboard Route Handlers |
| **Automations / workflow runs** | Indirect (automation feature Growth+) | Run history tables | — | Feature + billing on create + `dispatchWorkflowTriggers` skip; no per-run numeric cap | — | **partial** — see **`docs/AI_AUTOMATION_GOVERNANCE.md`** |
| **Storage / documents** | Not in `PLAN_LIMITS` | Supabase storage | — | RLS / permissions | — | **needs follow-up** / product |
| **Imports / migration** | Platform-admin gated | Platform routes | — | `isPlatformAdminEmail` + org migration helpers | — | **n/a** for tenant plan caps |
| **Portal users / links** | Not in `PLAN_LIMITS` | — | — | Permissions + RLS | — | **needs follow-up** if product adds caps |
| **AIden / usage events** | Plan matrix | `aiden_usage_events` | — | Capability helpers | — | **partial** — telemetry + policy keys |

## Phase 60.2 code changes

1. **Usage load fail-closed (member flows)**  
   If `getUsageWithLimits` throws while loading counts, **and** the org has a **subscription row**, **and** the plan has a **finite** equipment or user cap, then **equipment create** and **team invite** (strict path) return **`usage_verify`** → HTTP **503** with a retry message — instead of failing open.  
   - **Service/cron** path (`requireCanCreateRecordForOrganization`) keeps **fail-open** on load errors so automation is not blocked by transient reads.  
   - **Platform admins** skip the strict usage-load block for equipment/invites (profile email check), consistent with support workflows.

2. **`isMonthlyApiCallPlanCapExceeded`** in `lib/billing/usage.ts` — helper for a future guard once `api_calls` is incremented reliably.

3. **Billing copy** — clarifies API bar is not fed by live increments yet.

## Phase 61.2 — Public API (planned only)

A future **third-party HTTP API** (Bearer keys, optional webhooks) would need **dedicated** metering and enforcement; it must **not** be confused with existing **internal** `app/api/organizations/...` usage. Until keys and a public router exist, **`organization_api_usage_monthly` remains display-only / partial** for that story. Design notes: `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`.

## Phase 60.3 code changes

1. **`lib/billing/seat-counts.ts`** — `fetchOrganizationSeatMetrics` (billable active + invited members + valid pending token invites; excludes platform-admin allowlist).  
2. **`GET /api/organizations/[organizationId]/seat-metrics`** — member-authenticated read for billing + team + `BillingAccessProvider`.  
3. **`server-guard`** — `fetchSeatSlots` uses reserved total from seat metrics.  
4. **`/api/invites/create`** — `checkOrgInviteEligibility` before insert; **rollback** (delete row) if outbound email fails after insert.  
5. **`invite-member`** — billing **recheck** immediately before `organization_members` insert (race reduction).  
6. **`evaluateSeatInvite`** — `skipSeatCap` for platform-admin inviter.  
7. **Billing / Team UI** — show **reserved** vs plan + active/pending breakdown; footnotes updated.

## Platform admin & demo

| Actor | Behavior |
|-------|----------|
| **Platform admin** (email policy) | When usage counts fail to load, equipment/invite **strict** verify is **skipped** for that user (profile lookup). `requireWithinPlanLimit` from `enforcePlanLimit` uses the same bypass. **Seat cap:** inviter with allowlist email **skips numeric seat limit** (`skipSeatCap`); platform-admin **members** still do not consume a billable seat. |
| **Demo / sample orgs** | No special casing in quota math; demo gates live in `lib/demo-data/access.ts` for sample tools only. Orgs **without** a subscription row still use **fail-open** for usage-load failures (strict branch requires `subscription != null`). |

## Deferred / risks

- **API monthly cap:** Needs **increment** points (service-role upsert on agreed “billable API” surface) before enforcement is honest.  
- **Token + roster duplicate:** Same email could theoretically appear in `organization_invites` and `organization_members` — reserved count may **double-count** that edge case until deduped.  
- **No subscription row:** Still allows record creation per `getBillingAccessState`; usage-load strict branch does not apply.  
- **503 on usage verify:** Clients should show a retry toast; not a “upgrade plan” message.

## Manual QA

- [ ] At equipment limit: add equipment → 403 with upgrade/archiving message.  
- [ ] Below limit: add succeeds.  
- [ ] Simulate usage load failure (optional, dev): member equipment add → 503 retry copy; same user as platform admin → succeeds or follows admin rules.  
- [ ] Cron or workflow path using `requireCanCreateRecordForOrganization` still creates WOs when usage read fails (fail-open).  
- [ ] Billing Usage: API calls bar shows **0** until increments ship; copy matches.  
- [ ] **60.3:** Reserved seats on billing and team match; token invite blocked at cap; email failure does not leave orphan `organization_invites` row; platform-admin inviter bypasses cap.  

## References

- `lib/billing/seat-counts.ts`, `lib/billing/usage.ts`, `lib/billing/record-eligibility.ts`, `lib/billing/server-guard.ts`, `lib/billing/entitlements.ts`  
- `lib/ai/plan-gate.ts`, `lib/ai/budget.ts`  
- `supabase/migrations/20260518280000_billing_plans_and_api_usage.sql`  
