import type {
  GrowthConversationCompetitorMention,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

export function computeGrowthConversationCompetitorPressure(input: GrowthLeadConversationInput): {
  mentions: GrowthConversationCompetitorMention[]
  pressure: number
} {
  const now = input.now ?? new Date()
  const byName = new Map<string, { count: number; lastAt: string; recentCount: number }>()

  for (const signal of input.signals) {
    if (!signal.kind.startsWith("competitor_")) continue
    const name = signal.label.replace(/^Competitor mention(?: \(call\))?: /, "")
    const existing = byName.get(name) ?? { count: 0, lastAt: signal.occurredAt, recentCount: 0 }
    existing.count += 1
    if (Date.parse(signal.occurredAt) > Date.parse(existing.lastAt)) {
      existing.lastAt = signal.occurredAt
    }
    const ageDays = (now.getTime() - Date.parse(signal.occurredAt)) / (24 * 60 * 60 * 1000)
    if (ageDays <= 30) existing.recentCount += 1
    byName.set(name, existing)
  }

  const mentions: GrowthConversationCompetitorMention[] = [...byName.entries()].map(([name, meta]) => ({
    name,
    count: meta.count,
    lastMentionedAt: meta.lastAt,
    trend: meta.recentCount >= 2 ? "up" : meta.recentCount === 1 ? "stable" : "down",
  }))

  let pressure = 0
  for (const mention of mentions) {
    pressure += Math.min(30, mention.count * 8)
    const ageDays =
      (now.getTime() - Date.parse(mention.lastMentionedAt)) / (24 * 60 * 60 * 1000)
    if (ageDays <= 14) pressure += 15
    else if (ageDays <= 45) pressure += 8
    if (mention.trend === "up") pressure += 10
  }

  return {
    mentions: mentions.sort((a, b) => b.count - a.count),
    pressure: Math.max(0, Math.min(100, pressure)),
  }
}
