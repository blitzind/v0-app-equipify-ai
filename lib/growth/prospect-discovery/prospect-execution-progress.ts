/** Execution progress builder (client-safe). */

import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type {
  ProspectExecutionProgress,
  ProspectExecutionRun,
  ProspectExecutionStageState,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import { PROSPECT_DISCOVERY_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import type { ProspectExecutionStageId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"

const STAGE_LABELS: Record<ProspectExecutionStageId, string> = {
  company_discovery: "Company Discovery",
  signal_enrichment: "Signal Enrichment",
  contact_discovery: "Contact Discovery",
  company_intelligence: "Company Intelligence",
  buying_committee_expansion: "Buying Committee Expansion",
  qualification: "Qualification",
}

export function buildInitialStageStates(
  execution_plan: ProspectExecutionPlan,
): ProspectExecutionStageState[] {
  return execution_plan.execution_stages.map((stage) => ({
    stage_id: stage.stage_id,
    status: "pending",
    started_at: null,
    completed_at: null,
    companies_delta: 0,
    contacts_delta: 0,
    credits_delta: 0,
    message: null,
  }))
}

export function computeEstimatedProgressPct(run: ProspectExecutionRun): number {
  const total = run.stage_states.length || 1
  const completed = run.completed_stages.length
  const runningBonus = run.status === "running" && run.current_stage ? 0.5 : 0
  return Math.min(100, Math.round(((completed + runningBonus) / total) * 100))
}

export function buildProspectExecutionProgress(
  run: ProspectExecutionRun,
  execution_plan?: ProspectExecutionPlan | null,
): ProspectExecutionProgress {
  const progressPct = computeEstimatedProgressPct(run)
  const remainingStages = (execution_plan?.execution_stages.length ?? run.stage_states.length) - run.completed_stages.length
  const estimated_seconds_remaining =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled"
      ? 0
      : remainingStages > 0 && execution_plan
        ? Math.max(0, Math.round((remainingStages / execution_plan.execution_stages.length) * execution_plan.estimated_runtime_seconds))
        : null

  return {
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    execution_run_id: run.execution_run_id,
    status: run.status,
    current_stage: run.current_stage,
    current_stage_label: run.current_stage ? STAGE_LABELS[run.current_stage] : null,
    estimated_progress_pct: progressPct,
    companies_discovered: run.companies_discovered,
    contacts_discovered: run.contacts_discovered,
    credits_consumed: run.credits_consumed,
    estimated_seconds_remaining,
    warnings: run.warnings,
    completed_stages: run.completed_stages,
  }
}
