/** Client-safe Growth Command Center types. */

export const GROWTH_COMMAND_CENTER_QA_MARKER = "command-center-v2" as const
export const GROWTH_COMMAND_CENTER_SPACING_QA_MARKER = "command-center-v2-spacing-polish" as const
export const GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER = "command-center-daily-workspace-v1" as const

/** Maps internal 0–100 impact scores to operator-facing 1–10 badges. */
export function displayCommandActionImpact(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score / 10)))
}

export function commandActionImpactTone(score: number): "critical" | "high" | "neutral" {
  const display = displayCommandActionImpact(score)
  if (display >= 9) return "critical"
  if (display >= 6) return "high"
  return "neutral"
}

export const GROWTH_COMMAND_ACTION_KINDS = [
  "executive_intervention",
  "revenue_rescue",
  "confirm_sequence",
  "queue_sequence_step",
  "approve_outreach",
  "review_draft",
  "start_call_copilot",
  "follow_up_now",
  "conversation_recovery",
  "relationship_recovery",
  "add_decision_maker",
  "run_research",
  "capacity_action",
] as const

export type GrowthCommandActionKind = (typeof GROWTH_COMMAND_ACTION_KINDS)[number]

export const GROWTH_COMMAND_BOSS_BATTLES = [
  "revenue_rescue",
  "sequence_cleanup",
  "executive_attention",
  "follow_up_sprint",
] as const

export type GrowthCommandBossBattleKind = (typeof GROWTH_COMMAND_BOSS_BATTLES)[number]

export const GROWTH_COMMAND_MOMENTUM_STATES = [
  "momentum_building",
  "execution_slipping",
  "revenue_at_risk",
  "stable",
] as const

export type GrowthCommandMomentumState = (typeof GROWTH_COMMAND_MOMENTUM_STATES)[number]

export const GROWTH_COMMAND_OPERATOR_RANKS = [
  "new_operator",
  "coordinator",
  "growth_builder",
  "revenue_operator",
  "pipeline_commander",
  "execution_master",
] as const

export type GrowthCommandOperatorRank = (typeof GROWTH_COMMAND_OPERATOR_RANKS)[number]

export const GROWTH_COMMAND_HEAT_BUCKETS = ["hot", "warm", "cool", "at_risk"] as const

export type GrowthCommandHeatBucket = (typeof GROWTH_COMMAND_HEAT_BUCKETS)[number]

export type GrowthCommandAction = {
  id: string
  kind: GrowthCommandActionKind
  bossBattle: GrowthCommandBossBattleKind | null
  leadId: string
  companyName: string
  title: string
  why: string
  impactScore: number
  effortMinutes: number
  revenueInfluence: number
  ctaLabel: string
  ctaHref: string
  referenceId?: string | null
}

export type GrowthCommandBossBattle = {
  kind: GrowthCommandBossBattleKind
  title: string
  difficulty: "easy" | "medium" | "hard" | "critical"
  actionsRequired: number
  effortMinutes: number
  pipelineInfluence: number
  actionIds: string[]
}

export type GrowthCommandMissionControl = {
  criticalActions: number
  revenueAtRisk: number
  approvalsWaiting: number
  stalledOpportunities: number
  pipelineProtected: number
  unassignedHighPriority: number
  ownershipGaps: number
  momentumState: GrowthCommandMomentumState
  momentumLabel: string
}

export type GrowthCommandPipelineRings = {
  execution: { current: number; target: number; label: string }
  protection: { current: number; target: number; label: string }
  growth: { current: number; target: number; label: string }
}

export type GrowthCommandHeatMapBucket = {
  bucket: GrowthCommandHeatBucket
  count: number
  leadIds: string[]
}

export type GrowthCommandWinFeedItem = {
  id: string
  label: string
  companyName: string
  occurredAt: string
}

export type GrowthCommandComboChain = {
  id: string
  label: string
  bonusPoints: number
  completed: boolean
}

export type GrowthCommandCoachTip = {
  id: string
  message: string
  priority: "high" | "medium" | "low"
}

export type GrowthCommandDebrief = {
  impactScore: number
  actionsCompleted: number
  sequencesAdvanced: number
  relationshipsRecovered: number
  pipelineProtected: number
  tomorrowTopActions: GrowthCommandAction[]
}

import type { GrowthResearchCoverageSummary } from "@/lib/growth/research/research-types"
import type { DealIntelligenceDashboardSummary } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import type { CallIntelligenceDashboardSummary } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthCommandMarketHealth } from "@/lib/growth/market-intelligence/market-intelligence-types"
import type { CommandCenterSignalMomentumSummary } from "@/lib/growth/signals/integrations/command-center-bridge"
import type {
  CommandCenterHiringMetrics,
  CommandCenterWatchlistMetrics,
} from "@/lib/growth/signals/integrations/command-center-bridge"
import type { GrowthSignalCopilotCommandBriefingClient } from "@/lib/growth/signals/ai/signal-copilot-client-types"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type { TopProspectOpportunityCard } from "@/lib/growth/prospect-discovery/prospect-recommendation-types"

export type GrowthCommandSignalIntelligenceSummary = CommandCenterSignalMomentumSummary & {
  hiring: CommandCenterHiringMetrics
  watchlist: CommandCenterWatchlistMetrics
  ai_briefing?: GrowthSignalCopilotCommandBriefingClient | null
}

export type GrowthCommandDashboard = {
  generatedAt: string
  missionControl: GrowthCommandMissionControl
  topWinOpportunity: GrowthCommandAction | null
  actions: GrowthCommandAction[]
  pipelineRings: GrowthCommandPipelineRings
  bossBattles: GrowthCommandBossBattle[]
  revenueRescueQueue: GrowthCommandAction[]
  heatMap: GrowthCommandHeatMapBucket[]
  operatorScore: number
  operatorRank: GrowthCommandOperatorRank
  operatorRankLabel: string
  comboChains: GrowthCommandComboChain[]
  coachTips: GrowthCommandCoachTip[]
  winFeed: GrowthCommandWinFeedItem[]
  debrief: GrowthCommandDebrief
  todayStats: {
    actionsCompleted: number
    sequencesAdvanced: number
    relationshipsRecovered: number
    forecastProtected: number
    researchCompleted: number
    outreachExecuted: number
  }
  researchCoverage: GrowthResearchCoverageSummary
  dealIntelligence: DealIntelligenceDashboardSummary
  callIntelligence: CallIntelligenceDashboardSummary
  marketHealth: GrowthCommandMarketHealth
  signalIntelligence: GrowthCommandSignalIntelligenceSummary
  hotSignalFeed: GrowthSignalFeedItem[]
  topProspectOpportunities: TopProspectOpportunityCard[]
}
