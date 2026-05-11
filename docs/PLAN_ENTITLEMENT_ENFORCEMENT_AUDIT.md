# Plan entitlement enforcement audit (Phase 60.1)

This document maps **how Equipify ties Stripe / `organization_subscriptions` to product behavior**, separates **permissions** from **entitlements**, and records **enforcement status** by area. It is not a billing redesign spec.

**Usage counters & numeric limits** (what is metered vs display-only) are covered in **`docs/USAGE_METERING_ENFORCEMENT.md`** (Phase 60.2 metering + **60.3 seat policy / reserved seats**).

**Billing UX & grace messaging** (trial, past_due, canceled, missing row — **no hard lockout** in 60.4): **`docs/BILLING_ACCESS_AND_GRACE_PERIODS.md`**.

**AI & automation governance** (cron digest, route matrix, AIden vs `ai` entitlement): **`docs/AI_AUTOMATION_GOVERNANCE.md`** (Phase 60.5).

## Architecture summary

### Where the current plan is resolved

| Layer | Source | Notes |
|-------|--------|--------|
| Database | `public.organization_subscriptions` | One row per org; updated by Stripe webhooks (`lib/billing/stripe-webhook-sync.ts`). |
| Read helper | `getOrganizationSubscription(supabase, organizationId)` | `lib/billing/subscriptions.ts` |
| Effective tier for limits / trials | `getEffectivePlanId(planId, subscription)` | Active **trial** → treat as **Scale** for limits/features (`lib/billing/effective-plan.ts`). |
| Plan catalog | `PLANS`, `PlanId`, Stripe price IDs | `lib/plans.ts`; webhook maps prices via `lib/billing/stripe-price-map.ts` / metadata. |
| Feature flags (plan matrix) | `PLAN_FEATURES`, `PLAN_LIMITS` | `lib/billing/entitlements.ts` — **authoritative for `canUseFeature`**. |
| Billing UX state | `getBillingAccessState` | `lib/billing/access.ts` — record creation allowed / restricted / warning. |
| Server create guard | `requireCanCreateRecord`, `requireFeatureAccess`, … | `lib/billing/server-guard.ts` + `app/actions/org-create-enforcement.ts`. |
| Client billing context | `BillingAccessProvider` | `lib/billing-access-context.tsx` — subscription + `getUsageWithLimits` + seat count. |
| AI execution mode | `resolveAiExecutionMode` | `lib/ai/execution-mode.ts` — live vs mock vs disabled from subscription **status** + env overrides. |
| AI task / plan gate | `isTaskAllowedOnPlan`, `isPlanGatingDisabled` | `lib/ai/plan-gate.ts`, `lib/ai/plan-ai-config.ts`. |
| AIden capability matrix | `canUseAidenCapability` | `lib/aiden/tier-capabilities.ts` — orthogonal to `canUseFeature` for some surfaces. |

### What subscription states mean in practice

| Status / situation | Record creation (`canAccessApp`) | Plan features (`canUseFeature` + limits) | AI execution (`resolveAiExecutionMode`) |
|--------------------|----------------------------------|----------------------------------------|----------------------------------------|
| **No row** | **Allowed** (`access.ts` treats as `none` / full) | Defaults to **solo** limits via `planIdFromSubscriptionRow` | **mock_trial** path |
| **trialing** (active trial window) | Allowed | **Scale** tier via `getEffectivePlanId` / trial mapping in entitlements | **mock_trial** (not live providers) |
| **active** | Allowed | Stored `plan_id` (normalized) | **live_paid** |
| **past_due** | Allowed (warning UX) | Still evaluated by plan id | **disabled** |
| **unpaid** / **canceled** / **paused** / **incomplete_expired** | **Blocked** | N/A for gated creates | **disabled** |
| **incomplete** | Allowed (warning) | Per plan id | **mock_trial** |

**Implication:** orgs **without** a subscription row are **not** billing-restricted for record creation today — intentional for onboarding / legacy / demo risk; see **gaps**.

### Permissions vs entitlements

- **Permissions** (`organization_members` → effective capabilities): what **this user** may do **inside** the org (e.g. `canManageInventory`, `canViewFinancials`). Enforced via `requireOrgPermission`, RLS-friendly patterns, and UI capability hooks (`useOrgPermissions`).
- **Entitlements** (`plan_id` + trial + `organization_subscriptions.status`): what the **org’s plan** allows (features, numeric limits). Enforced via `canUseFeature`, `requireFeatureAccess`, `evaluateSeatInvite`, `evaluateEquipmentCreate`, AIden helpers, AI routers.

**Both must pass** for a fully gated flow. A **manager** on **Solo** may pass permission checks but must still fail **Growth+** feature gates where enforced.

### Overrides

| Mechanism | Effect |
|-----------|--------|
| **Platform admin email** | AI usage route can use service role read; AI execution can force live/mock (`lib/ai/execution-mode.ts`). AI Ops list/execute routes treat platform admin as owner **for permissions**; **Phase 60.1** adds plan gate for normal members only where noted. |
| **Env: `AI_PLAN_GATING_DISABLED`** | Skips plan checks in AI router when safe (non-prod / preview) — `lib/ai/plan-ai-config.ts`. |
| **Env allowlists** | `AI_INTERNAL_LIVE_ORG_IDS`, `AI_INTERNAL_MOCK_ORG_IDS` — execution mode. |
| **Org discount fields** | On subscription row — MRR display / checkout hints; not a feature bypass. |
| **Manual platform admin (Stripe / admin UI)** | Changes plan, trial, discount — outside app runtime entitlements. |

---

## Enforcement matrix

Legend: **Enforced** = consistent UI + server (or server-only where UI N/A). **Partial** = one side or incomplete coverage. **Planned** = documented only.

| Area | Plan dependency | Key helper / source | UI gating | API / server gating | Usage / seats | Status | Notes |
|------|-----------------|---------------------|-----------|---------------------|---------------|--------|-------|
| **Core record creates** (customer, WO, quote, invoice, etc.) | Billing state + optional limits | `requireCanCreateRecord`, `evaluateStandardCreate` | Many flows use `enforceCanCreateRecord` | Prospects conversion, some APIs use guard; **direct Supabase from client** may bypass if RLS allows | N/A | **Partial** | Billing restricted blocks creates; **missing sub row = permissive**. |
| **Equipment create** | Plan equipment cap | `evaluateEquipmentCreate` | Modal / server action | Same pattern | vs `PLAN_LIMITS` | **Enforced** (supported paths) | If `usagePack` null, server allows (fail-open). |
| **Team invite / seats** | Plan user cap | `evaluateSeatInvite` | Team UI + `org-billing-guard` | `requireCanCreateRecord(..., "team_invite")` | active **members** counted for usage bar; invites use active+invited | **Enforced** (invite path) | Seat **display** can differ from **invite** counting (invited included on server). |
| **Maintenance plans** | Growth+ `maintenance_plans` | `requireMaintenancePlanCreate` | Dialog | Server action | Billing + feature | **Enforced** | |
| **Workflow automations** | Growth+ `automation` | `canUseFeature` in automations routes | Settings UI | POST/PATCH/duplicate | N/A | **Enforced** | |
| **AI assistants (run/enqueue)** | Growth+ `ai` | `requireFeatureAccess(..., "ai")` | UI | Route handlers | Budget / task gate inside AI | **Enforced** | |
| **Insights generate / org-tasks** | Growth+ `ai` + billing | `requireFeatureAccess` + `requireCanCreateRecord` | UI | Yes | N/A | **Enforced** | |
| **AI Ops digest (send/preview/test)** | Growth+ `ai` | `requireFeatureAccess(..., "ai")` **Phase 60.1** (+ **60.5** PA bypass) | Settings | Digest routes | N/A | **Enforced** (60.1+) | Previously permission-only. |
| **AI Ops recommendations list** | Growth+ `ai` | `requireFeatureAccess` **60.1** (non–platform-admin) | AI Ops UI | GET | N/A | **Enforced** (60.1+) | Platform admin bypass preserved for support. |
| **AI Ops execute action** | Growth+ `ai` | `requireFeatureAccess` **60.1** (non–platform-admin) | UI | POST | Uses `requireCanCreateRecord` inside executor | **Enforced** (60.1+) | |
| **AI Ops narrate** | Growth+ `ai` before LLM | `requireFeatureAccess` **60.5** (non-PA) + `runAiTask` | UI | POST | Token usage | **Enforced** | Cache hit skips LLM + plan gate for new generation only. |
| **AIden chat / feature-requests** | Scale/Growth rules + billing | `canAccessApp`, `canUseAidenCapability`, `getEffectivePlanId` | UI | Dedicated route context | Usage events | **Enforced** | Productivity/safe-actions have separate context files. |
| **Work order AI (parts/summary/tech assist)** | Plan + AI gate | Plan-gate + `resolveAiExecutionMode` | UI | Per-route | Usage | **Enforced** | |
| **Communications AI assist** | Growth+ `ai` | `requireFeatureAccess` **60.5** (non-PA) | UI | Route | AIden usage event | **Enforced** | |
| **QuickBooks integration** | None explicit in route sample | N/A | Integrations hub | `requireOrgIntegrationAdmin` + financial perms | N/A | **UI / permission only** | Not mapped to `canUseFeature`; product may intend Core+. |
| **Customer portal** | Not centrally entitlement-gated | N/A | Portal routes | Session / org scoping | N/A | **Partial** | Marketing: Core+ “portal” — enforcement is org setup + auth, not plan id check in portal bootstrap. |
| **Inventory APIs** | No `requireFeatureAccess` in inventory folder | Capabilities | Client + `requireOrgPermission` patterns | Various inventory routes | N/A | **Permission-first** | Plan does not gate inventory module in code audit. |
| **Reports / advanced** | Growth `reports_advanced` | `canUseFeature` (where used) | Some report surfaces | Spot-check per route | N/A | **Partial** | Not all report endpoints audited in 60.1. |
| **Imports / migration** | None standard | N/A | Settings | Service role / admin | N/A | **Mixed** | High-trust operations; often capability-gated. |
| **Certificates** | No dedicated feature key | N/A | UI | RLS + permissions | N/A | **Permission / RLS** | |
| **API keys / developer** | Scale `api_access` | `canUseFeature` (where wired) | Settings API page | Some routes | **API calls monthly** in `PLAN_LIMITS` | **Partial** | **Counters displayed**; **hard API throttling not fully enforced** app-wide — see gaps. |
| **Offline technician** | N/A (device) | N/A | Work order UX | N/A | N/A | **N/A** | Not subscription-gated. |
| **Storage / documents** | No unified entitlement | N/A | N/A | N/A | N/A | **Planned / ad hoc** | |

---

## High-risk gaps (prioritized)

1. **Missing `organization_subscriptions` row → `canAccessApp` true**  
   New or legacy orgs could create records without ever being on a plan. Mitigation today: onboarding insert; **follow-up**: treat “no row” like trial/solo policy explicitly (product decision).

2. **Client-side Supabase mutations**  
   If RLS allows, users might bypass `enforceCanCreateRecord` used only in server actions. **RLS + API Route Handlers** should remain the backstop.

3. **API monthly call limit**  
   `organization_api_usage_monthly` + UI bar; **not** a universal hard stop on all external API usage (documented as informational / planned metering).

4. **AI Ops digest settings PATCH**  
   **60.5** blocks enabling the digest (`enabled: true`) without **`ai`** for non–platform-admin. GET remains permission-only.

5. **Cron `ai-ops-digest` worker** — **closed in 60.5** (`requireFeatureAccess` per org + safe skip logs). See `docs/AI_AUTOMATION_GOVERNANCE.md`.

6. **QuickBooks / portal / inventory**  
   Permission-rich; **plan alignment** is mostly marketing unless product mandates explicit `canUseFeature` — **deferred** to policy pass.

7. **`evaluateEquipmentCreate` / `evaluateSeatInvite` fail-open** when `usagePack` or seat count is null — avoids blocking on read errors; could allow over-limit in edge failure modes.

---

## Permissions-only risk check (sample)

- **Inventory**, **QuickBooks**, **portal**, **certificates**: rely heavily on **permissions** and RLS; **not** consistently paired with `canUseFeature`. If product requires “Growth+ only”, add `requireFeatureAccess` in a targeted 60.x follow-up.

---

## Phase 60.1 code changes (enforcement)

- AI Ops **digest** `send`, `preview`, `test-destination`: `requireFeatureAccess(..., "ai")` after org permission.
- AI Ops **recommendations** GET and **execute-action** POST: same for **non–platform-admin** users (support workflows preserved).

---

## Recommended next phases

| Phase | Scope |
|-------|--------|
| **60.2 Usage metering & enforcement** | Wire API call counters to consistent enforcement points; optional soft caps; align Growth/Scale limits with actual traffic. |
| **60.3 Seat limit enforcement** | Align “seats used” display with invite rule; block member activation paths; handle edge fail-open. |
| **60.4 Grace period / lockout UX** | Past-due read-only, messaging, **no** full hard lock in 60.x unless product approves. |
| **60.5 AI & automation governance** | **Shipped** — `docs/AI_AUTOMATION_GOVERNANCE.md` (cron digest plan check; narrate/communications/prospect/follow-up `ai` gates; digest settings enable gate; PA bypass on digest send/preview/test). |

---

## Manual QA checklist

- [ ] Paid **Growth** org: AI, automations, maintenance, AI Ops digest send succeed with correct role.
- [ ] **Solo/Core** org: AI Ops digest send/preview returns **403** with upgrade message; UI shows error gracefully.
- [ ] **Trialing** org: Scale limits, AI features allowed per matrix; AI execution **mock** vs live per `resolveAiExecutionMode`.
- [ ] **past_due**: record creation still allowed; AI disabled in execution mode.
- [ ] **canceled/unpaid**: record creation blocked on guarded flows.
- [ ] **Platform admin** email: can still hit AI Ops recommendations/execute/digest send/preview/test for support (bypass plan gate).
- [ ] **Cron digest**: ineligible org skipped with `no_ai_entitlement`; logs contain no prompts/secrets (`ai_governance_skip`).
- [ ] **Permissions**: technician without insights permission still blocked regardless of plan.

---

## References (code)

- `lib/billing/entitlements.ts` — plan features & numeric limits.
- `lib/billing/access.ts` — billing state → create allowed.
- `lib/billing/server-guard.ts` — `requireFeatureAccess`, `requireCanCreateRecord`.
- `lib/billing/subscriptions.ts` — row shape & trial helpers.
- `lib/ai/execution-mode.ts` — live vs mock AI.
- `app/(dashboard)/settings/billing/page.tsx` — usage display.
- `docs/AI_AUTOMATION_GOVERNANCE.md` — AI/automation route matrix & cron behavior (60.5).
