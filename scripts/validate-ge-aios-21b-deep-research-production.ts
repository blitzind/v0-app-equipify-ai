/**
 * GE-AIOS-21B — Deep Research Production Validation (read-only by default).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-21b-deep-research-production.ts
 *
 * Optional live research on up to 3 candidate leads (writes to production):
 *   CONFIRM_GE_AIOS_21B_LIVE_RESEARCH=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-21b-deep-research-production.ts
 */
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"

export const GE_AIOS_21B_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-21b-deep-research-production-validation-v1" as const

const PHASE = "GE-AIOS-21B" as const
const STALE_MS = 30 * 24 * 60 * 60 * 1000

type CheckResult = {
  id: string
  status: "pass" | "fail" | "warn" | "skip"
  detail: string
}

type LeadCandidate = {
  id: string
  company_name: string
  website: string | null
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
  status: string
}

const checks: CheckResult[] = []

function record(id: string, status: CheckResult["status"], detail: string): void {
  checks.push({ id, status, detail })
  const prefix = status === "pass" ? "✓" : status === "warn" ? "!" : status === "skip" ? "-" : "✗"
  console.log(`  ${prefix} ${id}: ${detail}`)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function findResearchCandidateLeads(admin: SupabaseClient, limit = 10): Promise<LeadCandidate[]> {
  const staleCutoff = new Date(Date.now() - STALE_MS).toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, latest_prospect_research_run_id, last_prospect_researched_at, status",
    )
    .not("website", "is", null)
    .neq("website", "")
    .not("status", "in", '("disqualified","archived","converted")')
    .or(
      `latest_prospect_research_run_id.is.null,last_prospect_researched_at.is.null,last_prospect_researched_at.lt.${staleCutoff}`,
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as LeadCandidate[]
}

async function fetchResearchRunSummary(admin: SupabaseClient, runId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, research_summary, completed_at, website_url, industry_guess")
    .eq("id", runId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function verifyKillSwitchesAndOutboundSafety(admin: SupabaseClient): Promise<void> {
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  record(
    "outbound-autonomy_off",
    killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  )
  record(
    "autonomy_default_off",
    GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES.autonomy_enabled === false ? "pass" : "fail",
    `code default autonomy_enabled=${GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES.autonomy_enabled}`,
  )

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("status", "sent")

  if (error) {
    record("recent_unapproved_sends", "skip", `sequence_execution_jobs probe: ${error.message}`)
  } else {
    record(
      "recent_sequence_sends_24h",
      "pass",
      `sent jobs in last 24h: ${count ?? 0} (research validation does not send)`,
    )
  }
}

async function verifyHomeAndOperations(admin: SupabaseClient): Promise<void> {
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: process.env.GE_AIOS_21B_OPERATOR_EMAIL?.trim() || "operator@equipify.ai",
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })

  const researchedCount = summary.salesOutcomes?.dailySummary.researched ?? 0
  const qualifiedCount = summary.salesOutcomes?.dailySummary.qualified ?? 0

  record(
    "home-sales-outcomes-present",
    summary.salesOutcomes != null ? "pass" : "fail",
    `researched=${researchedCount} qualified=${qualifiedCount}`,
  )
  record(
    "home-research-loop-summary",
    summary.avaConsole?.researchLoopSummary ? "pass" : "warn",
    summary.avaConsole?.researchLoopSummary
      ? `loop completed=${summary.avaConsole.researchLoopSummary.researchCompleted}`
      : "no Ava research loop summary — operator may not have run queue recently",
  )
  record(
    "home-single-fetch-path",
    summary.briefing === null ? "pass" : "warn",
    "workspace-summary remains canonical Home fetch",
  )
}

async function runLiveLeadValidation(
  admin: SupabaseClient,
  organizationId: string,
  candidates: LeadCandidate[],
): Promise<void> {
  const live = process.env.CONFIRM_GE_AIOS_21B_LIVE_RESEARCH === "1"
  if (!live) {
    record("live-research-execution", "skip", "Set CONFIRM_GE_AIOS_21B_LIVE_RESEARCH=1 to execute on production leads")
    return
  }

  const picks = candidates.slice(0, 3)
  if (picks.length === 0) {
    record("live-research-execution", "fail", "No candidate leads with websites and missing/stale research")
    return
  }

  for (const [index, pick] of picks.entries()) {
    const label = `lead-${index + 1}-${pick.id.slice(0, 8)}`
    const beforeRunId = pick.latest_prospect_research_run_id
    const beforeResearchedAt = pick.last_prospect_researched_at

    const first = await executeGrowthLeadProspectResearch({
      admin,
      organizationId,
      leadId: pick.id,
      trigger: "manual",
      force: true,
      runQualification: false,
    })

    record(
      `${label}-first-execution`,
      first.ok ? "pass" : "fail",
      first.ok
        ? `outcome=${first.outcome} run=${first.run.id} status=${first.run.status}`
        : `${first.code}: ${first.message}`,
    )

    if (first.ok) {
      record(
        `${label}-run-completed`,
        first.run.status === "completed" ? "pass" : "warn",
        `run status=${first.run.status}`,
      )
      record(
        `${label}-uses-prospect-research`,
        first.run.researchSummary?.trim() || first.run.industryGuess ? "pass" : "warn",
        `summary=${Boolean(first.run.researchSummary?.trim())} industry=${first.run.industryGuess ?? "—"}`,
      )

      const runRow = await fetchResearchRunSummary(admin, first.run.id)
      record(
        `${label}-research_runs-row`,
        runRow ? "pass" : "fail",
        runRow ? `growth.research_runs ${runRow.id} status=${runRow.status}` : "missing row",
      )

      const refreshed = await fetchGrowthLeadById(admin, pick.id)
      record(
        `${label}-lead-pointers`,
        refreshed?.latestProspectResearchRunId ? "pass" : "fail",
        `before=${beforeRunId ?? "null"} after=${refreshed?.latestProspectResearchRunId ?? "null"} researched_at=${refreshed?.lastProspectResearchedAt ?? "null"} (was ${beforeResearchedAt ?? "null"})`,
      )

      const duplicate = await executeGrowthLeadProspectResearch({
        admin,
        organizationId,
        leadId: pick.id,
        trigger: "drawer_opportunistic",
        force: false,
        runQualification: false,
      })

      record(
        `${label}-duplicate-protection`,
        duplicate.ok && (duplicate.outcome === "cached" || duplicate.outcome === "active")
          ? "pass"
          : duplicate.ok === false && duplicate.code === "research_fresh"
            ? "pass"
            : "warn",
        duplicate.ok
          ? `second call outcome=${duplicate.outcome} run=${duplicate.run.id}`
          : `${duplicate.code}: ${duplicate.message}`,
      )

      const active = await fetchActiveProspectResearchRun(admin, pick.id)
      record(
        `${label}-no-duplicate-active`,
        active ? "warn" : "pass",
        active ? `active run ${active.id} status=${active.status}` : "no concurrent queued/running run",
      )
    }
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Deep Research Production Validation`)
  console.log(`  QA marker: ${GE_AIOS_21B_PRODUCTION_VALIDATION_QA_MARKER}`)

  const executeAgent = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  record(
    "code-unified-path",
    executeAgent.includes("executeGrowthLeadProspectResearch") &&
      !executeAgent.includes("runAutonomousResearchManualRefresh")
      ? "pass"
      : "fail",
    "sales loop uses executeGrowthLeadProspectResearch, not 5B-only refresh",
  )

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!bootstrap) {
    record("production-env", "fail", "Could not bootstrap production Supabase env")
    process.exit(1)
  }
  record(
    "production-env",
    bootstrap.vercel_production_env_run ? "pass" : "warn",
    `env_source=${bootstrap.env_source} vercel_run=${bootstrap.vercel_production_env_run}`,
  )

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    record("growth-engine-org", "fail", "GROWTH_ENGINE_AI_ORG_ID missing")
    process.exit(1)
  }
  record("growth-engine-org", "pass", organizationId)

  await verifyKillSwitchesAndOutboundSafety(admin)

  const candidates = await findResearchCandidateLeads(admin, 10)
  record(
    "candidate-leads",
    candidates.length >= 3 ? "pass" : candidates.length > 0 ? "warn" : "fail",
    `found ${candidates.length} leads with website + missing/stale prospect research`,
  )

  for (const [index, lead] of candidates.slice(0, 3).entries()) {
    record(
      `candidate-${index + 1}`,
      shouldAutoQueueLeadResearch({
        website: lead.website,
        status: lead.status as "new",
        lastProspectResearchedAt: lead.last_prospect_researched_at,
        latestProspectResearchRunId: lead.latest_prospect_research_run_id,
        lastResearchedAt: null,
        latestResearchRunId: null,
      })
        ? "pass"
        : "warn",
      `${lead.company_name} | ${lead.website} | prospect_run=${lead.latest_prospect_research_run_id ?? "null"}`,
    )
  }

  await runLiveLeadValidation(admin, organizationId, candidates)
  await verifyHomeAndOperations(admin)

  const failed = checks.filter((row) => row.status === "fail")
  const warned = checks.filter((row) => row.status === "warn")

  console.log("")
  console.log(
    `[${PHASE}] Summary: ${checks.filter((c) => c.status === "pass").length} pass, ${warned.length} warn, ${failed.length} fail`,
  )

  if (failed.length > 0) {
    console.log(`[${PHASE}] FAIL — production validation blocked`)
    process.exit(1)
  }
  console.log(`[${PHASE}] PASS — Deep Research production validation complete`)
}

main().catch((error) => {
  console.error(`[${PHASE}] ERROR`, error instanceof Error ? error.message : error)
  process.exit(1)
})
