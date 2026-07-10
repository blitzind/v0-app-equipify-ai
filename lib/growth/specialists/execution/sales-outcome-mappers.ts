/** GE-AIOS-17A — Map existing workflow agent completions → canonical SalesOutcome. */

import type { GrowthAutonomousMeetingRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { GrowthAutonomousOutreachPreparationRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAutonomousQualificationRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import type { GrowthAutonomousResearchRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import type { RunGrowthLeadResearchResult } from "@/lib/growth/research/growth-lead-research-execution-service"
import type { GrowthAvaResearchLoopLeadResult } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { SalesOutcome, SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"

function baseOutcome(
  partial: Omit<SalesOutcome, "validated_by" | "memory_events">,
): SalesOutcome {
  return {
    ...partial,
    validated_by: "sales_specialist",
    memory_events: [],
  }
}

export function mapResearchRunToSalesOutcome(run: GrowthAutonomousResearchRunRecord): SalesOutcome | null {
  if (run.outcome !== "completed") return null
  return baseOutcome({
    work_item_id: `research:${run.runId}`,
    company_id: run.leadId,
    person_id: null,
    relationship_stage: null,
    outcome_type: "research_completed",
    confidence: run.confidence,
    completed_by: "research_agent",
    completed_at: run.completedAt,
    summary: run.researchSummary?.trim() || `Researched ${run.companyName ?? "company"}.`,
    generated_artifacts: [],
    approval_required: false,
    recommended_next_action: "Continue qualification",
  })
}

export function mapProspectResearchExecutionToSalesOutcome(
  execution: RunGrowthLeadResearchResult,
  input: { workItemId: string; leadId: string },
): SalesOutcome | null {
  if (!execution.ok) return null
  if (execution.outcome === "active") return null
  if (execution.run.status !== "completed") return null

  const summary =
    execution.run.researchSummary?.trim() ||
    execution.run.suggestedPitchAngle?.trim() ||
    `Researched company using public website evidence.`

  return baseOutcome({
    work_item_id: input.workItemId,
    company_id: input.leadId,
    person_id: null,
    relationship_stage: null,
    outcome_type: "research_completed",
    confidence: execution.run.researchConfidence ?? 70,
    completed_by: "research_agent",
    completed_at: execution.run.completedAt ?? new Date().toISOString(),
    summary,
    generated_artifacts: execution.run.signals?.painSignals?.slice(0, 3) ?? [],
    approval_required: false,
    recommended_next_action: execution.qualificationRan ? "Prepare outreach" : "Continue qualification",
  })
}

export function mapQualificationRunToSalesOutcome(
  run: GrowthAutonomousQualificationRunRecord,
): SalesOutcome | null {
  if (run.outcome !== "completed" || run.qualificationStatus !== "qualified") return null
  return baseOutcome({
    work_item_id: `qualification:${run.runId}`,
    company_id: run.leadId,
    person_id: null,
    relationship_stage: "qualified",
    outcome_type: "qualification_completed",
    confidence: run.confidence ?? 70,
    completed_by: "qualification_agent",
    completed_at: run.completedAt,
    summary: run.reasoning?.trim() || `Qualified ${run.companyName ?? "company"}.`,
    generated_artifacts: run.missingEvidence.length > 0 ? run.missingEvidence : [],
    approval_required: false,
    recommended_next_action: run.recommendedNextStep,
  })
}

export function mapOutreachRunToSalesOutcome(
  run: GrowthAutonomousOutreachPreparationRunRecord,
): SalesOutcome | null {
  if (run.outcome !== "completed" || !run.approvalPackage) return null
  const pkg = run.approvalPackage
  return baseOutcome({
    work_item_id: `outreach:${run.runId}`,
    company_id: run.leadId,
    person_id: null,
    relationship_stage: "outreach_ready",
    outcome_type: pkg.pendingHumanApproval ? "approval_pending" : "outreach_prepared",
    confidence: run.confidence ?? pkg.confidence,
    completed_by: "outreach_agent",
    completed_at: run.completedAt,
    summary: `Prepared outreach for ${pkg.companyName ?? "company"}.`,
    generated_artifacts: pkg.generatedAssets.map((asset) => asset.label),
    approval_required: pkg.pendingHumanApproval,
    recommended_next_action: pkg.expectedOutcome,
  })
}

export function mapMeetingRunToSalesOutcome(run: GrowthAutonomousMeetingRunRecord): SalesOutcome | null {
  if (run.outcome !== "completed" || !run.preparationPackage) return null
  const pkg = run.preparationPackage
  return baseOutcome({
    work_item_id: `meeting:${run.runId}`,
    company_id: run.leadId,
    person_id: null,
    relationship_stage: "meeting_ready",
    outcome_type: "meeting_prepared",
    confidence: run.confidence ?? pkg.confidence,
    completed_by: "meeting_agent",
    completed_at: run.completedAt,
    summary: `Prepared meeting brief for ${pkg.companyName ?? "company"}.`,
    generated_artifacts: pkg.generatedAssets.map((asset) => asset.label),
    approval_required: pkg.pendingHumanApproval,
    recommended_next_action: pkg.expectedOutcome,
  })
}

export function mapResearchLoopLeadToSalesOutcomes(
  lead: GrowthAvaResearchLoopLeadResult,
  completedAt: string,
): SalesOutcome[] {
  const outcomes: SalesOutcome[] = []
  if (lead.outcome === "completed") {
    outcomes.push(
      baseOutcome({
        work_item_id: `ava-research:${lead.leadId}`,
        company_id: lead.leadId,
        person_id: null,
        relationship_stage: null,
        outcome_type: "research_completed",
        confidence: lead.hasBuyingSignals ? 78 : 65,
        completed_by: "research_agent",
        completed_at: completedAt,
        summary: `Researched ${lead.companyName ?? "company"}.`,
        generated_artifacts: [],
        approval_required: false,
        recommended_next_action: lead.readyForOutreachReview ? "Prepare outreach" : "Continue qualification",
      }),
    )
  }
  if (lead.qualificationStatus === "completed") {
    outcomes.push(
      baseOutcome({
        work_item_id: `ava-qualification:${lead.leadId}`,
        company_id: lead.leadId,
        person_id: null,
        relationship_stage: "qualified",
        outcome_type: "qualification_completed",
        confidence: lead.hasBuyingSignals ? 85 : 72,
        completed_by: "qualification_agent",
        completed_at: completedAt,
        summary: `Qualified ${lead.companyName ?? "company"}.`,
        generated_artifacts: [],
        approval_required: false,
        recommended_next_action: lead.readyForOutreachReview ? "Prepare outreach" : null,
      }),
    )
  }
  if (lead.readyForOutreachReview) {
    outcomes.push(
      baseOutcome({
        work_item_id: `ava-outreach-ready:${lead.leadId}`,
        company_id: lead.leadId,
        person_id: null,
        relationship_stage: "outreach_ready",
        outcome_type: "approval_pending",
        confidence: 82,
        completed_by: "outreach_agent",
        completed_at: completedAt,
        summary: `Outreach ready for review — ${lead.companyName ?? "company"}.`,
        generated_artifacts: [],
        approval_required: true,
        recommended_next_action: "Review outreach draft",
      }),
    )
  }
  return outcomes
}

export function dedupeSalesOutcomes(outcomes: SalesOutcome[]): SalesOutcome[] {
  const seen = new Set<string>()
  const merged: SalesOutcome[] = []
  for (const outcome of outcomes) {
    const key = `${outcome.outcome_type}:${outcome.company_id ?? outcome.work_item_id ?? outcome.summary}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(outcome)
  }
  return merged
}

export function buildSalesOutcomeDailySummary(input: {
  outcomes: SalesOutcome[]
  generatedAt: string
  approvalsPendingOverride?: number
}): SalesOutcomeDailySummary {
  const researched = input.outcomes.filter((row) => row.outcome_type === "research_completed").length
  const qualified = input.outcomes.filter((row) => row.outcome_type === "qualification_completed").length
  const outreachPrepared = input.outcomes.filter((row) => row.outcome_type === "outreach_prepared").length
  const meetingsPrepared = input.outcomes.filter((row) => row.outcome_type === "meeting_prepared").length
  const approvalsPending =
    input.approvalsPendingOverride ??
    input.outcomes.filter((row) => row.outcome_type === "approval_pending" || row.approval_required).length
  const strongOpportunities = input.outcomes.filter(
    (row) =>
      row.outcome_type === "qualification_completed" &&
      row.confidence >= 75 &&
      /signal|switch|expanding|strong/i.test(row.summary),
  ).length

  return {
    qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    generatedAt: input.generatedAt,
    researched,
    qualified,
    strong_opportunities: strongOpportunities > 0 ? strongOpportunities : qualified,
    outreach_prepared: outreachPrepared,
    meetings_prepared: meetingsPrepared,
    approvals_pending: approvalsPending,
  }
}
