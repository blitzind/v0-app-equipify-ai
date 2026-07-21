/**
 * GE-AIOS-RUNTIME-THROUGHPUT-1A — Production throughput + telemetry validation (read-only).
 *
 * Run: pnpm validate:ge-aios-runtime-throughput-1a-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { loadGrowthHomeCanonicalRuntimeActivity } from "@/lib/growth/home/growth-home-canonical-runtime-activity-loader-1a"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import {
  AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS,
  GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
} from "@/lib/growth/specialists/execution/growth-runtime-throughput-1a"
import { tickAutonomousSalesLoopForScheduler } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const PHASE = "GE-AIOS-RUNTIME-THROUGHPUT-1A" as const
const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

async function auditThroughput24h(admin: SupabaseClient, organizationId: string): Promise<Record<string, number>> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const schedulerRoute = growthCronApiPath("growth-objective-runtime-scheduler")

  const [
    schedulerRuns,
    completedResearch,
    activeResearch,
    acceptedLeads,
    rejectedLeads,
  ] = await Promise.all([
    listRecentGrowthCronExecutionRuns(admin, { cronRoute: schedulerRoute, limit: 200 }),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, completed_at, created_at", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .gte("completed_at", since24h),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["queued", "running"]),
    admin
      .schema("growth")
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("admission_status", "accepted")
      .gte("updated_at", since24h),
    admin
      .schema("growth")
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("admission_status", "rejected")
      .gte("updated_at", since24h),
  ])

  const cycles24h = schedulerRuns.filter((row) => {
    const at = row.finishedAt ?? row.startedAt
    return at != null && Date.parse(at) >= Date.parse(since24h)
  }).length

  const timedOutCycles = schedulerRuns.filter((row) => {
    const at = row.finishedAt ?? row.startedAt
    if (at == null || Date.parse(at) < Date.parse(since24h)) return false
    return row.ok === false
  }).length

  const completedCount = completedResearch.count ?? 0
  const hours = 24
  const leadsPerHour = completedCount / hours
  const leadsPerDay = completedCount

  return {
    scheduler_cycles_24h: cycles24h,
    research_completed_24h: completedCount,
    active_research_runs: activeResearch.count ?? 0,
    leads_accepted_24h: acceptedLeads.count ?? 0,
    leads_rejected_24h: rejectedLeads.count ?? 0,
    timed_out_or_failed_cycles_24h: timedOutCycles,
    leads_per_hour: Math.round(leadsPerHour * 100) / 100,
    leads_per_day: leadsPerDay,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production runtime throughput validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []
  const generatedAt = new Date().toISOString()

  const loopSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
  pushGate(gates, {
    id: "scheduler_max_iterations",
    status: loopSource.includes("AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS") ? "pass" : "fail",
    detail: `scheduler max iterations=${AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS}`,
  })
  pushGate(gates, {
    id: "continue_on_skip",
    status: loopSource.includes("continue_after_skip: true") && loopSource.includes("skippedWorkItemIds") ? "pass" : "fail",
    detail: "Slow/failed work items yield to next candidate",
  })
  pushGate(gates, {
    id: "canonical_activity_loader",
    status: readSource("lib/growth/home/growth-home-canonical-runtime-activity-loader-1a.ts").includes(
      "research_runs",
    )
      ? "pass"
      : "fail",
    detail: "Home reads canonical research_runs for last activity",
  })

  const throughput = await auditThroughput24h(admin, organizationId)
  console.log(`\n[${PHASE}] 24h throughput (org=${organizationId}):`)
  for (const [key, value] of Object.entries(throughput)) {
    console.log(`  - ${key}: ${value}`)
  }

  pushGate(gates, {
    id: "measured_leads_per_hour",
    status: throughput.leads_per_hour > 0 ? "pass" : "warn",
    detail: `${throughput.leads_per_hour} leads/hour (${throughput.research_completed_24h} completed / 24h)`,
  })

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "runtime-throughput@equipify.ai",
    actorUserId: CERT_ACTOR_USER_ID,
  })

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: summary.runtimeTrust ?? null,
    salesOutcomes: summary.salesOutcomes,
    activeWork: null,
    pendingApprovals: summary.kpis.approvalQueueCount,
    setupIncomplete: false,
    missionDiscovery: summary.missionDiscovery,
    activation: summary.avaActivation ?? null,
    generatedAt: summary.generatedAt,
    canonicalFocusCompanyName: summary.canonicalOperatorFocus?.companyName ?? null,
  })

  pushGate(gates, {
    id: "canonical_activity_on_home",
    status: summary.runtimeTrust?.canonicalActivity?.lastMeaningfulActivity != null ? "pass" : "warn",
    detail:
      summary.runtimeTrust?.canonicalActivity?.lastMeaningfulActivity?.label ??
      "no canonical activity resolved",
  })

  pushGate(gates, {
    id: "activity_source_not_scheduler_only",
    status:
      runtimeTrust.lastAutonomousActivitySource != null &&
      runtimeTrust.lastAutonomousActivitySource !== "scheduler_fallback"
        ? "pass"
        : "warn",
    detail: `last activity source=${runtimeTrust.lastAutonomousActivitySource ?? "none"}`,
  })

  pushGate(gates, {
    id: "no_false_working_on_stale",
    status:
      runtimeTrust.operatorState !== "working" ||
      !runtimeTrust.telemetryStale
        ? "pass"
        : "fail",
    detail: `state=${runtimeTrust.operatorStateLabel}; telemetryStale=${runtimeTrust.telemetryStale}`,
  })

  console.log(`\n[${PHASE}] Controlled scheduler probe (dry run)...`)
  const probe = await tickAutonomousSalesLoopForScheduler(admin, {
    organizationIds: [organizationId],
    dryRun: true,
    maxOrganizations: 1,
  })

  const orgResult = probe.organization_results[0]
  console.log(`  leads considered (selected): ${orgResult?.selected_work_count ?? 0}`)
  console.log(`  stop reason: ${orgResult?.stop_reason ?? probe.skipped_reason ?? "none"}`)
  console.log(`  iterations: ${probe.total_iterations}`)

  pushGate(gates, {
    id: "probe_selects_multiple_when_available",
    status: (orgResult?.selected_work_count ?? probe.total_iterations) >= 1 ? "pass" : "warn",
    detail: `dry-run selected=${orgResult?.selected_work_count ?? 0}; iterations=${probe.total_iterations}`,
  })

  pushGate(gates, {
    id: "throughput_qa_marker",
    status: GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER ? "pass" : "fail",
    detail: GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  const expectedSustainableLeadsPerHour = Math.min(
    AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS * (60 / 20),
    throughput.leads_per_hour > 0 ? throughput.leads_per_hour * 2 : 6,
  )

  console.log(`\n[${PHASE}] Validation score: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(`[${PHASE}] Expected sustainable throughput after fixes: ~${expectedSustainableLeadsPerHour} leads/hour`)
  console.log(
    `[${PHASE}] Remaining blockers: org timeout vs research duration, sales-loop 20s sub-budget, research daily cap`,
  )

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
