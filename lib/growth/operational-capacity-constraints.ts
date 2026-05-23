import type {
  GrowthOperationalCapacityPlatformSnapshot,
  GrowthOperationalConstraint,
} from "@/lib/growth/operational-capacity-types"

const EXECUTIVE_OVERLOAD_THRESHOLD = 5
const CALL_QUEUE_THRESHOLD = 12
const FOLLOW_UP_THRESHOLD = 10
const DM_BACKLOG_THRESHOLD = 8
const ATTENTION_OVERLOAD_THRESHOLD = 10
const LEADERSHIP_LIMIT_THRESHOLD = 8
const INTERVENTION_LOAD_THRESHOLD = 4

export function detectOperationalConstraints(
  snapshot: GrowthOperationalCapacityPlatformSnapshot,
): GrowthOperationalConstraint[] {
  const constraints: GrowthOperationalConstraint[] = []

  if (snapshot.executiveNowCount >= EXECUTIVE_OVERLOAD_THRESHOLD) {
    constraints.push({
      key: "executive_overload",
      label: "Executive overload",
      severity: "critical",
    })
  }

  if (snapshot.callQueueLoadCount >= CALL_QUEUE_THRESHOLD) {
    constraints.push({
      key: "call_queue_backlog",
      label: "Call queue backlog",
      severity: snapshot.callQueueLoadCount >= CALL_QUEUE_THRESHOLD + 5 ? "critical" : "warning",
    })
  }

  if (snapshot.openFollowUpCount >= FOLLOW_UP_THRESHOLD) {
    constraints.push({
      key: "follow_up_backlog",
      label: "Follow-up backlog",
      severity: "warning",
    })
  }

  if (snapshot.decisionMakerBacklogCount >= DM_BACKLOG_THRESHOLD) {
    constraints.push({
      key: "decision_maker_backlog",
      label: "Decision maker backlog",
      severity: "warning",
    })
  }

  if (snapshot.forecastAttentionCount >= ATTENTION_OVERLOAD_THRESHOLD) {
    constraints.push({
      key: "high_attention_overload",
      label: "High attention overload",
      severity: "critical",
    })
  }

  if (snapshot.leadershipBottleneckCount >= LEADERSHIP_LIMIT_THRESHOLD) {
    constraints.push({
      key: "leadership_capacity_limit",
      label: "Leadership capacity limit",
      severity: "critical",
    })
  }

  if (
    snapshot.interventionAgingCount + snapshot.interventionStalledCount >=
    INTERVENTION_LOAD_THRESHOLD
  ) {
    constraints.push({
      key: "critical_intervention_load",
      label: "Critical intervention load",
      severity: "critical",
    })
  }

  return constraints
}

export function buildOperationalCapacityTopConstraints(
  snapshot: GrowthOperationalCapacityPlatformSnapshot,
  constraints: GrowthOperationalConstraint[],
): Array<{ kind: string; label: string; pressure: number }> {
  const entries = [
    { kind: "executive_now", label: "Executive now load", pressure: snapshot.executiveNowCount * 4 },
    { kind: "call_queue", label: "Call queue load", pressure: snapshot.callQueueLoadCount * 3 },
    { kind: "follow_up", label: "Open follow-ups", pressure: snapshot.openFollowUpCount * 2 },
    {
      kind: "intervention",
      label: "Intervention backlog",
      pressure: (snapshot.interventionAgingCount + snapshot.interventionStalledCount) * 5,
    },
    {
      kind: "leadership",
      label: "Leadership bottlenecks",
      pressure: snapshot.leadershipBottleneckCount * 4,
    },
    {
      kind: "decision_maker",
      label: "Decision maker backlog",
      pressure: snapshot.decisionMakerBacklogCount * 3,
    },
    ...constraints.map((constraint) => ({
      kind: constraint.key,
      label: constraint.label,
      pressure: constraint.severity === "critical" ? 20 : 12,
    })),
  ]

  return [...entries].sort((a, b) => b.pressure - a.pressure).slice(0, 4)
}

export function computePlatformPressureLevel(
  snapshot: GrowthOperationalCapacityPlatformSnapshot,
  constraints: GrowthOperationalConstraint[],
): number {
  let pressure = 0
  pressure += Math.min(25, snapshot.executiveNowCount * 4)
  pressure += Math.min(20, snapshot.callQueueLoadCount * 2)
  pressure += Math.min(15, snapshot.openFollowUpCount * 1.5)
  pressure += Math.min(15, snapshot.interventionAgingCount * 3 + snapshot.interventionStalledCount * 5)
  pressure += Math.min(12, snapshot.priorityOpportunityCount * 2)
  pressure += Math.min(12, snapshot.leadershipBottleneckCount * 2)
  pressure += Math.min(10, snapshot.manualTouchBacklogCount * 2)
  pressure += Math.min(10, snapshot.decisionMakerBacklogCount * 2)
  pressure += Math.min(10, snapshot.hotOpportunityCount * 1.5)
  pressure += Math.min(15, constraints.filter((entry) => entry.severity === "critical").length * 8)
  pressure += Math.min(10, constraints.filter((entry) => entry.severity === "warning").length * 4)
  return Math.min(100, Math.round(pressure))
}
