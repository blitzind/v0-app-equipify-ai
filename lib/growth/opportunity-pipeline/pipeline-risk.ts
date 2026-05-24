import type {
  GrowthOpportunityRiskSignal,
  GrowthOpportunityStageKey,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"

export type GrowthOpportunityRiskInput = {
  stageKey: GrowthOpportunityStageKey
  stageAgeDays: number
  ageDays: number
  staleStageDays: number
  staleActivityDays: number
  lastActivityAt: string
  expectedCloseDate: string | null
  followUpAt: string | null
  engagementTrend?: string | null
  ownerOverloaded?: boolean
  now?: Date
}

function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000)))
}

export function computeGrowthOpportunityRisk(input: GrowthOpportunityRiskInput): {
  riskScore: number
  riskSignals: GrowthOpportunityRiskSignal[]
  isStale: boolean
} {
  const now = input.now ?? new Date()
  const signals: GrowthOpportunityRiskSignal[] = []
  let score = 0

  const idleDays = daysSince(input.lastActivityAt, now)
  if (idleDays >= input.staleActivityDays) {
    signals.push({ key: "no_activity", label: "No recent activity", weight: 25 })
    score += 25
  }

  if (input.followUpAt && Date.parse(input.followUpAt) < now.getTime()) {
    signals.push({ key: "overdue_follow_up", label: "Overdue follow-up", weight: 20 })
    score += 20
  }

  if (input.stageAgeDays >= input.staleStageDays && !input.stageKey.startsWith("closed_")) {
    signals.push({ key: "stale_stage", label: "Stale stage duration", weight: 20 })
    score += 20
  }

  if (input.ownerOverloaded) {
    signals.push({ key: "owner_overload", label: "Owner overloaded", weight: 15 })
    score += 15
  }

  if (input.engagementTrend === "declining" || input.engagementTrend === "cooling") {
    signals.push({ key: "engagement_drop", label: "Engagement drop", weight: 15 })
    score += 15
  }

  if (input.engagementTrend === "declining") {
    signals.push({ key: "lost_momentum", label: "Lost momentum", weight: 10 })
    score += 10
  }

  if (
    input.expectedCloseDate &&
    Date.parse(input.expectedCloseDate) < now.getTime() &&
    !input.stageKey.startsWith("closed_")
  ) {
    signals.push({ key: "close_date_passed", label: "Close date passed", weight: 25 })
    score += 25
  }

  const isStale =
    idleDays >= input.staleActivityDays ||
    (input.stageAgeDays >= input.staleStageDays && !input.stageKey.startsWith("closed_"))

  return {
    riskScore: Math.min(100, score),
    riskSignals: signals,
    isStale,
  }
}
