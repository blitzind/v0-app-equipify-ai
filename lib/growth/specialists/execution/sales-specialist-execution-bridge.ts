/** GE-AIOS-17A — Canonical Sales Specialist execution bridge (routing + validation, no execution). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import { routeWorkItem } from "@/lib/growth/specialists/router/route-work-item"
import { getSpecialistById } from "@/lib/growth/specialists/registry/specialist-registry"
import type {
  SalesOutcome,
  SalesSpecialistCompletionResult,
  SalesSpecialistDelegationResult,
  SalesWorkflowAgentKind,
} from "@/lib/growth/specialists/execution/sales-outcome-types"
import { dedupeSalesOutcomes } from "@/lib/growth/specialists/execution/sales-outcome-mappers"
import { attachMemoryEventsToSalesOutcomes } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"

const WORKFLOW_AGENT_BY_WORK_TYPE: Record<string, SalesWorkflowAgentKind> = {
  research: "research_agent",
  qualification: "qualification_agent",
  outreach: "outreach_agent",
  meeting: "meeting_agent",
  approval: "outreach_agent",
  reply: "research_agent",
}

export function resolveWorkflowAgentForWorkItem(item: AvaWorkItem): SalesWorkflowAgentKind {
  const keywordMatch = item.title.toLowerCase()
  if (/meeting|agenda|brief/.test(keywordMatch)) return "meeting_agent"
  if (/outreach|draft|email|approve/.test(keywordMatch)) return "outreach_agent"
  if (/qualif/.test(keywordMatch)) return "qualification_agent"
  return WORKFLOW_AGENT_BY_WORK_TYPE[item.type] ?? "research_agent"
}

export function delegateWorkItem(item: AvaWorkItem): SalesSpecialistDelegationResult {
  const route = routeWorkItem(item)
  const specialist = getSpecialistById(route.specialist_id)
  if (specialist?.definition.stub) {
    return { delegated: false, reason: "stub_specialist", work_item_id: item.id }
  }
  if (route.specialist_id !== "sales") {
    return { delegated: false, reason: "non_sales_work", work_item_id: item.id }
  }
  const workflowAgent = resolveWorkflowAgentForWorkItem(item)
  const supportedTypes = new Set([
    "research",
    "qualification",
    "outreach",
    "meeting",
    "approval",
    "reply",
    "mission",
    "business_understanding",
    "wait",
  ])
  if (!supportedTypes.has(item.type)) {
    return { delegated: false, reason: "unsupported_work_type", work_item_id: item.id }
  }
  return {
    delegated: true,
    specialist_id: "sales",
    workflow_agent: workflowAgent,
    routing_reason: `Sales Specialist delegated to existing ${workflowAgent.replace(/_/g, " ")}.`,
    work_item_id: item.id,
  }
}

export function validateSalesOutcome(outcome: SalesOutcome): { valid: boolean; detail?: string } {
  if (outcome.validated_by !== "sales_specialist") {
    return { valid: false, detail: "Outcome must be validated by Sales Specialist." }
  }
  if (!outcome.summary.trim()) {
    return { valid: false, detail: "Outcome summary is required." }
  }
  if (!Number.isFinite(outcome.confidence) || outcome.confidence < 0 || outcome.confidence > 100) {
    return { valid: false, detail: "Outcome confidence must be between 0 and 100." }
  }
  if (!outcome.completed_at) {
    return { valid: false, detail: "Outcome completed_at is required." }
  }
  return { valid: true }
}

export function completeSpecialistWork(outcome: SalesOutcome): SalesSpecialistCompletionResult {
  const validation = validateSalesOutcome(outcome)
  if (!validation.valid) {
    return { completed: false, reason: "validation_failed", detail: validation.detail }
  }
  const [validated] = attachMemoryEventsToSalesOutcomes({
    organizationId: "local-organization",
    generatedAt: outcome.completed_at,
    outcomes: [outcome],
  })
  if (!validated) {
    return { completed: false, reason: "invalid_outcome" }
  }
  return { completed: true, outcome: validated }
}

export function finalizeSalesSpecialistOutcomes(input: {
  organizationId: string
  generatedAt: string
  outcomes: SalesOutcome[]
}): SalesOutcome[] {
  const deduped = dedupeSalesOutcomes(input.outcomes)
  return attachMemoryEventsToSalesOutcomes({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    outcomes: deduped,
  }).filter((outcome) => validateSalesOutcome(outcome).valid)
}

/** Future cross-specialist handoff — not implemented in 17A. */
export function handoffBetweenSpecialists(): { handedOff: false; reason: "planning_only" } {
  return { handedOff: false, reason: "planning_only" }
}
