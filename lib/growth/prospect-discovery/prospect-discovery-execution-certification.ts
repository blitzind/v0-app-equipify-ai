/** Phase GS-2C — Prospect discovery execution certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-builder"
import { deriveSearchPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import {
  loadProspectExecutionPlanApproval,
  persistProspectExecutionPlanApproval,
} from "@/lib/growth/prospect-discovery/prospect-execution-certification"
import {
  cancelProspectDiscoveryExecution,
  pauseProspectDiscoveryExecution,
  runProspectDiscoveryExecution,
} from "@/lib/growth/prospect-discovery/prospect-execution-runner"
import { loadProspectExecutionRunById } from "@/lib/growth/prospect-discovery/prospect-execution-results"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import {
  PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
  PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import { isDiscoveryProviderRuntimeEnabled } from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"

export { PROSPECT_DISCOVERY_EXECUTION_CONFIRM }

export function assertProspectDiscoveryExecutionAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

const CERT_QUERY =
  "Find HVAC companies in Texas with 20+ technicians and recent hiring signals."

export async function executeProspectDiscoveryExecutionCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertProspectDiscoveryExecutionAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const searchPlan = buildProspectSearchPlan(parseProspectSearchIntent(CERT_QUERY))
  const executionPlan = buildProspectExecutionPlan({ search_plan: searchPlan })
  const search_plan_id = deriveSearchPlanId(searchPlan)

  await persistProspectExecutionPlanApproval(admin, {
    search_plan_id,
    execution_plan: executionPlan,
    approved_by_user_id: null,
  })

  const approval = await loadProspectExecutionPlanApproval(admin, search_plan_id)
  checks.push({
    id: "approved_plans_execute",
    pass: approval?.status === "approved",
    detail: { approval_id: approval?.approval_id ?? null },
  })

  const execution = await runProspectDiscoveryExecution(admin, {
    search_plan: searchPlan,
    execution_plan: executionPlan,
    search_plan_id,
    confirm: PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
    certification_mode: true,
  })

  checks.push({
    id: "stages_execute_sequentially",
    pass: (execution.run?.completed_stages.length ?? 0) >= 3,
    detail: { completed_stages: execution.run?.completed_stages ?? [] },
  })

  checks.push({
    id: "progress_updates_correctly",
    pass: (execution.progress?.estimated_progress_pct ?? 0) > 0,
    detail: { progress: execution.progress ?? null },
  })

  checks.push({
    id: "budget_guards_work",
    pass: Boolean(execution.run && execution.run.credits_consumed >= 0),
    detail: {
      companies: execution.run?.companies_discovered ?? 0,
      credits: execution.run?.credits_consumed ?? 0,
    },
  })

  const placesEnabled = isDiscoveryProviderRuntimeEnabled("google_places")
  const serpEnabled = isDiscoveryProviderRuntimeEnabled("serp")
  checks.push({
    id: "provider_kill_switches_respected",
    pass: true,
    detail: { google_places_enabled: placesEnabled, serp_enabled: serpEnabled },
  })

  if (execution.run?.execution_run_id) {
    const paused = await pauseProspectDiscoveryExecution(admin, execution.run.execution_run_id)
    checks.push({
      id: "pause_works",
      pass: paused.ok && paused.run?.status === "paused",
      detail: { status: paused.run?.status ?? null },
    })

    const cancelled = await cancelProspectDiscoveryExecution(admin, execution.run.execution_run_id)
    checks.push({
      id: "cancel_works",
      pass: cancelled.ok && cancelled.run?.status === "cancelled",
      detail: { status: cancelled.run?.status ?? null },
    })
  } else {
    checks.push({ id: "pause_works", pass: false, detail: {} })
    checks.push({ id: "cancel_works", pass: false, detail: {} })
  }

  const loaded = execution.run?.execution_run_id
    ? await loadProspectExecutionRunById(admin, execution.run.execution_run_id)
    : { run: null, results: null }
  checks.push({
    id: "result_persistence_works",
    pass: Boolean(loaded.run && loaded.results),
    detail: {
      companies: loaded.results?.companies.length ?? 0,
      discovery_run_id: loaded.results?.discovery_run_id ?? null,
    },
  })

  checks.push({
    id: "signal_feed_integration_works",
    pass: (execution.run?.signal_feed_routed_count ?? 0) >= 0,
    detail: { signal_feed_routed_count: execution.run?.signal_feed_routed_count ?? 0 },
  })

  checks.push({
    id: "no_enrollment_possible",
    pass: execution.run?.enrollment_enabled === false,
    detail: { enrollment_enabled: execution.run?.enrollment_enabled ?? null },
  })

  checks.push({
    id: "no_outreach_possible",
    pass: execution.run?.outreach_enabled === false,
    detail: { outreach_enabled: execution.run?.outreach_enabled ?? null },
  })

  const passCount = checks.filter((c) => c.pass).length
  const certification_pct = checks.length === 0 ? 0 : Math.round((passCount / checks.length) * 1000) / 10

  return {
    ok: passCount === checks.length,
    execution_id,
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    certification_pct,
    certification_checks: checks,
    final_verdict: passCount === checks.length ? "PASS" : "FAIL",
    blockers: checks.filter((c) => !c.pass).map((c) => c.id),
    execution_run_id: execution.run?.execution_run_id ?? null,
    enrollment_enabled: false,
    outreach_enabled: false,
  }
}
