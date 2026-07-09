/** GE-AIOS-17A — Sales Specialist → Memory bridge (validated business events only). */

import type { AvaMemoryEvent, AvaMemoryEventSource } from "@/lib/growth/memory/types"
import type { SalesOutcome, SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"

export const SALES_SPECIALIST_MEMORY_SOURCE: AvaMemoryEventSource = "sales_specialist"

function outcomeCategory(outcome: SalesOutcome): AvaMemoryEvent["category"] {
  switch (outcome.outcome_type) {
    case "research_completed":
      return "lead"
    case "qualification_completed":
      return "opportunity"
    case "outreach_prepared":
      return "outreach"
    case "meeting_prepared":
      return "meeting"
    case "approval_pending":
      return "approval"
    default:
      return "win"
  }
}

function outcomeImportance(outcome: SalesOutcome): number {
  if (outcome.approval_required) return 5
  if (outcome.outcome_type === "qualification_completed" && outcome.confidence >= 80) return 5
  if (outcome.outcome_type === "research_completed") return 3
  return 4
}

export function buildSalesOutcomeMemoryEvent(input: {
  organizationId: string
  generatedAt: string
  outcome: SalesOutcome
}): AvaMemoryEvent {
  const { outcome } = input
  const entityId = outcome.company_id ?? outcome.work_item_id ?? "sales-outcome"
  return {
    id: `sales:${outcome.outcome_type}:${entityId}:${outcome.completed_at.slice(0, 13)}`,
    category: outcomeCategory(outcome),
    timestamp: outcome.completed_at,
    importance: outcomeImportance(outcome),
    organizationId: input.organizationId,
    entityType: outcome.company_id ? "lead" : "company",
    entityId,
    source: SALES_SPECIALIST_MEMORY_SOURCE,
    summary: outcome.summary.endsWith(".") ? outcome.summary : `${outcome.summary}.`,
    metadata: {
      outcome_type: outcome.outcome_type,
      completed_by: outcome.completed_by,
      validated_by: outcome.validated_by,
      confidence: outcome.confidence,
      approval_required: outcome.approval_required,
      relationship_stage: outcome.relationship_stage,
      artifact_count: outcome.generated_artifacts.length,
      qa_marker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    },
  }
}

export function attachMemoryEventsToSalesOutcomes(input: {
  organizationId: string
  generatedAt: string
  outcomes: SalesOutcome[]
}): SalesOutcome[] {
  return input.outcomes.map((outcome) => ({
    ...outcome,
    validated_by: "sales_specialist" as const,
    memory_events: [buildSalesOutcomeMemoryEvent({ ...input, outcome })],
  }))
}

export function extractSalesOutcomeMemoryEvents(outcomes: SalesOutcome[]): AvaMemoryEvent[] {
  return outcomes.flatMap((outcome) => outcome.memory_events)
}

export function buildSalesCompletedWorkPeriodSummary(
  dailySummary: SalesOutcomeDailySummary | null | undefined,
): string | null {
  if (!dailySummary) return null
  const parts: string[] = []
  if (dailySummary.researched > 0) {
    parts.push(
      `Today I researched ${dailySummary.researched} ${dailySummary.researched === 1 ? "company" : "companies"}.`,
    )
  }
  if (dailySummary.strong_opportunities > 0) {
    parts.push(
      `I identified ${dailySummary.strong_opportunities} strong ${dailySummary.strong_opportunities === 1 ? "opportunity" : "opportunities"}.`,
    )
  }
  if (dailySummary.outreach_prepared > 0) {
    parts.push(
      `I prepared outreach for ${dailySummary.outreach_prepared} ${dailySummary.outreach_prepared === 1 ? "decision maker" : "decision makers"}.`,
    )
  }
  if (dailySummary.approvals_pending > 0) {
    parts.push(
      `${dailySummary.approvals_pending} outreach ${dailySummary.approvals_pending === 1 ? "draft is" : "drafts are"} ready for your approval.`,
    )
  }
  if (dailySummary.meetings_prepared > 0) {
    parts.push(
      `I prepared ${dailySummary.meetings_prepared} meeting ${dailySummary.meetings_prepared === 1 ? "brief" : "briefs"}.`,
    )
  }
  return parts.length > 0 ? parts.join(" ") : null
}

export function buildCompletedWorkNarrativeLines(input: {
  dailySummary: SalesOutcomeDailySummary | null | undefined
  memoryEvents: AvaMemoryEvent[]
}): string[] {
  const fromSummary = buildSalesCompletedWorkPeriodSummary(input.dailySummary)
  if (fromSummary) return [fromSummary]

  const salesEvents = input.memoryEvents.filter((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE)
  if (salesEvents.length === 0) return []

  const researched = salesEvents.filter((row) => row.metadata.outcome_type === "research_completed").length
  const qualified = salesEvents.filter((row) => row.metadata.outcome_type === "qualification_completed").length
  const approvals = salesEvents.filter(
    (row) => row.metadata.outcome_type === "approval_pending" || row.metadata.approval_required === true,
  ).length

  const lines: string[] = []
  if (researched > 0) lines.push(`Today I researched ${researched} companies.`)
  if (qualified > 0) lines.push(`I qualified ${qualified} opportunities.`)
  if (approvals > 0) lines.push(`${approvals} items are waiting for your approval.`)
  return lines.slice(0, 3)
}
