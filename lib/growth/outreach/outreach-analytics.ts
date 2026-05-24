/** Pure analytics for Growth outreach execution dashboard. */

import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"

export function computeOutreachApprovalRate(items: GrowthOutreachQueueItem[]): number {
  const candidates = items.filter((item) =>
    ["approved", "scheduled", "executed", "failed", "cancelled"].includes(item.status),
  )
  if (candidates.length === 0) return 0
  const approved = candidates.filter((item) => item.approvedAt).length
  return Math.round((approved / candidates.length) * 100)
}

export function computeOutreachMedianTimeToApprovalMs(items: GrowthOutreachQueueItem[]): number | null {
  const deltas = items
    .filter((item) => item.approvedAt)
    .map((item) => Date.parse(item.approvedAt!) - Date.parse(item.createdAt))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
  if (deltas.length === 0) return null
  const mid = Math.floor(deltas.length / 2)
  return deltas.length % 2 === 0 ? Math.round((deltas[mid - 1]! + deltas[mid]!) / 2) : deltas[mid]!
}

export function computeOutreachExecutionRate(items: GrowthOutreachQueueItem[]): number {
  const approved = items.filter((item) => item.approvedAt)
  if (approved.length === 0) return 0
  const executed = approved.filter((item) => item.status === "executed").length
  return Math.round((executed / approved.length) * 100)
}

export function computeOutreachFailedExecutionRate(items: GrowthOutreachQueueItem[]): number {
  const attempts = items.filter((item) => item.status === "executed" || item.status === "failed")
  if (attempts.length === 0) return 0
  const failed = attempts.filter((item) => item.status === "failed").length
  return Math.round((failed / attempts.length) * 100)
}

export function computeOutreachRegenerationRate(items: GrowthOutreachQueueItem[]): number {
  if (items.length === 0) return 0
  const regenerated = items.filter((item) => item.parentQueueId || item.generationVersion > 1).length
  return Math.round((regenerated / items.length) * 100)
}

export function computeOutreachChannelMix(items: GrowthOutreachQueueItem[]): Array<{ channel: string; count: number }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.channel, (counts.get(item.channel) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeOutreachRegenerationHotspots(
  items: GrowthOutreachQueueItem[],
): Array<{ leadId: string; count: number; latestVersion: number }> {
  const byLead = new Map<string, { count: number; latestVersion: number }>()
  for (const item of items) {
    if (!item.parentQueueId && item.generationVersion <= 1) continue
    const existing = byLead.get(item.leadId) ?? { count: 0, latestVersion: 1 }
    existing.count += 1
    existing.latestVersion = Math.max(existing.latestVersion, item.generationVersion)
    byLead.set(item.leadId, existing)
  }
  return [...byLead.entries()]
    .map(([leadId, stats]) => ({ leadId, ...stats }))
    .sort((a, b) => b.count - a.count || b.latestVersion - a.latestVersion)
    .slice(0, 12)
}

export function computeOutreachExecutionConfidence(input: {
  leadScore: number | null
  engagementScore: number | null
  capacityTier: string | null
  channel: string
}): number {
  let score = 55
  if (input.leadScore != null) score += Math.round(input.leadScore * 0.2)
  if (input.engagementScore != null) score += Math.round(input.engagementScore * 0.15)
  if (input.capacityTier === "critical") score -= 25
  else if (input.capacityTier === "constrained") score -= 15
  else if (input.capacityTier === "strained") score -= 8
  if (input.channel !== "email") score += 10
  return Math.max(0, Math.min(100, score))
}

export function deriveOutreachQueuePriority(input: {
  callPriorityTier: string | null
  executivePriorityTier: string | null
}): "low" | "normal" | "high" | "critical" {
  if (input.executivePriorityTier === "executive_now") return "critical"
  if (input.callPriorityTier === "critical" || input.executivePriorityTier === "priority") return "high"
  if (input.callPriorityTier === "low") return "low"
  return "normal"
}
