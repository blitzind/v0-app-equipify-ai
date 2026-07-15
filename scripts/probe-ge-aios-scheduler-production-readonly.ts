/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Read-only Production scheduler portfolio probe.
 * Run via Vercel Production env only:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ge-aios-scheduler-production-readonly.ts
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"

const STALL_THRESHOLD_MS = 45 * 60 * 1000

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const objectivesTable = admin.schema("growth").from("organization_growth_objectives")

  const [activeObjectives, dueObjectives, futureObjectives, stalledObjectives, dfDue, dfBlocked] =
    await Promise.all([
      objectivesTable
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("emergency_stop_active", false),
      objectivesTable
        .select("id, organization_id, runtime_state, scheduler_wake_at, scheduler_runtime_running", {
          count: "exact",
        })
        .eq("status", "active")
        .eq("emergency_stop_active", false)
        .eq("scheduler_runtime_running", true)
        .lte("scheduler_wake_at", nowIso)
        .order("scheduler_wake_at", { ascending: true })
        .limit(5)
        .then((result) => result)
        .catch(() => ({ data: null, count: null, error: { message: "scheduler_columns_unavailable" } })),
      objectivesTable
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("emergency_stop_active", false)
        .gt("scheduler_wake_at", nowIso)
        .then((result) => result)
        .catch(() => ({ count: null, error: { message: "scheduler_columns_unavailable" } })),
      objectivesTable
        .select("id, runtime_state, updated_at")
        .eq("status", "active")
        .limit(200),
      admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*", { count: "exact", head: true })
        .not("state", "in", '("waiting_for_approval","approved","executed","failed")')
        .or(`next_eligible_wake_at.is.null,next_eligible_wake_at.lte.${nowIso}`)
        .then((result) => result)
        .catch(() => ({ count: null, error: { message: "draft_factory_unavailable" } })),
      admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*", { count: "exact", head: true })
        .or("state.eq.paused,paused_reason.eq.portfolio_deferred,paused_reason.eq.operator_blocked")
        .then((result) => result)
        .catch(() => ({ count: null, error: { message: "draft_factory_unavailable" } })),
    ])

  let stalledCount = 0
  const ageBuckets = { under_1h: 0, under_24h: 0, over_24h: 0 }
  for (const row of stalledObjectives.data ?? []) {
    const runtime = (row as { runtime_state?: { lastTickAt?: string; startedAt?: string } }).runtime_state
    const last = runtime?.lastTickAt ?? runtime?.startedAt
    if (!last) continue
    const elapsed = now - Date.parse(last)
    if (elapsed >= STALL_THRESHOLD_MS) stalledCount += 1
    if (elapsed < 3_600_000) ageBuckets.under_1h += 1
    else if (elapsed < 86_400_000) ageBuckets.under_24h += 1
    else ageBuckets.over_24h += 1
  }

  let providerBudgetState: unknown = "unavailable"
  try {
    const { getOrganizationBudgets } = await import(
      "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
    )
    if (organizationId) {
      providerBudgetState = await getOrganizationBudgets(admin, organizationId)
    }
  } catch {
    providerBudgetState = "unavailable"
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
        organizationId: organizationId || null,
        readOnly: true,
        counts: {
          active_objectives: activeObjectives.count ?? null,
          due_running_objectives: dueObjectives.count ?? null,
          future_wake_objectives: futureObjectives.count ?? null,
          stalled_objectives_sampled: stalledCount,
          draft_factory_due: dfDue.count ?? null,
          draft_factory_blocked: dfBlocked.count ?? null,
        },
        objective_age_distribution_sample: ageBuckets,
        provider_budget_state: providerBudgetState,
        latest_scheduler_duration_ms: "unavailable",
        latest_stop_reason: "unavailable",
        average_accounts_advanced_per_tick: "unavailable",
        errors: {
          due_objectives: dueObjectives.error?.message ?? null,
          future_objectives: futureObjectives.error?.message ?? null,
          draft_factory_due: dfDue.error?.message ?? null,
          draft_factory_blocked: dfBlocked.error?.message ?? null,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
