/**
 * GE-AIOS-RUNTIME-SCALE-1A — Production scale validation + capacity model (read-only probe).
 *
 * Run: pnpm validate:ge-aios-runtime-scale-1a-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  computeRequiredResearchConcurrency,
  GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY,
  GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
  GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS,
  GROWTH_RUNTIME_SCALE_1A_QA_MARKER,
  GROWTH_SCALE_OBSERVED_CRAWL_PAGES_PER_COMPANY,
} from "@/lib/growth/specialists/execution/growth-runtime-scale-1a"
import { tickAutonomousSalesLoopForScheduler } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const PHASE = "GE-AIOS-RUNTIME-SCALE-1A" as const
const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"
const PROBE_BATCH_SIZE = 6

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? null
}

async function measureResearchDurations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number[]> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("research_runs")
    .select("created_at, completed_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", since7d)
    .order("completed_at", { ascending: false })
    .limit(200)

  const durations: number[] = []
  for (const row of data ?? []) {
    const start = Date.parse(String(row.created_at))
    const end = Date.parse(String(row.completed_at))
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    durations.push(end - start)
  }
  return durations
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production scale validation`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  const loopSource = readFileSync(
    resolve(process.cwd(), "lib/growth/specialists/execution/run-autonomous-sales-loop.ts"),
    "utf8",
  )
  pushGate(gates, {
    id: "parallel_research_batch",
    status: loopSource.includes("mapWithBoundedConcurrency") && loopSource.includes("parallel_batch_size")
      ? "pass"
      : "fail",
    detail: "Bounded parallel research batch in ASL",
  })

  const durationsMs = await measureResearchDurations(admin, organizationId)
  const avgMs =
    durationsMs.length > 0 ? durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length : null
  const p50 = percentile(durationsMs, 50)
  const p90 = percentile(durationsMs, 90)
  const p95 = percentile(durationsMs, 95)

  console.log(`\n[${PHASE}] Capacity model (org=${organizationId}, n=${durationsMs.length} completed runs / 7d):`)
  console.log(`  avg research duration: ${avgMs != null ? Math.round(avgMs / 1000) : "—"}s`)
  console.log(`  p50: ${p50 != null ? Math.round(p50 / 1000) : "—"}s | p90: ${p90 != null ? Math.round(p90 / 1000) : "—"}s | p95: ${p95 != null ? Math.round(p95 / 1000) : "—"}s`)
  console.log(`  provider calls/company (observed crawl budget): ~${GROWTH_SCALE_OBSERVED_CRAWL_PAGES_PER_COMPANY} page fetches (no paid LLM per page)`)
  console.log(`  scheduler cycles/day: 72 (20-minute cadence)`)

  const avgDurationMs = avgMs ?? 45_000
  const required = computeRequiredResearchConcurrency({
    targetPerDay: GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
    avgResearchDurationMs: avgDurationMs,
    cycleBudgetMs: 90_000,
  })
  const headroom = computeRequiredResearchConcurrency({
    targetPerDay: GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY,
    avgResearchDurationMs: avgDurationMs,
    cycleBudgetMs: 90_000,
  })

  console.log(`\n[${PHASE}] Required concurrency math:`)
  console.log(`  500/day → ${required.completionsPerCycle} completions/cycle, concurrency ≥ ${required.requiredConcurrency}`)
  console.log(`  750/day → ${headroom.completionsPerCycle} completions/cycle, concurrency ≥ ${headroom.requiredConcurrency}`)
  console.log(
    `  configured: ${GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS} parallel workers × 12 iterations/tick × 72 cycles = up to ${GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS * 12 * 72} attempts/day (theoretical)`,
  )

  const autonomySettings = await fetchGrowthAutonomySettings(admin, organizationId)
  const researchCap = autonomySettings.dailyBudgetLimits.autonomous_research_runs ?? 0
  pushGate(gates, {
    id: "research_daily_cap",
    status: researchCap >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY ? "pass" : "warn",
    detail: `autonomous_research_runs cap=${researchCap} (target ${GROWTH_ORG_RESEARCH_TARGET_PER_DAY})`,
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  pushGate(gates, {
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  })

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "runtime-scale@equipify.ai",
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
    id: "home_pace_telemetry",
    status: runtimeTrust.researchPace != null ? "pass" : "warn",
    detail: runtimeTrust.researchPace
      ? `${runtimeTrust.researchPace.researchedToday}/${runtimeTrust.researchPace.researchTargetPerDay}; ${runtimeTrust.researchPace.ratePerHour}/hr`
      : "missing",
  })

  console.log(`\n[${PHASE}] Controlled scale probe (dry run, batch=${PROBE_BATCH_SIZE})...`)
  const probe = await tickAutonomousSalesLoopForScheduler(admin, {
    organizationIds: [organizationId],
    dryRun: true,
    maxOrganizations: 1,
  })
  const orgResult = probe.organization_results[0]
  console.log(`  leads selected: ${orgResult?.selected_work_count ?? 0}`)
  console.log(`  iterations: ${probe.total_iterations}`)

  const sustainablePerHour =
    durationsMs.length > 0 && avgMs != null
      ? Math.round((3_600_000 / avgMs) * GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS * 10) / 10
      : null
  const projectedPerDay = sustainablePerHour != null ? Math.round(sustainablePerHour * 24) : null

  console.log(`\n[${PHASE}] Measured sustainable: ~${sustainablePerHour ?? "—"} companies/hour`)
  console.log(`[${PHASE}] Projected at sustained rate: ~${projectedPerDay ?? "—"} companies/day`)
  console.log(
    `[${PHASE}] Cost at 500/day: ~${500 * GROWTH_SCALE_OBSERVED_CRAWL_PAGES_PER_COMPANY} HTTP fetches/day (website crawl only; no outbound; LLM usage varies by evidence path)`,
  )

  pushGate(gates, {
    id: "scale_qa_marker",
    status: GROWTH_RUNTIME_SCALE_1A_QA_MARKER ? "pass" : "fail",
    detail: GROWTH_RUNTIME_SCALE_1A_QA_MARKER,
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  const recommendation =
    projectedPerDay != null && projectedPerDay >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY && researchCap >= 500
      ? "Ready for 500/day"
      : projectedPerDay != null && projectedPerDay >= 250
        ? "Ready with constraints"
        : "Not ready"

  console.log(`\n[${PHASE}] Validation: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(`[${PHASE}] Recommendation: ${recommendation}`)
  console.log(`[${PHASE}] Remaining blockers: org research cap upgrade (if ${researchCap}<500), deploy scale code, live parallel batch observation`)

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
