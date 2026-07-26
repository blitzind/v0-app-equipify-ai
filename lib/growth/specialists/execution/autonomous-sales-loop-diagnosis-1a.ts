/** AVA-AUTONOMOUS-EXECUTION-RECOVERY-1A — Executable-work gate diagnosis (client-safe). */

import type { SupabaseClient } from "@supabase/supabase-js"
import { runDecisionEngine } from "@/lib/growth/decision-engine/engine/run-decision-engine"
import { evaluateGrowthCanonicalStateConsistencyForLead } from "@/lib/growth/revenue-workflow/growth-canonical-state-consistency-1a"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { buildPortfolioEligibilityContext } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { nextBestActionsToWorkItems } from "@/lib/growth/work-manager/bridges/decision-engine-bridge"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import type {
  AutonomousSalesLoopNonExecutionReason,
  AutonomousSalesLoopStopReason,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_AUTONOMOUS_SALES_LOOP_DIAGNOSIS_1A_QA_MARKER =
  "ava-autonomous-execution-recovery-1a-diagnosis-v1" as const

export type AutonomousSalesLoopWorkItemGate = {
  work_item_id: string
  title: string
  type: string
  can_execute_autonomously: boolean
  requires_operator: boolean
  blocked_by: string[]
  status: string
  lead_id: string | null
  delegation: { delegated: boolean; reason?: string; workflow_agent?: string }
  gate_reason: string
}

export type AutonomousSalesLoopDiagnosis = {
  qa_marker: typeof GROWTH_AUTONOMOUS_SALES_LOOP_DIAGNOSIS_1A_QA_MARKER
  organization_id: string
  generated_at: string
  portfolio_leads_total: number
  portfolio_leads_eligible: number
  decision_candidates: number
  next_best_actions: number
  work_items_total: number
  executable_work_items: number
  operator_work_items: number
  blocked_work_items: number
  selected_executable: AutonomousSalesLoopWorkItemGate | null
  non_execution_reason: AutonomousSalesLoopNonExecutionReason
  stop_reason: AutonomousSalesLoopStopReason
  work_item_gates: AutonomousSalesLoopWorkItemGate[]
  top_blocked_reasons: Record<string, number>
}

function resolveWorkItemGateReason(item: AvaWorkItem): string {
  if (item.requires_operator || item.type === "approval" || item.type === "reply") {
    return "requires_operator"
  }
  if (item.blocked_by.length > 0) {
    return `blocked:${item.blocked_by.join(",")}`
  }
  if (item.type === "wait") return "wait"
  if (item.type === "research" && !extractLeadIdFromWorkItem(item)) {
    return "missing_lead_target"
  }
  if (item.type === "mission" && !item.decision_source_id?.startsWith("discovery:")) {
    return "non_discovery_mission_without_lead"
  }
  if (!item.can_execute_autonomously) return "not_autonomous"
  if (item.status === "blocked") return "status_blocked"
  if (item.status === "waiting_for_operator") return "status_waiting_for_operator"
  return "executable"
}

function buildWorkItemGate(item: AvaWorkItem): AutonomousSalesLoopWorkItemGate {
  const delegation = delegateWorkItem(item)
  return {
    work_item_id: item.id,
    title: item.title,
    type: item.type,
    can_execute_autonomously: item.can_execute_autonomously,
    requires_operator: item.requires_operator,
    blocked_by: item.blocked_by,
    status: item.status,
    lead_id: extractLeadIdFromWorkItem(item),
    delegation: delegation.delegated
      ? {
          delegated: true,
          workflow_agent: delegation.workflow_agent,
        }
      : { delegated: false, reason: delegation.reason },
    gate_reason: resolveWorkItemGateReason(item),
  }
}

export function inferAutonomousSalesLoopNonExecutionReason(input: {
  portfolioLeadsTotal: number
  portfolioLeadsEligible: number
  workItems: AvaWorkItem[]
  selectedExecutable: AvaWorkItem | null
  stopInvestmentLeadCount?: number
  waitingForResearchCount?: number
  waitingForContactCount?: number
  waitingForApprovalCount?: number
  staleStateLeadCount?: number
}): AutonomousSalesLoopNonExecutionReason {
  const gates = input.workItems.map((item) => resolveWorkItemGateReason(item))
  const executableCount = input.workItems.filter((item) => isExecutableWorkItem(item)).length

  if (input.portfolioLeadsTotal === 0) return "no_candidates"
  if (input.portfolioLeadsEligible === 0) return "no_qualified_candidates"
  if ((input.stopInvestmentLeadCount ?? 0) >= input.portfolioLeadsEligible && executableCount === 0) {
    return "stop_investment"
  }
  if ((input.waitingForApprovalCount ?? 0) > 0 && executableCount === 0 && gates.every((g) => g === "requires_operator")) {
    return "waiting_for_approval"
  }
  if ((input.waitingForResearchCount ?? 0) > 0 && executableCount === 0) {
    return "waiting_for_research"
  }
  if ((input.waitingForContactCount ?? 0) > 0 && executableCount === 0) {
    return "waiting_for_contact"
  }
  if ((input.staleStateLeadCount ?? 0) > 0 && executableCount === 0) {
    return "stale_state"
  }
  if (!input.selectedExecutable && gates.some((g) => g.startsWith("blocked:"))) {
    return "capacity_limited"
  }
  if (!input.selectedExecutable && gates.some((g) => g === "non_discovery_mission_without_lead")) {
    return "generation_deferred"
  }
  if (!input.selectedExecutable) return "no_executable_work"
  return "no_executable_work"
}

export function diagnoseAutonomousSalesLoopWorkManager(input: {
  organizationId: string
  generatedAt: string
  workManagerInput: import("@/lib/growth/work-manager/manager/run-work-manager").RunWorkManagerInput
  portfolioLeads: GrowthLead[]
  salesOutcomes?: import("@/lib/growth/specialists/execution/sales-outcome-types").SalesOutcome[]
  organizationalKnowledge?: import("@/lib/growth/memory/knowledge/organization-knowledge-types").OrganizationalKnowledgeItem[]
  persistedMemoryStore?: import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore
  draftFactorySignals?: {
    stopInvestmentLeadCount?: number
    waitingForResearchCount?: number
    waitingForContactCount?: number
    waitingForApprovalCount?: number
    staleStateLeadCount?: number
  }
}): AutonomousSalesLoopDiagnosis {
  const portfolioEligibility = buildPortfolioEligibilityContext(input.organizationId, input.portfolioLeads)
  const memorySummary = runMemoryEngine({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    workspaceSummary: input.workManagerInput.workspaceSummary,
    waitingOnYou: input.workManagerInput.waitingOnYou,
    dailyWorkQueue: input.workManagerInput.dailyWorkQueue,
    accomplishments: input.workManagerInput.accomplishments,
    timeline: input.workManagerInput.timeline,
    persistedStore: input.persistedMemoryStore ?? {
      organizationId: input.organizationId,
      capturedAt: input.generatedAt,
      events: [],
      preferences: [],
    },
    salesOutcomes: input.salesOutcomes ?? [],
    organizationalKnowledge: input.organizationalKnowledge ?? [],
  }).summary

  const decisionResult = runDecisionEngine({
    ...input.workManagerInput,
    memorySummary,
    portfolioEligibility,
    portfolioLeads: input.portfolioLeads,
  })

  const workItems = nextBestActionsToWorkItems(decisionResult.next_best_actions, input.generatedAt)
  const workResult = runWorkManager({
    ...input.workManagerInput,
    memorySummary,
    organizationId: input.organizationId,
    portfolioLeads: input.portfolioLeads,
  })

  const selected = selectNextExecutableWorkItem(workResult)
  const allItems = workResult.all_work_items
  const workItemGates = allItems.slice(0, 12).map(buildWorkItemGate)
  const topBlockedReasons: Record<string, number> = {}
  for (const gate of workItemGates) {
    topBlockedReasons[gate.gate_reason] = (topBlockedReasons[gate.gate_reason] ?? 0) + 1
  }

  const nonExecutionReason = inferAutonomousSalesLoopNonExecutionReason({
    portfolioLeadsTotal: input.portfolioLeads.length,
    portfolioLeadsEligible: portfolioEligibility.eligibleCount,
    workItems: allItems,
    selectedExecutable: selected,
    ...input.draftFactorySignals,
  })

  const stopReason: AutonomousSalesLoopStopReason = selected
    ? "no_executable_work"
    : nonExecutionReason

  return {
    qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_DIAGNOSIS_1A_QA_MARKER,
    organization_id: input.organizationId,
    generated_at: input.generatedAt,
    portfolio_leads_total: input.portfolioLeads.length,
    portfolio_leads_eligible: portfolioEligibility.eligibleCount,
    decision_candidates: decisionResult.next_best_actions.length,
    next_best_actions: decisionResult.next_best_actions.length,
    work_items_total: allItems.length,
    executable_work_items: allItems.filter((item) => isExecutableWorkItem(item)).length,
    operator_work_items: allItems.filter((item) => item.requires_operator).length,
    blocked_work_items: allItems.filter((item) => item.blocked_by.length > 0).length,
    selected_executable: selected ? buildWorkItemGate(selected) : null,
    non_execution_reason: nonExecutionReason,
    stop_reason: selected ? stopReason : (nonExecutionReason as AutonomousSalesLoopStopReason),
    work_item_gates: workItemGates,
    top_blocked_reasons: topBlockedReasons,
  }
}

export type StopInvestmentPauseCategory =
  | "A_legitimate_non_fit"
  | "B_insufficient_evidence"
  | "C_missing_contact_dm"
  | "D_duplicate"
  | "E_capacity_backpressure"
  | "F_stale_pipeline_state"
  | "G_budget_resource_threshold"
  | "H_other"

export function classifyStopInvestmentPause(input: {
  lead: GrowthLead
  organizationId: string
  draftFactoryState?: string | null
  pausedReason?: string | null
  lastErrorCode?: string | null
}): StopInvestmentPauseCategory {
  const inconsistencies = evaluateGrowthCanonicalStateConsistencyForLead({
    lead: input.lead,
    organizationId: input.organizationId,
  })
  if (inconsistencies.some((row) => row.kind === "admission_accepted_stop_investment_from_status")) {
    return "F_stale_pipeline_state"
  }
  if (inconsistencies.some((row) => row.kind === "admission_accepted_status_disqualified")) {
    return "F_stale_pipeline_state"
  }

  const admission = input.lead.metadata?.admission_state
  const status = (input.lead.status ?? "").toLowerCase()
  if (status === "duplicate" || status === "disqualified") return "A_legitimate_non_fit"
  if (admission === "rejected" || admission === "invalid") return "A_legitimate_non_fit"

  const eligibility = evaluateGrowthPortfolioLeadEligibility({
    lead: input.lead,
    organizationId: input.organizationId,
  })
  if (eligibility.reasonCode === "hard_terminal_duplicate") return "D_duplicate"

  const error = String(input.lastErrorCode ?? input.pausedReason ?? "")
  if (/contact|decision.?maker|dm|email|phone|recipient/i.test(error)) return "C_missing_contact_dm"
  if (/evidence|research|qualification|fit|icp/i.test(error)) return "B_insufficient_evidence"
  if (/capacity|deferred|backpressure|budget|quota|slot/i.test(error)) return "E_capacity_backpressure"
  if (/budget|resource|spend|investment/i.test(error)) return "G_budget_resource_threshold"

  return "H_other"
}

export async function loadDraftFactorySignalCounts(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  stopInvestmentLeadCount: number
  waitingForResearchCount: number
  waitingForContactCount: number
  waitingForApprovalCount: number
  waitingForGenerationCount: number
  staleStateLeadCount: number
}> {
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason, last_error_code")
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)

  let stopInvestmentLeadCount = 0
  let waitingForResearchCount = 0
  let waitingForContactCount = 0
  let waitingForApprovalCount = 0
  let waitingForGenerationCount = 0

  for (const row of data ?? []) {
    const state = String(row.state ?? "")
    if (state === "paused" && row.paused_reason === "stop_investment") stopInvestmentLeadCount += 1
    if (state === "waiting_for_research") waitingForResearchCount += 1
    if (state === "waiting_for_decision_maker" || state === "waiting_for_contact") waitingForContactCount += 1
    if (state === "waiting_for_approval") waitingForApprovalCount += 1
    if (state === "waiting_for_generation") waitingForGenerationCount += 1
  }

  return {
    stopInvestmentLeadCount,
    waitingForResearchCount,
    waitingForContactCount,
    waitingForApprovalCount,
    waitingForGenerationCount,
    staleStateLeadCount: 0,
  }
}
