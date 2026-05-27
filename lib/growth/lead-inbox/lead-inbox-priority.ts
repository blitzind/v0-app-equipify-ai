import type {
  GrowthLeadInboxRow,
  GrowthLeadInboxStatus,
} from "@/lib/growth/lead-inbox/lead-inbox-types"

function growthSignalScoreFromMetadata(metadata: Record<string, unknown>): number {
  const growthSignals = metadata.growth_signals
  if (!growthSignals || typeof growthSignals !== "object") return 0
  const score = (growthSignals as Record<string, unknown>).growth_signal_score
  return typeof score === "number" ? score : 0
}

const PRIORITY_RANK: Record<GrowthLeadInboxRow["candidate_priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

const ACTIVE_STATUSES = new Set<GrowthLeadInboxStatus>([
  "new",
  "reviewing",
  "approved",
  "enriching",
  "running_pipeline",
])

export function compareLeadInboxPriority(a: GrowthLeadInboxRow, b: GrowthLeadInboxRow): number {
  const priorityDelta = PRIORITY_RANK[a.candidate_priority] - PRIORITY_RANK[b.candidate_priority]
  if (priorityDelta !== 0) return priorityDelta

  const scoreDelta = b.intent_score - a.intent_score
  if (scoreDelta !== 0) return scoreDelta

  const growthDelta =
    growthSignalScoreFromMetadata(b.metadata) - growthSignalScoreFromMetadata(a.metadata)
  if (growthDelta !== 0) return growthDelta

  const confidenceDelta = b.candidate_confidence - a.candidate_confidence
  if (confidenceDelta !== 0) return confidenceDelta

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export function sortLeadInboxQueue(items: GrowthLeadInboxRow[]): GrowthLeadInboxRow[] {
  return [...items].sort(compareLeadInboxPriority)
}

export function filterActiveLeadInboxItems(items: GrowthLeadInboxRow[]): GrowthLeadInboxRow[] {
  return items.filter((item) => ACTIVE_STATUSES.has(item.status))
}

export function inboxPriorityLabel(priority: GrowthLeadInboxRow["candidate_priority"]): string {
  if (priority === "urgent") return "Urgent"
  if (priority === "high") return "High"
  if (priority === "normal") return "Normal"
  return "Low"
}
