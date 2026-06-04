/** Client-safe revenue context readers for inbox workspace (Phase 3). */

import {
  GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY,
  GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY,
  type GrowthRevenuePlaybookKey,
  type GrowthSalesExecutionPlan,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import { resolveRevenuePlaybook, listRevenuePlaybooks, type RevenuePlaybookResolutionInput } from "@/lib/growth/revenue-execution/revenue-playbooks"
import { readRevenueReadinessFromLeadMetadata } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import type { GrowthLeadMemoryProfileView } from "@/lib/growth/lead-memory/memory-types"
import { projectLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-projection"

export function readExecutionPlanFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthSalesExecutionPlan | null {
  const raw = metadata?.[GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const plan = raw as Partial<GrowthSalesExecutionPlan>
  if (!plan.leadId || !Array.isArray(plan.steps)) return null
  return plan as GrowthSalesExecutionPlan
}

export function readStoredPlaybookKeyFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthRevenuePlaybookKey | null {
  const raw = metadata?.[GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const key = (raw as { key?: string }).key
  if (!key) return null
  return key as GrowthRevenuePlaybookKey
}

export function resolveInboxRevenuePlaybook(input: {
  lead: GrowthLead | null
  thread: GrowthInboxThread | null
  memoryProfile: GrowthLeadMemoryProfileView | null
  signalTypes?: string[]
  recommendationTypes?: string[]
}) {
  const influence = projectLeadMemoryInfluenceContext(input.memoryProfile)
  const storedKey = readStoredPlaybookKeyFromLeadMetadata(input.lead?.metadata)
  const resolutionInput: RevenuePlaybookResolutionInput = {
    signalTypes: input.signalTypes ?? [],
    recommendationTypes: input.recommendationTypes ?? [],
    classification: input.thread?.classification ?? null,
    unresolvedObjectionCount: influence.unresolvedObjectionCount,
    commitmentCount: influence.commitmentSummaries.length,
    engagementTrend: influence.engagementTrend,
    relationshipStage: influence.relationshipStage,
    hasCompetitiveSignal: input.thread?.classification === "competitor",
    isExistingCustomer: influence.relationshipStage === "customer",
  }
  const resolved = resolveRevenuePlaybook(resolutionInput)
  if (storedKey) {
    const stored = listRevenuePlaybooks().find((playbook) => playbook.key === storedKey)
    if (stored) return stored
  }
  return resolved
}

export function readRevenueReadinessForLead(lead: GrowthLead | null) {
  if (!lead) return null
  return readRevenueReadinessFromLeadMetadata(lead.metadata)
}

export function executionPlanProgress(plan: GrowthSalesExecutionPlan | null): {
  completed: number
  total: number
  nextStep: string | null
} {
  if (!plan) return { completed: 0, total: 0, nextStep: null }
  const completed = plan.steps.filter((step) => step.completed).length
  const next = plan.steps.find((step) => !step.completed)
  return {
    completed,
    total: plan.steps.length,
    nextStep: next ? next.title : null,
  }
}
