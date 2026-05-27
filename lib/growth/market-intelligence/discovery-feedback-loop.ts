/** Deterministic discovery feedback weighting from outcomes. Client-safe. */

export type DiscoveryOutcomePatternInput = {
  pattern_key: string
  industry?: string | null
  employee_band?: string | null
  technology?: string | null
  won_count: number
  lost_count: number
  meetings_booked: number
  positive_replies: number
  negative_replies: number
  closed_deals: number
  evidence_excerpt: string
}

export function computeDiscoveryPriorityBoost(input: DiscoveryOutcomePatternInput): number {
  let boost = 0
  boost += input.won_count * 4
  boost += input.closed_deals * 5
  boost += input.meetings_booked * 2
  boost += input.positive_replies * 1
  boost -= input.lost_count * 2
  boost -= input.negative_replies * 1
  return Math.max(0, Math.min(40, boost))
}

export function buildDiscoveryPatternKey(input: {
  industry?: string | null
  employee_band?: string | null
  technology?: string | null
}): string {
  return [input.industry, input.employee_band, input.technology]
    .map((part) => (part ?? "unknown").trim().toLowerCase().replace(/\s+/g, "_"))
    .join("|")
}

export function applyDiscoveryPriorityBoost(basePriority: number, boost: number): number {
  return Math.max(0, Math.min(100, basePriority + boost))
}
