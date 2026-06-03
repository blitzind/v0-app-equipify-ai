/** Pure lead-field guards for outreach context packet assembly (client-safe). */

import { normalizeGrowthConversationObjectionProfile } from "@/lib/growth/conversation-objection-profile"

type ConversationTopSignal = { label: string }

type OperationalCapacityConstraint = { label: string }

type CompetitorMention = { name: string }

function formatObjectionKey(key: string): string {
  return key.replace(/_/g, " ")
}

export function buildOutreachObjectionSummaries(input: {
  conversationObjectionProfile: unknown
  conversationTopSignals?: ConversationTopSignal[] | null
}): string[] {
  const objectionProfile = normalizeGrowthConversationObjectionProfile(input.conversationObjectionProfile)
  const topSignals = Array.isArray(input.conversationTopSignals) ? input.conversationTopSignals : []
  return [
    ...objectionProfile.clusters.map((entry) => formatObjectionKey(entry.key)),
    ...topSignals
      .filter((signal) => /objection|competitor|budget|timing/i.test(signal.label))
      .map((signal) => signal.label),
  ]
}

export function resolveOperationalCapacityConstraintLabels(
  constraints: OperationalCapacityConstraint[] | null | undefined,
): string[] {
  if (!Array.isArray(constraints)) return []
  return constraints.map((entry) => entry.label)
}

export function resolveConversationCompetitorMentionNames(
  mentions: CompetitorMention[] | null | undefined,
): string[] {
  if (!Array.isArray(mentions)) return []
  return mentions.map((entry) => entry.name).filter(Boolean)
}
