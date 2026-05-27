import type { GrowthInboxPriorityTier } from "@/lib/growth/inbox/inbox-types"
import type { GrowthInboxSlaStatus } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

const SLA_HOURS: Record<GrowthInboxPriorityTier, number> = {
  critical: 4,
  high: 24,
  normal: 48,
  low: 72,
}

const AT_RISK_WINDOW_MS = 4 * 60 * 60 * 1000

export function computeInboxThreadSlaDueAt(
  anchorAt: string,
  priorityTier: GrowthInboxPriorityTier,
): string {
  const hours = SLA_HOURS[priorityTier] ?? SLA_HOURS.normal
  return new Date(new Date(anchorAt).getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function resolveInboxThreadSlaStatus(
  slaDueAt: string | null | undefined,
  now = Date.now(),
): GrowthInboxSlaStatus {
  if (!slaDueAt) return "ok"
  const dueMs = new Date(slaDueAt).getTime()
  if (Number.isNaN(dueMs)) return "ok"
  if (now > dueMs) return "overdue"
  if (dueMs - now <= AT_RISK_WINDOW_MS) return "at_risk"
  return "ok"
}

export function isInboxThreadSlaOverdue(slaDueAt: string | null | undefined, now = Date.now()): boolean {
  return resolveInboxThreadSlaStatus(slaDueAt, now) === "overdue"
}

export function isInboxReplyAging(lastMessageAt: string | null | undefined, now = Date.now(), thresholdHours = 24): boolean {
  if (!lastMessageAt) return false
  const ageMs = now - new Date(lastMessageAt).getTime()
  if (Number.isNaN(ageMs)) return false
  return ageMs >= thresholdHours * 60 * 60 * 1000
}

export function computeInboxThreadAgeHours(lastMessageAt: string | null | undefined, now = Date.now()): number {
  if (!lastMessageAt) return 0
  const ageMs = Math.max(0, now - new Date(lastMessageAt).getTime())
  return Math.round(ageMs / (60 * 60 * 1000))
}

export function formatInboxThreadAgeLabel(lastMessageAt: string | null | undefined): string {
  const hours = computeInboxThreadAgeHours(lastMessageAt)
  if (hours <= 0) return "—"
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
