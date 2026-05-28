/** Smart refresh prioritization — operator-triggered refresh ordering. Client-safe. */

import type { ProspectSearchContactPriorityTier } from "@/lib/growth/prospect-search/prospect-search-contact-ranking"

export type ProspectSearchRefreshPriorityInput = {
  company_id: string
  contact_id: string
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  freshness_status: string
  persona_icp_relevance: number
  company_suppressed?: boolean
  website?: string | null
  lead_engine_score?: number | null
  missing_persona_gap?: boolean
}

export function prioritizeProspectSearchRefreshTargets<
  T extends ProspectSearchRefreshPriorityInput,
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => scoreRefreshPriority(b) - scoreRefreshPriority(a))
}

function scoreRefreshPriority(row: ProspectSearchRefreshPriorityInput): number {
  if (row.company_suppressed) return -100
  if (row.priority_tier === "blocked") return -50

  let score = 0
  if (row.freshness_status === "expired") score += 40
  else if (row.freshness_status === "stale") score += 30
  else if (row.freshness_status === "aging") score += 10

  score += row.outreach_rank_score * 25
  score += row.persona_icp_relevance * 15

  if (row.lead_engine_score != null && row.lead_engine_score >= 70) score += 12
  if (row.missing_persona_gap) score += 8
  if (row.website?.trim()) score += 6
  else score -= 15

  if (row.priority_tier === "high_priority" || row.priority_tier === "recommended") score += 10
  if (row.priority_tier === "low_confidence") score -= 5

  return score
}

export function prioritizeProspectSearchRefreshCompanyIds<
  T extends ProspectSearchRefreshPriorityInput,
>(rows: T[]): string[] {
  const prioritized = prioritizeProspectSearchRefreshTargets(rows)
  const seen = new Set<string>()
  const ids: string[] = []
  for (const row of prioritized) {
    if (seen.has(row.company_id)) continue
    if (row.company_suppressed || row.priority_tier === "blocked") continue
    seen.add(row.company_id)
    ids.push(row.company_id)
  }
  return ids
}
