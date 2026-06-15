/** Human-gated prospect discovery execution runner — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { deriveExecutionPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import {
  createProspectExecutionBudgetContext,
  evaluateProspectExecutionBudgetGuard,
} from "@/lib/growth/prospect-discovery/prospect-execution-budget-guards"
import { buildProspectExecutionProgress } from "@/lib/growth/prospect-discovery/prospect-execution-progress"
import {
  clearProspectExecutionRunControl,
  createProspectExecutionRun,
  finalizeProspectExecutionRunStatus,
  isProspectExecutionRunCancelled,
  isProspectExecutionRunPaused,
  loadProspectExecutionRunById,
  persistProspectExecutionRun,
  setProspectExecutionRunCancelled,
  setProspectExecutionRunPaused,
} from "@/lib/growth/prospect-discovery/prospect-execution-results"
import {
  PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
  PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
  type ProspectExecutionRun,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import {
  executeProspectDiscoveryStage,
  type ProspectStageExecutionContext,
} from "@/lib/growth/prospect-discovery/prospect-stage-executor"
import { loadProspectExecutionPlanApproval } from "@/lib/growth/prospect-discovery/prospect-execution-certification"

export { PROSPECT_DISCOVERY_EXECUTION_CONFIRM }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitWhilePaused(execution_run_id: string): Promise<boolean> {
  while (isProspectExecutionRunPaused(execution_run_id)) {
    if (isProspectExecutionRunCancelled(execution_run_id)) return false
    await sleep(400)
  }
  return !isProspectExecutionRunCancelled(execution_run_id)
}

export async function runProspectDiscoveryExecution(
  admin: SupabaseClient,
  input: {
    search_plan: ProspectSearchPlan
    execution_plan: ProspectExecutionPlan
    search_plan_id: string
    operator_id?: string | null
    confirm?: string | null
    certification_mode?: boolean
  },
): Promise<{
  ok: boolean
  run?: ProspectExecutionRun
  progress?: ReturnType<typeof buildProspectExecutionProgress>
  error?: string
  blockers?: string[]
}> {
  if (input.confirm !== PROSPECT_DISCOVERY_EXECUTION_CONFIRM) {
    return { ok: false, error: "confirm_token_required", blockers: ["confirm_token_mismatch"] }
  }

  const approval = await loadProspectExecutionPlanApproval(admin, input.search_plan_id)
  if (!approval) {
    return { ok: false, error: "approval_required", blockers: ["execution_plan_not_approved"] }
  }

  const expectedPlanId = deriveExecutionPlanId(input.search_plan_id)
  if (approval.execution_plan_id !== expectedPlanId) {
    return { ok: false, error: "execution_plan_mismatch", blockers: ["execution_plan_id_mismatch"] }
  }

  const created = await createProspectExecutionRun(admin, {
    execution_plan: input.execution_plan,
    search_plan_id: input.search_plan_id,
    operator_id: input.operator_id ?? null,
  })
  if (!created.ok || !created.run || !created.audit_event_id) {
    return { ok: false, error: created.error ?? "run_create_failed" }
  }

  let run = {
    ...created.run,
    execution_plan_id: expectedPlanId,
    status: "running" as const,
    execution_started_at: new Date().toISOString(),
  }

  const budget = createProspectExecutionBudgetContext(input.execution_plan, {
    certification_mode: input.certification_mode,
  })

  let context: ProspectStageExecutionContext = {
    companies: [],
    qualified_companies: [],
    discovery_run_id: null,
    budget,
    signal_feed_routed_count: 0,
    warnings: [],
  }

  await persistProspectExecutionRun(admin, {
    audit_event_id: created.audit_event_id,
    run,
  })

  try {
    for (const stage of input.execution_plan.execution_stages) {
      const mayContinue = await waitWhilePaused(run.execution_run_id)
      if (!mayContinue) {
        run = finalizeProspectExecutionRunStatus(run, "cancelled")
        run.warnings.push("Execution cancelled by operator.")
        break
      }

      const guard = evaluateProspectExecutionBudgetGuard(context.budget)
      if (guard.action === "abort") {
        run.failures.push(guard.reason ?? "Budget guard aborted execution.")
        run = finalizeProspectExecutionRunStatus(run, "failed")
        break
      }
      if (guard.action === "pause") {
        setProspectExecutionRunPaused(run.execution_run_id, true)
        run = finalizeProspectExecutionRunStatus(run, "paused")
        if (guard.reason) run.warnings.push(guard.reason)
        break
      }

      run.current_stage = stage.stage_id
      const stageIndex = run.stage_states.findIndex((s) => s.stage_id === stage.stage_id)
      if (stageIndex >= 0) {
        run.stage_states[stageIndex] = {
          ...run.stage_states[stageIndex],
          status: "running",
          started_at: new Date().toISOString(),
        }
      }

      await persistProspectExecutionRun(admin, {
        audit_event_id: created.audit_event_id,
        run,
        results_companies: context.companies,
        results_qualified_companies: context.qualified_companies,
      })

      const stageResult = await executeProspectDiscoveryStage(admin, {
        stage_id: stage.stage_id,
        search_plan: input.search_plan,
        execution_plan: input.execution_plan,
        context,
        created_by: input.operator_id ?? null,
        certification_mode: input.certification_mode,
      })

      context = stageResult.context
      run.companies_discovered = context.companies.length
      run.contacts_discovered = context.budget.contacts_discovered
      run.credits_consumed = context.budget.apollo_credits_consumed
      run.discovery_run_id = context.discovery_run_id
      run.company_ids = context.companies.map((c) => c.id)
      run.qualified_company_ids = context.qualified_companies.map((c) => c.id)
      run.signal_feed_routed_count = context.signal_feed_routed_count
      run.warnings = [...new Set([...run.warnings, ...context.warnings])]

      if (stageIndex >= 0) {
        run.stage_states[stageIndex] = {
          ...run.stage_states[stageIndex],
          status: stageResult.skipped ? "skipped" : "completed",
          completed_at: new Date().toISOString(),
          companies_delta: stageResult.companies_delta,
          contacts_delta: stageResult.contacts_delta,
          credits_delta: stageResult.credits_delta,
          message: stageResult.message,
        }
      }

      if (!run.completed_stages.includes(stage.stage_id)) {
        run.completed_stages.push(stage.stage_id)
      }

      await persistProspectExecutionRun(admin, {
        audit_event_id: created.audit_event_id,
        run,
        results_companies: context.companies,
        results_qualified_companies: context.qualified_companies,
      })
    }

    if (run.status === "running") {
      run = finalizeProspectExecutionRunStatus(run, "completed")
      run.current_stage = null
    }
  } catch (error) {
    run.failures.push(error instanceof Error ? error.message : String(error))
    run = finalizeProspectExecutionRunStatus(run, "failed")
  } finally {
    await persistProspectExecutionRun(admin, {
      audit_event_id: created.audit_event_id,
      run,
      results_companies: context.companies,
      results_qualified_companies: context.qualified_companies,
    })
    clearProspectExecutionRunControl(run.execution_run_id)
  }

  return {
    ok: run.status === "completed" || run.status === "paused",
    run,
    progress: buildProspectExecutionProgress(run, input.execution_plan),
  }
}

export async function pauseProspectDiscoveryExecution(
  admin: SupabaseClient,
  execution_run_id: string,
): Promise<{ ok: boolean; run?: ProspectExecutionRun; error?: string }> {
  setProspectExecutionRunPaused(execution_run_id, true)
  const loaded = await loadProspectExecutionRunById(admin, execution_run_id)
  if (!loaded.run || !loaded.audit_event_id) return { ok: false, error: "not_found" }

  const run = finalizeProspectExecutionRunStatus(
    { ...loaded.run, warnings: [...loaded.run.warnings, "Execution paused by operator."] },
    "paused",
  )
  await persistProspectExecutionRun(admin, {
    audit_event_id: loaded.audit_event_id,
    run,
    results_companies: loaded.results?.companies,
    results_qualified_companies: loaded.results?.qualified_companies,
  })
  return { ok: true, run }
}

export async function resumeProspectDiscoveryExecution(
  admin: SupabaseClient,
  execution_run_id: string,
): Promise<{ ok: boolean; error?: string }> {
  setProspectExecutionRunPaused(execution_run_id, false)
  return { ok: true }
}

export async function cancelProspectDiscoveryExecution(
  admin: SupabaseClient,
  execution_run_id: string,
): Promise<{ ok: boolean; run?: ProspectExecutionRun; error?: string }> {
  setProspectExecutionRunCancelled(execution_run_id)
  const loaded = await loadProspectExecutionRunById(admin, execution_run_id)
  if (!loaded.run || !loaded.audit_event_id) return { ok: false, error: "not_found" }

  const run = finalizeProspectExecutionRunStatus(
    { ...loaded.run, warnings: [...loaded.run.warnings, "Execution cancelled by operator."] },
    "cancelled",
  )
  await persistProspectExecutionRun(admin, {
    audit_event_id: loaded.audit_event_id,
    run,
    results_companies: loaded.results?.companies,
    results_qualified_companies: loaded.results?.qualified_companies,
  })
  clearProspectExecutionRunControl(execution_run_id)
  return { ok: true, run }
}

export async function getProspectDiscoveryExecutionStatus(
  admin: SupabaseClient,
  execution_run_id: string,
  execution_plan?: ProspectExecutionPlan | null,
) {
  const loaded = await loadProspectExecutionRunById(admin, execution_run_id)
  if (!loaded.run) return { ok: false, error: "not_found" as const }
  return {
    ok: true,
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    run: loaded.run,
    progress: buildProspectExecutionProgress(loaded.run, execution_plan ?? null),
    results: loaded.results,
    enrollment_enabled: false,
    outreach_enabled: false,
  }
}
