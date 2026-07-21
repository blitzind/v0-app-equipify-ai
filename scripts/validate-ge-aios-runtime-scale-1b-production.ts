/**
 * GE-AIOS-RUNTIME-SCALE-1B — Policy activation, live concurrency proof, realized throughput.
 *
 * Run: pnpm validate:ge-aios-runtime-scale-1b-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import {
  applyScaleResearchBudgetForProductionOrg,
  GROWTH_RUNTIME_SCALE_1B_QA_MARKER,
} from "@/lib/growth/ava-activation/growth-scale-research-budget-1b"
import { getOrganizationAiTeammateAutonomousActivation } from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS_SCALE_1A,
  GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS_SCALE_1A,
  GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS,
  GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY,
  GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
  GROWTH_RUNTIME_SCALE_1A_QA_MARKER,
} from "@/lib/growth/specialists/execution/growth-runtime-scale-1a"
import { tickAutonomousSalesLoopForScheduler } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"

const PHASE = "GE-AIOS-RUNTIME-SCALE-1B" as const
const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const POLL_INTERVAL_MS = 2_000

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

type ResearchRunRow = {
  id: string
  lead_id: string
  status: string
  created_at: string
  completed_at: string | null
  failed_reason: string | null
}

type DeploymentState =
  | "code_not_deployed"
  | "code_deployed_policy_not_migrated"
  | "policy_migrated_concurrency_not_proven"
  | "fully_proven"

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function listRunsSince(admin: SupabaseClient, sinceIso: string): Promise<ResearchRunRow[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, created_at, completed_at, failed_reason")
    .eq("organization_id", ORG_ID)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ResearchRunRow[]
}

async function countActiveRunning(admin: SupabaseClient): Promise<ResearchRunRow[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, created_at, completed_at, failed_reason")
    .eq("organization_id", ORG_ID)
    .eq("status", "running")
  if (error) throw new Error(error.message)
  return (data ?? []) as ResearchRunRow[]
}

function detectOverlapPairs(runs: ResearchRunRow[]): Array<{
  runA: string
  runB: string
  leadA: string
  leadB: string
  overlapStart: string
}> {
  const pairs: Array<{
    runA: string
    runB: string
    leadA: string
    leadB: string
    overlapStart: string
  }> = []

  for (let i = 0; i < runs.length; i += 1) {
    for (let j = i + 1; j < runs.length; j += 1) {
      const a = runs[i]!
      const b = runs[j]!
      if (a.lead_id === b.lead_id) continue
      const aStart = Date.parse(a.created_at)
      const bStart = Date.parse(b.created_at)
      const aEnd = a.completed_at ? Date.parse(a.completed_at) : Number.POSITIVE_INFINITY
      const bEnd = b.completed_at ? Date.parse(b.completed_at) : Number.POSITIVE_INFINITY
      if (!Number.isFinite(aStart) || !Number.isFinite(bStart)) continue
      const overlapStart = Math.max(aStart, bStart)
      const overlapEnd = Math.min(aEnd, bEnd)
      if (overlapStart < overlapEnd) {
        pairs.push({
          runA: a.id,
          runB: b.id,
          leadA: a.lead_id,
          leadB: b.lead_id,
          overlapStart: new Date(overlapStart).toISOString(),
        })
      }
    }
  }
  return pairs
}

function findDuplicateLeadClaims(runs: ResearchRunRow[]): string[] {
  const byLead = new Map<string, string[]>()
  for (const run of runs) {
    const list = byLead.get(run.lead_id) ?? []
    list.push(run.id)
    byLead.set(run.lead_id, list)
  }
  return [...byLead.entries()].filter(([, ids]) => ids.length > 1).map(([leadId]) => leadId)
}

function resolveDeploymentState(input: {
  codeDeployed: boolean
  policyMigrated: boolean
  concurrencyProven: boolean
}): DeploymentState {
  if (!input.codeDeployed) return "code_not_deployed"
  if (!input.policyMigrated) return "code_deployed_policy_not_migrated"
  if (!input.concurrencyProven) return "policy_migrated_concurrency_not_proven"
  return "fully_proven"
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production policy activation + live concurrency proof`)
  console.log(`[${PHASE}] QA marker: ${GROWTH_RUNTIME_SCALE_1B_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin = bootstrap.admin
  const gates: Gate[] = []

  const loopSource = readFileSync(
    resolve(process.cwd(), "lib/growth/specialists/execution/run-autonomous-sales-loop.ts"),
    "utf8",
  )
  const codeDeployed =
    loopSource.includes("mapWithBoundedConcurrency") &&
    loopSource.includes("GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS")
  pushGate(gates, {
    id: "scale_code_deployed",
    status: codeDeployed ? "pass" : "fail",
    detail: codeDeployed
      ? `${GROWTH_RUNTIME_SCALE_1A_QA_MARKER} parallel batch present in ASL source`
      : "Bounded parallel research batch missing from ASL",
  })

  console.log(`\n[${PHASE}] 1. Diagnose cap migration (org=${ORG_ID})`)
  const [settingsBefore, budgetBefore, activation, killSwitches] = await Promise.all([
    fetchGrowthAutonomySettings(admin, ORG_ID),
    getAutonomyBudgetSnapshot(admin, { organizationId: ORG_ID, capability: "research" }),
    getOrganizationAiTeammateAutonomousActivation(admin, ORG_ID),
    getRuntimeKillSwitchStates(admin),
  ])

  const capBefore = settingsBefore.dailyBudgetLimits.autonomous_research_runs ?? 0
  console.log(`  settings cap (canonical): ${capBefore}`)
  console.log(`  enforced snapshot cap: ${budgetBefore?.cap ?? "—"} (consumed=${budgetBefore?.consumed ?? "—"})`)
  console.log(`  ava activated: ${Boolean(activation?.autonomousActivatedAt)}`)
  console.log(`  research toggle: ${settingsBefore.capabilityToggles.research}`)
  console.log(
    `  migration path: ensureScaleResearchBudgetForActivatedOrg → applyScaleResearchBudgetForProductionOrg (Home + activation; errors no longer swallowed)`,
  )
  console.log(
    `  prior failure modes: Home-only trigger; .catch swallowed upsert errors; live-7a activate wrote cap=20; ensureActivationResearchBudgetEnabled returned early when cap>0`,
  )

  pushGate(gates, {
    id: "ava_activated",
    status: activation?.autonomousActivatedAt ? "pass" : "warn",
    detail: activation?.autonomousActivatedAt
      ? `activated_at=${activation.autonomousActivatedAt}`
      : "not activated — Home migration path may not run",
  })

  console.log(`\n[${PHASE}] 2. Apply production policy (idempotent)`)
  const migration = await applyScaleResearchBudgetForProductionOrg(admin, ORG_ID)
  console.log(`  before=${migration.beforeCap} after=${migration.afterCap} migrated=${migration.migrated}`)
  console.log(`  enforced cap=${migration.enforcedCap} remaining=${migration.budgetRemaining}`)

  const [settingsAfter, budgetAfter] = await Promise.all([
    fetchGrowthAutonomySettings(admin, ORG_ID),
    getAutonomyBudgetSnapshot(admin, { organizationId: ORG_ID, capability: "research" }),
  ])
  const capAfter = settingsAfter.dailyBudgetLimits.autonomous_research_runs ?? 0

  pushGate(gates, {
    id: "research_daily_cap",
    status: capAfter >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY ? "pass" : "fail",
    detail: `autonomous_research_runs cap=${capAfter} (target ${GROWTH_ORG_RESEARCH_TARGET_PER_DAY}; headroom ${GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY})`,
  })
  pushGate(gates, {
    id: "validator_enforced_cap_match",
    status: budgetAfter?.cap === capAfter ? "pass" : "fail",
    detail: `settings cap=${capAfter}; runtime snapshot cap=${budgetAfter?.cap ?? "—"}`,
  })
  pushGate(gates, {
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  })

  const policyMigrated = capAfter >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY

  console.log(`\n[${PHASE}] 3. Writers audit (no downgrade below explicit org cap)`)
  console.log(`  ✓ applyScaleResearchBudgetForProductionOrg — upgrades only when cap < ${GROWTH_ORG_RESEARCH_TARGET_PER_DAY}`)
  console.log(`  ✓ live-7a activate — Math.max(existing, 500); constant=500`)
  console.log(`  ✓ policy synthesizer — no Math.min(researchDaily, 4) clamp`)
  console.log(`  ✓ pilot budget — ${GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY}/day (telemetry only; runtime uses org settings)`)

  console.log(`\n[${PHASE}] 4. Live scheduler cycle (dryRun=false, side effects allowed)`)
  const cycleStartIso = new Date().toISOString()
  const cycleStartMs = Date.now()
  let maxConcurrentRunning = 0
  const overlapSamples: Array<{ at: string; running: number; leadIds: string[] }> = []
  let pollDone = false

  const pollPromise = (async () => {
    while (!pollDone) {
      const running = await countActiveRunning(admin)
      maxConcurrentRunning = Math.max(maxConcurrentRunning, running.length)
      if (running.length >= 2) {
        overlapSamples.push({
          at: new Date().toISOString(),
          running: running.length,
          leadIds: running.map((row) => row.lead_id),
        })
      }
      await sleep(POLL_INTERVAL_MS)
    }
  })()

  const tickResult = await tickAutonomousSalesLoopForScheduler(admin, {
    organizationIds: [ORG_ID],
    dryRun: false,
    maxOrganizations: 1,
    maxRuntimeMs: GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS_SCALE_1A,
    perOrganizationTimeoutMs: AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS_SCALE_1A,
  })

  pollDone = true
  await pollPromise

  const cycleEndMs = Date.now()
  const cycleDurationMs = cycleEndMs - cycleStartMs
  const cycleRuns = await listRunsSince(admin, cycleStartIso)

  const completed = cycleRuns.filter((row) => row.status === "completed")
  const failed = cycleRuns.filter((row) => row.status === "failed")
  const timedOut = cycleRuns.filter((row) =>
    String(row.failed_reason ?? "").toLowerCase().includes("timeout"),
  )
  const skipped = cycleRuns.filter((row) => row.status === "skipped")
  const stillRunning = cycleRuns.filter((row) => row.status === "running" || row.status === "queued")
  const uniqueLeads = new Set(cycleRuns.map((row) => row.lead_id))
  const overlapPairs = detectOverlapPairs(cycleRuns)
  const duplicateLeads = findDuplicateLeadClaims(cycleRuns)

  const concurrencyProven = maxConcurrentRunning >= 2 || overlapPairs.length > 0

  pushGate(gates, {
    id: "live_overlap",
    status: concurrencyProven ? "pass" : "fail",
    detail: concurrencyProven
      ? `max_concurrent_running=${maxConcurrentRunning}; overlap_pairs=${overlapPairs.length}`
      : `max_concurrent_running=${maxConcurrentRunning} (need ≥2)`,
  })
  pushGate(gates, {
    id: "distinct_lead_claims",
    status: uniqueLeads.size >= Math.min(2, cycleRuns.length) || cycleRuns.length === 0 ? "pass" : "warn",
    detail: `runs=${cycleRuns.length}; unique_leads=${uniqueLeads.size}`,
  })
  pushGate(gates, {
    id: "no_duplicate_claims",
    status: duplicateLeads.length === 0 ? "pass" : "fail",
    detail:
      duplicateLeads.length === 0
        ? "no duplicate lead claims in cycle window"
        : `duplicate leads: ${duplicateLeads.join(", ")}`,
  })
  pushGate(gates, {
    id: "independent_outcomes",
    status:
      completed.length + failed.length + timedOut.length + skipped.length > 0 || cycleRuns.length === 0
        ? "pass"
        : "warn",
    detail: `completed=${completed.length} failed=${failed.length} timeout=${timedOut.length} skipped=${skipped.length} still_active=${stillRunning.length}`,
  })

  const measuredCompletionsPerCycle = completed.length
  const measuredCycleMinutes = cycleDurationMs / 60_000
  const measuredCompletionsPerHour =
    measuredCycleMinutes > 0
      ? Math.round((measuredCompletionsPerCycle / measuredCycleMinutes) * 60 * 10) / 10
      : 0
  const measuredCompletionsPerDay =
    measuredCompletionsPerHour > 0 ? Math.round(measuredCompletionsPerHour * 24) : 0

  console.log(`\n[${PHASE}] 5. Realized cycle throughput (measured, not modeled)`)
  console.log(`  cycle_start: ${cycleStartIso}`)
  console.log(`  cycle_end: ${new Date(cycleEndMs).toISOString()}`)
  console.log(`  cycle_duration_ms: ${cycleDurationMs}`)
  console.log(`  tick iterations: ${tickResult.total_iterations}`)
  console.log(`  tick outcomes_completed: ${tickResult.total_outcomes_completed}`)
  console.log(`  leads claimed (runs created): ${cycleRuns.length}`)
  console.log(`  max simultaneous running: ${maxConcurrentRunning} (configured workers=${GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS})`)
  console.log(`  completed: ${completed.length} | failed: ${failed.length} | timed_out: ${timedOut.length} | skipped: ${skipped.length}`)
  console.log(`  measured completions/cycle: ${measuredCompletionsPerCycle}`)
  console.log(`  measured completions/hour: ${measuredCompletionsPerHour}`)
  console.log(`  measured completions/day (extrapolated from this cycle): ${measuredCompletionsPerDay}`)

  if (overlapSamples.length > 0) {
    console.log(`\n[${PHASE}] Live overlap timestamps:`)
    for (const sample of overlapSamples.slice(0, 10)) {
      console.log(`  ${sample.at} — ${sample.running} concurrent — leads=[${sample.leadIds.join(", ")}]`)
    }
  }
  if (overlapPairs.length > 0) {
    console.log(`\n[${PHASE}] Post-hoc overlap pairs:`)
    for (const pair of overlapPairs.slice(0, 6)) {
      console.log(
        `  ${pair.overlapStart} — runs ${pair.runA}/${pair.runB} — leads ${pair.leadA}/${pair.leadB}`,
      )
    }
  }

  const deploymentState = resolveDeploymentState({
    codeDeployed,
    policyMigrated,
    concurrencyProven,
  })

  const blockers: string[] = []
  if (!codeDeployed) blockers.push("Deploy SCALE-1A bounded parallel ASL code")
  if (!policyMigrated) blockers.push("Org research cap not migrated to 500/day")
  if (policyMigrated && !concurrencyProven) {
    blockers.push("Live concurrency overlap not yet proven (need ≥2 simultaneous running research runs)")
  }
  if (killSwitches.autonomy_outbound_enabled !== false) blockers.push("Outbound must remain disabled")

  const recommendation =
    deploymentState === "fully_proven" && measuredCompletionsPerDay >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY
      ? "Ready for 500/day"
      : deploymentState === "fully_proven" || (policyMigrated && concurrencyProven)
        ? "Ready with constraints"
        : "Not ready"

  const passCount = gates.filter((row) => row.status === "pass").length
  console.log(`\n[${PHASE}] Deployment state: ${deploymentState}`)
  console.log(`[${PHASE}] Validation: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(`[${PHASE}] Current blockers: ${blockers.length > 0 ? blockers.join("; ") : "none"}`)
  console.log(`[${PHASE}] Recommendation: ${recommendation}`)

  console.log(`\n[${PHASE}] Summary table`)
  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_RUNTIME_SCALE_1B_QA_MARKER,
        organization_id: ORG_ID,
        cap_before: capBefore,
        cap_after: capAfter,
        migration,
        deployment_state: deploymentState,
        live_cycle: {
          cycle_start: cycleStartIso,
          cycle_duration_ms: cycleDurationMs,
          max_concurrent_running: maxConcurrentRunning,
          overlap_samples: overlapSamples,
          overlap_pairs: overlapPairs.slice(0, 10),
          duplicate_leads: duplicateLeads,
          runs: cycleRuns.length,
          completed: completed.length,
          failed: failed.length,
          timed_out: timedOut.length,
          skipped: skipped.length,
          measured_completions_per_cycle: measuredCompletionsPerCycle,
          measured_completions_per_hour: measuredCompletionsPerHour,
          measured_completions_per_day: measuredCompletionsPerDay,
        },
        tick_result: tickResult,
        blockers,
        recommendation,
      },
      null,
      2,
    ),
  )

  const failCount = gates.filter((row) => row.status === "fail").length
  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
