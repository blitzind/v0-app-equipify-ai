/** Sprint 5 — editable sales execution plans (no automatic execution). */

import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthSalesExecutionPlan,
  type GrowthSalesExecutionPlanStep,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

export type GenerateSalesExecutionPlanInput = {
  leadId: string
  revenueReadinessScore: number | null
  revenueReadinessTier: string | null
  recommendationType: string | null
  recommendationStage: string | null
  hasMeetingIntent: boolean
  hasPricingIntent: boolean
  hasProposalIntent: boolean
  unresolvedObjectionCount: number
  hasPositiveReply: boolean
  connectedCallCount: number
  playbookKey: string | null
}

function step(
  order: number,
  title: string,
  description: string,
  suggestedChannel: GrowthSalesExecutionPlanStep["suggestedChannel"],
): GrowthSalesExecutionPlanStep {
  return {
    id: `step-${order}`,
    order,
    title,
    description,
    suggestedChannel,
    completed: false,
    operatorNotes: null,
  }
}

export function generateSalesExecutionPlan(input: GenerateSalesExecutionPlanInput): GrowthSalesExecutionPlan {
  const now = new Date().toISOString()
  const steps: GrowthSalesExecutionPlanStep[] = []
  let order = 1

  if (input.unresolvedObjectionCount > 0) {
    steps.push(
      step(
        order++,
        "Address unresolved objections",
        "Review relationship memory objections before advancing.",
        "call",
      ),
    )
  }

  if ((input.connectedCallCount ?? 0) === 0 && input.hasPositiveReply) {
    steps.push(step(order++, "Call prospect", "Human places discovery call — no auto-dial.", "call"))
  }

  if (input.hasPricingIntent) {
    steps.push(step(order++, "Validate scope", "Confirm requirements before sharing pricing.", "call"))
    steps.push(step(order++, "Send pricing", "Operator sends approved pricing manually.", "email"))
  }

  if (input.hasMeetingIntent) {
    steps.push(step(order++, "Schedule demo", "Human coordinates meeting times.", "meeting"))
  }

  if (input.hasProposalIntent || input.recommendationType === "create_opportunity") {
    steps.push(step(order++, "Create opportunity", "Operator creates CRM opportunity after confirmation.", "crm"))
    steps.push(step(order++, "Proposal review", "Human prepares and sends proposal.", "email"))
  }

  if (steps.length === 0) {
    steps.push(step(order++, "Research account", "Review readiness signals and memory before outreach.", "research"))
    steps.push(step(order++, "Human follow-up", "Rep executes next best action manually.", "other"))
  }

  steps.push(step(order, "Review progress", "Operator marks steps complete — no automatic execution.", "other"))

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    leadId: input.leadId,
    generatedAt: now,
    updatedAt: now,
    summary: `Execution plan for ${input.revenueReadinessTier ?? "unknown"} readiness — human approval required for each step.`,
    steps,
    editable: true,
    requiresHumanApproval: true,
  }
}

export function mergeSalesExecutionPlanEdits(
  existing: GrowthSalesExecutionPlan,
  patch: {
    steps?: GrowthSalesExecutionPlanStep[]
    summary?: string
  },
): GrowthSalesExecutionPlan {
  return {
    ...existing,
    summary: patch.summary ?? existing.summary,
    steps: patch.steps ?? existing.steps,
    updatedAt: new Date().toISOString(),
  }
}
