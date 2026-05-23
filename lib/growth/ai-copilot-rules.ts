import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthAiCopilotGenerationType,
  GrowthAiCopilotRule,
} from "@/lib/growth/ai-copilot-types"
import type { GrowthLeadEmailEventSummary } from "@/lib/growth/outbound/types"

const COLD_TYPES = new Set<GrowthAiCopilotGenerationType>([
  "cold_email",
  "reengagement_email",
  "follow_up_email",
])

export function evaluateGrowthAiCopilotRules(input: {
  lead: GrowthLead
  generationType: GrowthAiCopilotGenerationType
  rules: GrowthAiCopilotRule[]
  emailSummary?: GrowthLeadEmailEventSummary
}): { allowed: boolean; reason?: string } {
  const enabled = new Map(input.rules.filter((rule) => rule.enabled).map((rule) => [rule.ruleKey, rule]))

  if (enabled.has("no_auto_send")) {
    // Always enforced in 6.0A — generation only.
  }

  if (enabled.has("require_human_approval")) {
    // Enforced at API layer — all generations start as draft.
  }

  const summary = input.emailSummary ?? {
    sentCount14d: 0,
    openCount14d: 0,
    clickCount14d: 0,
    replyCount14d: 0,
    sentCount30d: 0,
    openCount30d: 0,
    interestedReply7d: false,
    latestReplyClassification: null,
    isSuppressed: false,
    lastSentAt: null,
    lastReplyAt: null,
  }

  if (enabled.has("block_suppressed_leads") && summary.isSuppressed) {
    return { allowed: false, reason: "Lead is suppressed — copilot generation blocked." }
  }

  if (
    enabled.has("block_not_interested_cold") &&
    COLD_TYPES.has(input.generationType) &&
    (summary.latestReplyClassification === "not_interested" ||
      input.lead.opportunityBlockers.some((blocker) => blocker.key === "not_interested"))
  ) {
    return { allowed: false, reason: "Lead marked not interested — cold outreach drafts blocked." }
  }

  return { allowed: true }
}

export function computeGrowthAiCopilotEffectivenessScore(input: {
  outcome: "generated" | "approved" | "discarded" | "expired"
  classificationConfidence?: number
}): number {
  switch (input.outcome) {
    case "approved":
      return Math.round(70 + (input.classificationConfidence ?? 0.5) * 30)
    case "generated":
      return 40
    case "discarded":
      return 10
    case "expired":
      return 0
    default:
      return 0
  }
}
