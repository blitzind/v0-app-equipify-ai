/** GS-AI-PLAYBOOK-4A — Next best action planner (client-safe). */

import type {
  GrowthBuyingStage,
  GrowthConversationState,
  GrowthNextBestActionPlan,
  GrowthNextBestActionType,
  GrowthNextBestActionUrgency,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthBuyingStageMessagingGuidance } from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"

const ACTION_LABELS: Record<GrowthNextBestActionType, string> = {
  schedule_workflow_review: "Schedule workflow review",
  share_case_study: "Share case study",
  send_comparison: "Send comparison",
  reengage: "Re-engage with value",
  ask_discovery_question: "Ask discovery question",
  book_meeting: "Book meeting",
  share_compliance_proof: "Share compliance proof",
  confirm_implementation: "Confirm implementation plan",
}

export function nextBestActionLabel(action: GrowthNextBestActionType): string {
  return ACTION_LABELS[action]
}

export function buildGrowthNextBestActionPlan(input: {
  buyingStage: GrowthBuyingStage
  conversationState: GrowthConversationState
  messagingGuidance: GrowthBuyingStageMessagingGuidance
  signals: GrowthBuyingStageSignalInput
  progressionTriggers: string[]
  blockers: string[]
}): GrowthNextBestActionPlan {
  let primaryAction: GrowthNextBestActionType = "ask_discovery_question"
  let secondaryAction: GrowthNextBestActionType | null = "share_case_study"
  let urgency: GrowthNextBestActionUrgency = "medium"
  let rationale = "Default consultative progression"

  switch (input.buyingStage) {
    case "unaware":
      primaryAction = "ask_discovery_question"
      secondaryAction = "share_case_study"
      urgency = "low"
      rationale = "Educate and learn before proposing a meeting"
      break
    case "problem_aware":
      primaryAction = "ask_discovery_question"
      secondaryAction = "schedule_workflow_review"
      urgency = "medium"
      rationale = "Diagnose workflow pain and offer a review"
      break
    case "solution_aware":
      primaryAction = "schedule_workflow_review"
      secondaryAction = "share_case_study"
      urgency = "medium"
      rationale = "Share proof through a workflow-oriented review"
      break
    case "evaluating":
      primaryAction = input.conversationState === "hot" ? "book_meeting" : "send_comparison"
      secondaryAction = "schedule_workflow_review"
      urgency = input.conversationState === "hot" ? "high" : "medium"
      rationale = "Compare approaches and move toward a decision conversation"
      break
    case "buying_committee":
      primaryAction = "send_comparison"
      secondaryAction = "book_meeting"
      urgency = "high"
      rationale = "Support multi-stakeholder evaluation with comparison proof"
      break
    case "proposal":
      primaryAction = "confirm_implementation"
      secondaryAction = "book_meeting"
      urgency = "high"
      rationale = "Remove friction and reinforce implementation confidence"
      break
    case "decision":
      primaryAction = "book_meeting"
      secondaryAction = "confirm_implementation"
      urgency = "high"
      rationale = "Close remaining decision gaps quickly"
      break
    case "customer":
      primaryAction = "share_case_study"
      secondaryAction = null
      urgency = "low"
      rationale = "Support expansion with relevant proof"
      break
    case "dormant":
      primaryAction = "reengage"
      secondaryAction = "share_case_study"
      urgency = "low"
      rationale = "Re-open with value before asking for time"
      break
  }

  if (input.conversationState === "stalled") {
    primaryAction = "reengage"
    secondaryAction = "ask_discovery_question"
    urgency = "medium"
    rationale = "Conversation stalled — provide value and reopen discovery"
  }

  if (
    input.messagingGuidance.narrativeBias.includes("compliance") &&
    (input.signals.researchPainPoints ?? []).some((entry) => /compliance|audit|htm|pm/i.test(entry))
  ) {
    secondaryAction = secondaryAction ?? "share_compliance_proof"
  }

  const avoidActions = [...input.messagingGuidance.avoidActions]
  if (input.blockers.includes("Unresolved objections")) {
    avoidActions.push("Hard close before objection follow-up")
  }

  return {
    primaryAction,
    secondaryAction,
    avoidActions: [...new Set(avoidActions)],
    urgency,
    rationale,
  }
}

export function nextBestActionOperatorLabels(plan: GrowthNextBestActionPlan): {
  primary: string
  secondary: string | null
  avoid: string[]
} {
  return {
    primary: nextBestActionLabel(plan.primaryAction),
    secondary: plan.secondaryAction ? nextBestActionLabel(plan.secondaryAction) : null,
    avoid: plan.avoidActions,
  }
}
