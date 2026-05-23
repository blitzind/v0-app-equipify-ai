import type {
  GrowthAiCopilotGenerationType,
  GrowthAiCopilotInputSnapshot,
  GrowthAiCopilotPromptVariant,
} from "@/lib/growth/ai-copilot-types"
import {
  describeFrameworkKeys,
  GROWTH_AI_COPILOT_BUYING_SIGNAL_FRAMEWORK,
  GROWTH_AI_COPILOT_COMMITMENT_SIGNAL_FRAMEWORK,
  GROWTH_AI_COPILOT_OBJECTION_FRAMEWORK,
} from "@/lib/growth/ai-copilot-frameworks"

const VARIANT_INSTRUCTIONS: Record<GrowthAiCopilotPromptVariant | string, string> = {
  default: "Use a professional, concise B2B tone.",
  concise: "Use short sentences and minimal fluff.",
  executive: "Use executive brevity; assume limited time and high context.",
}

const TYPE_INSTRUCTIONS: Record<GrowthAiCopilotGenerationType, string> = {
  cold_email: "Draft a first-touch cold email.",
  follow_up_email: "Draft a follow-up email referencing prior outreach without claiming a send occurred.",
  response_draft: "Draft a reply to the prospect message. Classify the reply intent.",
  reengagement_email: "Draft a reengagement email for a dormant but qualified lead.",
  executive_email: "Draft an executive-level note focused on business outcome.",
  breakup_email: "Draft a respectful breakup / last-touch email.",
  call_opening: "Draft a spoken call opening script and recommended CTA.",
  call_objection_response: "Draft objection handling talking points keyed to known objections.",
  call_summary: "Draft a post-call summary template the rep can fill in.",
  next_message: "Draft the next recommended message based on NBA and intelligence.",
  call_risk_brief: "Draft a pre-call risk brief: decision maker focus, blockers, objections, opening, CTA, and risk summary.",
}

export function buildGrowthAiCopilotSystemPrompt(
  generationType: GrowthAiCopilotGenerationType,
  promptVariant: GrowthAiCopilotPromptVariant | string,
): string {
  return [
    "You are Equipify Growth Engine AI Communication Copilot.",
    "You suggest copy only. You do NOT send email, place calls, or modify CRM data.",
    "Do not invent facts not present in the input snapshot.",
    "Do not include internal UUIDs, API keys, or provider details.",
    "Respect suppression and not_interested signals — if present, refuse outreach copy politely in JSON.",
    TYPE_INSTRUCTIONS[generationType],
    VARIANT_INSTRUCTIONS[promptVariant] ?? VARIANT_INSTRUCTIONS.default,
    "Return JSON with keys: subject (nullable), content (string), classification (optional object).",
  ].join("\n")
}

export function buildGrowthAiCopilotUserPrompt(
  generationType: GrowthAiCopilotGenerationType,
  snapshot: GrowthAiCopilotInputSnapshot,
): string {
  const objectionNotes = describeFrameworkKeys(
    snapshot.frameworks.objections,
    GROWTH_AI_COPILOT_OBJECTION_FRAMEWORK,
  )
  const buyingNotes = describeFrameworkKeys(
    snapshot.frameworks.buyingSignals,
    GROWTH_AI_COPILOT_BUYING_SIGNAL_FRAMEWORK,
  )
  const commitmentNotes = describeFrameworkKeys(
    snapshot.frameworks.commitmentSignals,
    GROWTH_AI_COPILOT_COMMITMENT_SIGNAL_FRAMEWORK,
  )

  return JSON.stringify(
    {
      generationType,
      lead: {
        companyName: snapshot.companyName,
        contactName: snapshot.contactName,
        fitScore: snapshot.fitScore,
        engagementTier: snapshot.engagementTier,
        engagementSummary: snapshot.engagementSummary,
        relationshipTier: snapshot.relationshipTier,
        relationshipTrend: snapshot.relationshipTrend,
        opportunityTier: snapshot.opportunityTier,
        opportunityBlockers: snapshot.opportunityBlockers,
        opportunityAccelerators: snapshot.opportunityAccelerators,
        revenueTier: snapshot.revenueTier,
        revenueTrajectory: snapshot.revenueTrajectory,
        executiveTier: snapshot.executiveTier,
        executiveRecommendation: snapshot.executiveRecommendation,
        capacityTier: snapshot.capacityTier,
        capacityProtection: snapshot.capacityProtection,
        researchSummary: snapshot.researchSummary,
        researchNextAction: snapshot.researchNextAction,
        decisionMakers: snapshot.decisionMakers,
        nextBestAction: snapshot.nextBestAction,
        nextBestActionReason: snapshot.nextBestActionReason,
      },
      recentOutbound: snapshot.recentOutbound,
      replyPreview: snapshot.replyPreview,
      frameworks: {
        objections: objectionNotes,
        buyingSignals: buyingNotes,
        commitmentSignals: commitmentNotes,
      },
    },
    null,
    2,
  )
}
