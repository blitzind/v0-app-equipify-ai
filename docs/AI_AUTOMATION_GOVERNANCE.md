# AI & automation governance (Phase 60.5)

Companion to **`docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md`** (plan matrix) and **`docs/USAGE_METERING_ENFORCEMENT.md`** (counters). This doc records **how AI and scheduled automation respect permissions, plan entitlements, and safe operational boundaries** — without new pricing tiers, full metering, or AIden UI redesign.

## Principles

1. **Permissions** (per-user capabilities) and **entitlements** (per-org plan + trial) both apply where the product exposes AI output or automation side effects.
2. **`ai` feature** (Growth+ in `lib/billing/entitlements.ts`; active trial → Scale mapping) is the **primary plan gate** for AI Ops bundle routes and most **LLM-backed** staff APIs aligned in 60.5.
3. **`automation` feature** (Growth+) gates **workflow automation** authoring and **dispatch** (`lib/workflows/dispatch.ts`).
4. **Platform admins** (email policy) retain **bypass** on member-facing gates where support/debug needs it (same pattern as Phase 60.1 AI Ops list/execute).
5. **Cron / service role** must not assume every org row in settings tables is entitled — re-check plan per org; **never throw** the whole job for one bad org.
6. **Logging:** entitlement skips log `organizationId`, `feature`, `reason`, `source` only — **no** prompts, completions, tokens, or secrets (`lib/ai/governance-log.ts`).

---

## Route / surface matrix

Legend: **Perm** = org permission / role pattern. **Plan** = `requireFeatureAccess` / `canUseFeature`. **Meter** = usage logging (not a hard overage bill). **PA bypass** = platform-admin email skips the listed plan gate for members.

### AI Ops

| Surface | Perm / auth | Plan (`ai`) | Meter / notes | PA bypass |
|--------|-------------|-------------|---------------|-----------|
| `GET .../ai-ops/recommendations` | Member + `canViewInsights` (+ assigned-work scope) | Yes, non-PA | Deterministic engine | Yes |
| `POST .../ai-ops/recommendations/[key]/narrate` | `canViewInsights` | **Yes before LLM** (non-PA); cache hit = no new LLM | `runAiTask` + `aiden_usage_events` | Yes |
| `POST .../ai-ops/recommendations/[key]/execute-action` | Owner/admin/manager | Yes, non-PA | Executor may call `requireCanCreateRecord` | Yes |
| `PATCH .../ai-ops/recommendations/[key]/lifecycle` | Owner/admin/manager | No (state only) | DB | — |
| `GET .../ai-ops/recommendations/[key]/timeline` | Member | No (read history) | — | — |
| `POST .../ai-ops/outcomes` | Member | No (telemetry) | `ai_ops_outcomes` | — |
| `POST/DELETE .../ai-ops/dismissals` | Manager+ | No | — | — |
| `GET/PATCH .../ai-ops/digest/settings` | GET: insights or workspace settings; PATCH: workspace settings | **PATCH:** if saved `enabled` would be true → `ai` (non-PA) | — | Yes |
| `GET .../ai-ops/digest/runs` | Insights or workspace settings | No (read-only history) | — | — |
| `POST .../ai-ops/digest/send` | Workspace settings | Yes, non-PA | Resend + run row | Yes |
| `POST .../ai-ops/digest/preview` | Workspace settings | Yes, non-PA | Dry path | Yes |
| `POST .../ai-ops/digest/test-destination` | Workspace settings | Yes, non-PA | Test send | Yes |
| `GET/POST /api/cron/ai-ops-digest` | `CRON_SECRET` | **Per-org** `requireFeatureAccess(..., "ai")` before send | JSON summary + `logAiGovernanceSkip` | N/A |

### AIden (`/api/organizations/[organizationId]/aiden/*`)

| Surface | Perm | Plan / capability | Notes |
|--------|------|-------------------|--------|
| `chat`, `feature-requests` | AIden context | `canUseAidenCapability` + billing in route helpers | Broad **support_chat** / **feature_request**; execution mode via `resolveAiExecutionMode` |
| Productivity (`customer-summary`, `work-order-summary`, `draft`) | Productivity request context | **`productivity_ai`** → Growth+ (`canUseAidenCapability`) | Uses `runAiTask` where applicable |
| `operational-recommendations` | Operational context | **`operational_copilot`** → Scale | |
| `actions/prepare|confirm|execute|cancel` | Safe-actions / ops contexts | **`safe_aiden_actions`** / **`operational_copilot`** as wired | Execution tools remain permission-heavy inside executors |
| `productivity/eligibility` | Member | Read-only flags for UI | |

**Orthogonality:** `canUseAidenCapability` is **not** identical to `canUseFeature("ai")`. Staff routes aligned with the **AI bundle** in 60.5 use **`requireFeatureAccess(..., "ai")`** where LLM output is produced (see Communications / Prospects / Follow-up below). AIden launcher copy for locked capabilities should continue to reference **upgrade** messaging from eligibility APIs — no launcher redesign in 60.5.

### Workflow automation

| Surface | Perm | Plan (`automation`) | Notes |
|--------|------|---------------------|--------|
| `GET/POST .../workflow-automations` | Member read; manager+ create | `canUseFeature` on list + POST | UI gets `automationAllowed` |
| `dispatchWorkflowTriggers` / `POST .../workflows/emit` | Caller checks membership; dispatch uses service client | **`dispatchWorkflowTriggers`** returns `{ skippedPlan: true }` if org lacks `automation` | No per-run quota |

**Gap (documented):** No separate “automation runs per month” cap — only feature + billing context.

### Other LLM staff routes (aligned with `ai` where added in 60.5)

| Surface | Plan gate |
|---------|-----------|
| `POST .../communications/[id]/ai-assist` | **`requireFeatureAccess(..., "ai")`** (non-PA) + `canViewCommunications` |
| `POST .../prospects/[id]/draft-followup` | **`requireFeatureAccess(..., "ai")`** (non-PA) + `canManageProspects` |
| `POST .../follow-up-tasks/[id]/regenerate-draft` | **`requireFeatureAccess(..., "ai")`** (non-PA) + `canManageCommunications` |
| Work order AI (`ai-parts-suggestions`, `ai-service-summary`, `ai-technician-assist`) | Existing `runAiTask` + plan-gate / execution mode |
| `insights/generate`, `ai-assistants` run/enqueue | `requireFeatureAccess(..., "ai")` (prior phase) |

---

## Cron: AI Ops digest

- **Global** cron still runs on schedule (`vercel.json`).
- For each org at send hour, **after** time/weekend/cooldown checks, **`requireFeatureAccess(admin, orgId, "ai")`** runs using the **service-role** client.
- If denied: **no** `runDigestForOrganization`, **no** email/Slack/Teams; response includes `perOrg[].error === "no_ai_entitlement"` and `summary.skipped_no_ai_entitlement`.
- **Safe log:** `logAiGovernanceSkip({ feature: "ai_ops_digest_cron", reason: "missing_ai_plan_entitlement", ... })`.

---

## Execution mode vs entitlements

- **`resolveAiExecutionMode`** (`lib/ai/execution-mode.ts`): live vs mock vs **disabled** from **subscription status** (e.g. past_due → disabled) and env overrides — **orthogonal** to Growth/Scale **feature** flags.
- **Trialing** orgs: entitlements map trial → Scale for **`canUseFeature`**; execution mode stays **`mock_trial`** unless overridden — so an org may be **entitled** to AI features while still receiving **simulated** provider output.

---

## Usage visibility (no new metering in 60.5)

| What is counted / stored today | Table / helper |
|--------------------------------|----------------|
| AI task requests + estimated cost | `ai_usage_logs` via `recordAiUsageLog` / plan-gate |
| Org AI budget | `organizations.ai_monthly_budget_cents` + `precheckOrganizationAiBudget` |
| AIden feature usage (telemetry) | `aiden_usage_events` (`recordAidenUsageEvent`) |
| Follow-up automation telemetry | `follow_up_automation_usage_events` |
| Workflow run history | `workflow_runs`, `workflow_run_logs` |
| API monthly (display) | `organization_api_usage_monthly` — **not** incremented app-wide (see usage doc) |

**Deferred / display-only:** unified “AI ops digest sends” counter for billing, automation run quotas, overage pricing.

---

## Manual QA checklist

- [ ] **Growth/Scale** org: AI Ops list, narrate (miss cache), digest send, communications AI assist, prospect draft, follow-up regenerate — succeed with permissions.
- [ ] **Solo/Core** org: same routes return **403** `feature_denied` (or equivalent) for non–platform-admin.
- [ ] **Cron:** Solo org with digest settings enabled — **skipped** with `no_ai_entitlement`; logs show `ai_governance_skip` JSON **without** secrets.
- [ ] **Platform admin** in customer org: AI Ops list/execute/narrate plan bypass still behaves as 60.1; digest settings **PATCH** can enable digest without plan row (support).
- [ ] **Trial** org: `ai` entitled (Scale mapping); digest cron allowed if billing row + trial active.
- [ ] **Workflow:** org without `automation` — `dispatchWorkflowTriggers` does not execute automations (`skippedPlan`).

---

## Related code

- `lib/billing/server-guard.ts` — `requireFeatureAccess`, `loadOrgBillingContext`
- `lib/billing/entitlements.ts` — `canUseFeature`, `Feature`
- `lib/ai/governance-log.ts` — cron-safe skip logging
- `app/api/cron/ai-ops-digest/route.ts` — per-org digest entitlement
- `lib/workflows/dispatch.ts` — automation entitlement before run loop
