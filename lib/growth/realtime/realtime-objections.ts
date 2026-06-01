import type { GrowthRealtimeDetectedObjection, GrowthRealtimeObjectionKey } from "@/lib/growth/realtime/realtime-call-types"

const OBJECTION_RULES: Array<{ key: GrowthRealtimeObjectionKey; label: string; pattern: RegExp }> = [
  { key: "pricing_objection", label: "Pricing objection", pattern: /\b(too expensive|price is high|costly|can't afford|pricing)\b/i },
  { key: "budget_concern", label: "Budget concern", pattern: /\b(budget|afford|cost|spend|investment)\b/i },
  { key: "timing_objection", label: "Timing objection", pattern: /\b(not now|next quarter|later|too busy|bad timing|next year)\b/i },
  {
    key: "already_using_solution",
    label: "Already using a solution",
    pattern: /\b(already (use|using|have)|current vendor|incumbent|locked in)\b/i,
  },
  { key: "feature_gap", label: "Feature gap", pattern: /\b(missing|doesn't have|lack|need feature|does not support|migration|migrate|data transfer|switch over)\b/i },
  { key: "authority_objection", label: "Authority objection", pattern: /\b(boss|decision maker|approval|sign.?off|stakeholder)\b/i },
  { key: "priority_objection", label: "Priority objection", pattern: /\b(not a priority|back burner|other priorities)\b/i },
]

const COMPETITOR_PATTERNS = [
  { name: "ServiceTitan", pattern: /\bservicetitan\b/i },
  { name: "Housecall Pro", pattern: /\bhousecall\s*pro\b/i },
  { name: "Jobber", pattern: /\bjobber\b/i },
  { name: "FieldEdge", pattern: /\bfield\s*edge\b/i },
  { name: "Salesforce", pattern: /\bsalesforce\b/i },
  { name: "HubSpot", pattern: /\bhubspot\b/i },
]

export function detectRealtimeObjections(input: {
  content: string
  sequenceNumber: number
}): GrowthRealtimeDetectedObjection[] {
  const text = input.content.trim()
  if (!text) return []

  const found: GrowthRealtimeDetectedObjection[] = []
  const seen = new Set<GrowthRealtimeObjectionKey>()

  for (const rule of OBJECTION_RULES) {
    if (rule.pattern.test(text) && !seen.has(rule.key)) {
      seen.add(rule.key)
      found.push({
        key: rule.key,
        label: rule.label,
        excerpt: text.slice(0, 160),
        sequenceNumber: input.sequenceNumber,
      })
    }
  }

  for (const competitor of COMPETITOR_PATTERNS) {
    if (competitor.pattern.test(text) && !seen.has("competitor_mention")) {
      seen.add("competitor_mention")
      found.push({
        key: "competitor_mention",
        label: `Competitor mention: ${competitor.name}`,
        excerpt: text.slice(0, 160),
        sequenceNumber: input.sequenceNumber,
      })
    }
  }

  return found
}

export function mergeRealtimeObjections(
  events: Array<{ content: string; sequenceNumber: number }>,
): GrowthRealtimeDetectedObjection[] {
  const byKey = new Map<string, GrowthRealtimeDetectedObjection>()
  for (const event of events) {
    for (const objection of detectRealtimeObjections(event)) {
      if (!byKey.has(objection.key)) byKey.set(objection.key, objection)
    }
  }
  return [...byKey.values()]
}

export function detectRealtimeCompetitors(content: string): string[] {
  const found: string[] = []
  for (const competitor of COMPETITOR_PATTERNS) {
    if (competitor.pattern.test(content)) found.push(competitor.name)
  }
  return found
}

export { COMPETITOR_PATTERNS }
