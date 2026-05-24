import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthAssignmentSettings,
  GrowthRepRosterEntry,
} from "@/lib/growth/assignment/assignment-types"
import {
  detectGrowthLeadAssignmentIndustry,
  isHighPriorityLeadForAssignment,
  leadTerritoryTokens,
} from "@/lib/growth/assignment/detect-lead-assignment-context"

export type AssignmentCandidateScore = {
  rep: GrowthRepRosterEntry
  score: number
  reasons: string[]
}

function repHasCapacity(rep: GrowthRepRosterEntry): boolean {
  if (rep.status !== "active") return false
  if (rep.activeLeadCount >= rep.maxActiveLeads) return false
  if (rep.dailyAssignmentCount >= rep.maxDailyNewAssignments) return false
  return true
}

function scoreRepForLead(
  rep: GrowthRepRosterEntry,
  lead: GrowthLead,
  settings: GrowthAssignmentSettings,
): AssignmentCandidateScore | null {
  if (!repHasCapacity(rep)) return null

  let score = 0
  const reasons: string[] = []

  if (settings.industrySpecializationEnabled && rep.industries.length > 0) {
    const industry = detectGrowthLeadAssignmentIndustry(lead)
    if (rep.industries.includes(industry)) {
      score += 30
      reasons.push("industry_match")
    }
  }

  if (settings.territoryMatchingEnabled && rep.territories.length > 0) {
    const territories = leadTerritoryTokens(lead)
    const matched = territories.some((token) =>
      rep.territories.some((entry) => entry.trim().toUpperCase() === token),
    )
    if (matched) {
      score += 25
      reasons.push("territory_match")
    }
  }

  if (settings.capacityBalancingEnabled) {
    const loadRatio = rep.activeLeadCount / Math.max(rep.maxActiveLeads, 1)
    score += Math.round((1 - loadRatio) * 20)
    reasons.push("capacity_balance")
  }

  if (settings.priorityRoutingEnabled && isHighPriorityLeadForAssignment(lead)) {
    score += 10
    reasons.push("priority_lead")
  }

  if (rep.leadTypes.length > 0 && rep.leadTypes.includes(lead.sourceKind)) {
    score += 15
    reasons.push("lead_type_match")
  }

  score += Math.max(0, 10 - rep.roundRobinOrder)
  reasons.push("round_robin_order")

  return { rep, score, reasons }
}

export function selectAssignmentRepForLead(input: {
  lead: GrowthLead
  reps: GrowthRepRosterEntry[]
  settings: GrowthAssignmentSettings
}): { rep: GrowthRepRosterEntry; reasons: string[] } | null {
  const eligible = input.reps
    .map((rep) => scoreRepForLead(rep, input.lead, input.settings))
    .filter((entry): entry is AssignmentCandidateScore => entry !== null)

  if (eligible.length === 0) return null

  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.rep.roundRobinOrder !== b.rep.roundRobinOrder) return a.rep.roundRobinOrder - b.rep.roundRobinOrder
    const aLast = a.rep.lastAssignedAt ? Date.parse(a.rep.lastAssignedAt) : 0
    const bLast = b.rep.lastAssignedAt ? Date.parse(b.rep.lastAssignedAt) : 0
    return aLast - bLast
  })

  if (input.settings.roundRobinEnabled) {
    const topScore = eligible[0]?.score ?? 0
    const topTier = eligible.filter((entry) => entry.score === topScore)
    topTier.sort((a, b) => {
      const cursor = input.settings.roundRobinCursorUserId
      if (cursor) {
        const aAfterCursor = a.rep.userId.localeCompare(cursor) > 0
        const bAfterCursor = b.rep.userId.localeCompare(cursor) > 0
        if (aAfterCursor !== bAfterCursor) return aAfterCursor ? -1 : 1
      }
      const aLast = a.rep.lastAssignedAt ? Date.parse(a.rep.lastAssignedAt) : 0
      const bLast = b.rep.lastAssignedAt ? Date.parse(b.rep.lastAssignedAt) : 0
      return aLast - bLast
    })
    const winner = topTier[0]
    return winner ? { rep: winner.rep, reasons: winner.reasons } : null
  }

  const winner = eligible[0]
  return winner ? { rep: winner.rep, reasons: winner.reasons } : null
}

export function isManualAssignmentProtected(source: string | null | undefined): boolean {
  return source === "manual" || source === "manager_override"
}
