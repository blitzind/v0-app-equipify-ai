import type {
  GrowthCommandAction,
  GrowthCommandBossBattle,
  GrowthCommandBossBattleKind,
  GrowthCommandHeatBucket,
  GrowthCommandHeatMapBucket,
} from "@/lib/growth/command/command-action-types"

const BOSS_TITLES: Record<GrowthCommandBossBattleKind, string> = {
  revenue_rescue: "Revenue Rescue",
  sequence_cleanup: "Sequence Cleanup",
  executive_attention: "Executive Attention",
  follow_up_sprint: "Follow-Up Sprint",
}

export function buildBossBattles(actions: GrowthCommandAction[]): GrowthCommandBossBattle[] {
  const kinds: GrowthCommandBossBattleKind[] = [
    "revenue_rescue",
    "sequence_cleanup",
    "executive_attention",
    "follow_up_sprint",
  ]

  return kinds.map((kind) => {
    const battleActions = actions.filter((action) => action.bossBattle === kind)
    const effortMinutes = battleActions.reduce((sum, action) => sum + action.effortMinutes, 0)
    const pipelineInfluence = battleActions.reduce((sum, action) => sum + action.revenueInfluence, 0)
    const difficulty =
      battleActions.length >= 8 || pipelineInfluence >= 400
        ? "critical"
        : battleActions.length >= 5
          ? "hard"
          : battleActions.length >= 2
            ? "medium"
            : "easy"

    return {
      kind,
      title: BOSS_TITLES[kind],
      difficulty,
      actionsRequired: battleActions.length,
      effortMinutes,
      pipelineInfluence,
      actionIds: battleActions.slice(0, 10).map((action) => action.id),
    }
  })
}

type HeatLead = {
  id: string
  engagementTier?: string | null
  opportunityReadinessTier?: string | null
  revenueProbabilityScore?: number | null
  conversationHealthTier?: string | null
  relationshipTrend?: string | null
  revenueTrajectory?: string | null
}

export function buildHeatMap(leads: HeatLead[]): GrowthCommandHeatMapBucket[] {
  const buckets: Record<GrowthCommandHeatBucket, string[]> = {
    hot: [],
    warm: [],
    cool: [],
    at_risk: [],
  }

  for (const lead of leads) {
    const bucket = classifyHeatBucket(lead)
    buckets[bucket].push(lead.id)
  }

  return (["hot", "warm", "cool", "at_risk"] as GrowthCommandHeatBucket[]).map((bucket) => ({
    bucket,
    count: buckets[bucket].length,
    leadIds: buckets[bucket].slice(0, 20),
  }))
}

function classifyHeatBucket(lead: HeatLead): GrowthCommandHeatBucket {
  if (
    lead.revenueTrajectory === "at_risk" ||
    lead.conversationHealthTier === "critical" ||
    lead.relationshipTrend === "cooling"
  ) {
    return "at_risk"
  }
  if (
    lead.engagementTier === "hot" ||
    lead.opportunityReadinessTier === "priority_opportunity" ||
    (lead.revenueProbabilityScore ?? 0) >= 70
  ) {
    return "hot"
  }
  if (
    lead.engagementTier === "warm" ||
    lead.opportunityReadinessTier === "sales_ready" ||
    (lead.revenueProbabilityScore ?? 0) >= 45
  ) {
    return "warm"
  }
  return "cool"
}

export function buildCoachTips(input: {
  approvalsWaiting: number
  revenueRescueCount: number
  researchActions: number
  executionActions: number
  relationshipRecoveryCount: number
  relationshipRecoveryCompleted: number
}): Array<{ id: string; message: string; priority: "high" | "medium" | "low" }> {
  const tips: Array<{ id: string; message: string; priority: "high" | "medium" | "low" }> = []

  if (input.approvalsWaiting >= 5) {
    tips.push({
      id: "approval-backlog",
      message: "Approval backlog is growing. Start with Outreach Approval.",
      priority: "high",
    })
  }
  if (input.revenueRescueCount >= 3) {
    tips.push({
      id: "revenue-rescue",
      message: "Revenue Rescue has the highest impact right now.",
      priority: "high",
    })
  }
  if (input.researchActions > input.executionActions + 2) {
    tips.push({
      id: "research-heavy",
      message: "Too many research tasks compared to execution tasks.",
      priority: "medium",
    })
  }
  if (input.relationshipRecoveryCount > 0 && input.relationshipRecoveryCompleted === 0) {
    tips.push({
      id: "relationship-untouched",
      message: "Relationship recovery actions are under-touched today.",
      priority: "medium",
    })
  }

  if (tips.length === 0) {
    tips.push({
      id: "steady",
      message: "Pipeline is stable. Start a Focus Sprint to protect momentum.",
      priority: "low",
    })
  }

  return tips
}

export function detectComboChains(todayEventTypes: string[][]): Array<{ id: string; label: string; bonusPoints: number; completed: boolean }> {
  const flat = todayEventTypes.flat()
  const has = (event: string) => flat.includes(event)

  return [
    {
      id: "research-dm-call",
      label: "Research completed → DM added → call logged",
      bonusPoints: 40,
      completed: has("research_completed") && has("decision_maker_added") && (has("call_started") || has("call_attempted")),
    },
    {
      id: "sequence-outreach-executed",
      label: "Sequence confirmed → outreach approved → executed",
      bonusPoints: 50,
      completed:
        has("sequence_enrollment_created") &&
        has("outreach_approved") &&
        has("outreach_executed"),
    },
    {
      id: "relationship-follow-up",
      label: "Relationship recovery → follow-up completed",
      bonusPoints: 35,
      completed: has("relationship_cooled") && has("follow_up_completed"),
    },
  ]
}
