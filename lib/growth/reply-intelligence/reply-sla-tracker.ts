import type { GrowthReplyPriority } from "@/lib/growth/reply-intelligence/reply-intent-types"

const SLA_HOURS: Record<GrowthReplyPriority, number> = {
  critical: 4,
  high: 24,
  medium: 48,
  low: 72,
}

export function computeReplySlaDueAt(receivedAt: string, priority: GrowthReplyPriority): string {
  const hours = SLA_HOURS[priority]
  return new Date(new Date(receivedAt).getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function isReplyOverdue(receivedAt: string, priority: GrowthReplyPriority, now = Date.now()): boolean {
  const dueAt = new Date(computeReplySlaDueAt(receivedAt, priority)).getTime()
  return now > dueAt
}

export function computeOwnerResponseGapMs(receivedAt: string, now = Date.now()): number {
  return Math.max(0, now - new Date(receivedAt).getTime())
}
