import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthAiCopilotInputSnapshot } from "@/lib/growth/ai-copilot-types"

export const GROWTH_AI_COPILOT_OBJECTION_FRAMEWORK = {
  timing: "Prospect indicates timing is not right — defer without losing momentum.",
  budget: "Budget or pricing concern — clarify value and scope, not discount-first.",
  incumbent: "Already using another solution — differentiate on gaps, not insult incumbent.",
  authority: "Needs approval from others — help map decision process.",
  priority: "Other priorities rank higher — tie to operational pain already surfaced.",
  trust: "Trust or proof gap — use research signals and relevant social proof.",
} as const

export const GROWTH_AI_COPILOT_BUYING_SIGNAL_FRAMEWORK = {
  engagement_spike: "Recent engagement uptick suggests renewed attention.",
  dm_confirmed: "Decision maker confirmed — prioritize direct conversation.",
  positive_reply: "Positive reply language detected in outbound history.",
  research_fit: "Strong fit score with usable research on file.",
  hot_engagement: "Hot engagement tier — act while attention is high.",
} as const

export const GROWTH_AI_COPILOT_COMMITMENT_SIGNAL_FRAMEWORK = {
  follow_up_scheduled: "Follow-up scheduled — protect slot and prepare agenda.",
  verbal_yes: "Verbal interest without calendar — push for concrete next step.",
  proposal_request: "Requested proposal or pricing — executive alignment may be needed.",
  executive_now: "Executive priority tier — leadership capacity may constrain pace.",
} as const

export function resolveGrowthAiCopilotFrameworkKeys(lead: GrowthLead): GrowthAiCopilotInputSnapshot["frameworks"] {
  const objections: string[] = []
  const buyingSignals: string[] = []
  const commitmentSignals: string[] = []

  if (lead.opportunityBlockers.some((b) => b.key === "long_inactivity")) objections.push("timing")
  if (lead.revenueProbabilityTier === "unlikely" || lead.revenueProbabilityTier === "possible") {
    objections.push("budget")
  }
  if (lead.opportunityBlockers.some((b) => b.key === "insufficient_research")) objections.push("trust")
  if (lead.decisionMakerStatus !== "confirmed" && lead.decisionMakerStatus !== "verified_contactable") {
    objections.push("authority")
  }
  if (lead.workflowHealth === "stalled" || lead.workflowHealth === "blocked") objections.push("priority")

  if (lead.engagementTier === "hot") buyingSignals.push("hot_engagement")
  if ((lead.engagementScore ?? 0) >= 70) buyingSignals.push("engagement_spike")
  if (lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable") {
    buyingSignals.push("dm_confirmed")
  }
  if ((lead.score ?? 0) >= 75 && lead.latestResearchRunId) buyingSignals.push("research_fit")
  if (lead.opportunityAccelerators.some((a) => a.key === "positive_reply")) buyingSignals.push("positive_reply")

  if (lead.followUpAt) commitmentSignals.push("follow_up_scheduled")
  if (lead.executivePriorityTier === "executive_now" || lead.executivePriorityTier === "priority") {
    commitmentSignals.push("executive_now")
  }
  if (lead.revenueProbabilityTier === "commit_candidate" || lead.revenueProbabilityTier === "forecasted") {
    commitmentSignals.push("proposal_request")
  }
  if (lead.engagementTier === "hot" && (lead.score ?? 0) >= 80) commitmentSignals.push("verbal_yes")

  return {
    objections: [...new Set(objections)],
    buyingSignals: [...new Set(buyingSignals)],
    commitmentSignals: [...new Set(commitmentSignals)],
  }
}

export function describeFrameworkKeys(
  keys: string[],
  framework: Record<string, string>,
): string[] {
  return keys.map((key) => framework[key as keyof typeof framework] ?? key)
}
