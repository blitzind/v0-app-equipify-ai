import type { GrowthEngagementSignalKind } from "@/lib/growth/engagement-types"

export const ENGAGEMENT_SIGNAL_BASE_POINTS: Record<GrowthEngagementSignalKind, number> = {
  email_open: 3,
  email_click: 8,
  email_reply: 15,
  positive_reply: 25,
  call_connected: 20,
  manual_touch: 12,
  follow_up_completed: 10,
  decision_maker_confirmed: 15,
  research_completed: 8,
  unsubscribe: -40,
  not_interested: -30,
  bounce: -25,
  suppression: -50,
}

export const ENGAGEMENT_SIGNAL_HALF_LIFE_DAYS: Partial<Record<GrowthEngagementSignalKind, number>> = {
  email_open: 14,
  email_click: 14,
  email_reply: 30,
  positive_reply: 30,
  call_connected: 21,
  manual_touch: 21,
  follow_up_completed: 21,
  decision_maker_confirmed: 60,
  research_completed: 45,
  not_interested: 90,
}

const PERMANENT_NEGATIVE = new Set<GrowthEngagementSignalKind>(["unsubscribe", "bounce", "suppression"])

export function daysSince(iso: string, now: Date): number {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
}

export function decayEngagementSignalPoints(
  kind: GrowthEngagementSignalKind,
  occurredAt: string,
  now: Date,
): number {
  const base = ENGAGEMENT_SIGNAL_BASE_POINTS[kind]
  if (PERMANENT_NEGATIVE.has(kind)) return base
  const halfLife = ENGAGEMENT_SIGNAL_HALF_LIFE_DAYS[kind] ?? 30
  const elapsed = daysSince(occurredAt, now)
  return base * 0.5 ** (elapsed / halfLife)
}

export function applyEngagementIdlePenalty(
  score: number,
  lastPositiveActivityAt: string | null,
  dormancyExemptUntil: string | null,
  now: Date,
): number {
  if (dormancyExemptUntil && Date.parse(dormancyExemptUntil) > now.getTime()) {
    return score
  }
  if (!lastPositiveActivityAt) return score - 12
  const idleDays = daysSince(lastPositiveActivityAt, now)
  if (idleDays <= 30) return score
  return score - Math.min(25, Math.floor(idleDays - 30))
}

export function isEngagementDormant(
  lastActivityAt: string | null,
  dormancyExemptUntil: string | null,
  now: Date,
  thresholdDays = 30,
): boolean {
  if (dormancyExemptUntil && Date.parse(dormancyExemptUntil) > now.getTime()) {
    return false
  }
  if (!lastActivityAt) return true
  return daysSince(lastActivityAt, now) > thresholdDays
}
