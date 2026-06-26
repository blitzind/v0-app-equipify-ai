/** GS-WARMUP-FIX-1B — Capacity-aware warmup planning engine (client-safe). */

import type { GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"
import { WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY } from "@/lib/growth/warmup/warmup-executor-fairness"

export const GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER = "growth-warmup-capacity-fix-1b-v1" as const

export const WARMUP_CAPACITY_STATUSES = ["healthy", "constrained", "impossible"] as const

export type WarmupCapacityStatus = (typeof WARMUP_CAPACITY_STATUSES)[number]

/** Reserved for future dedup / rotation policies — no behavior change in 1B. */
export type WarmupCapacityDedupPolicy =
  | typeof WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY
  | "repeat_after_days"
  | "repeat_after_hours"
  | "weighted_rotation"
  | "randomized_pairing"
  | "configurable_window"

export type WarmupSenderCapacitySnapshot = {
  profileId: string
  senderEmail: string
  profileStatus: GrowthWarmupProfileStatus
  approvedRecipients: number
  recipientsUsedToday: number
  recipientsRemaining: number
  remainingVolumeToday: number
  maxAdditionalSendsToday: number
}

export type WarmupDailyCapacityPlan = {
  qaMarker: typeof GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER
  dedupPolicy: WarmupCapacityDedupPolicy
  warmingSenders: number
  approvedRecipients: number
  totalPlannedToday: number
  totalAchievableToday: number
  totalTheoreticalMaximumToday: number
  expectedMaxToday: number
  capacityShortfall: number
  status: WarmupCapacityStatus
  statusReason: string
  recommendation: string | null
  senders: WarmupSenderCapacitySnapshot[]
}

export function buildWarmupSenderCapacitySnapshot(input: {
  profileId: string
  senderEmail: string
  profileStatus: GrowthWarmupProfileStatus
  approvedRecipients: number
  recipientsUsedToday: number
  recipientsRemaining: number
  remainingVolumeToday: number
}): WarmupSenderCapacitySnapshot {
  const maxAdditionalSendsToday = Math.max(
    0,
    Math.min(input.remainingVolumeToday, input.recipientsRemaining),
  )
  return {
    profileId: input.profileId,
    senderEmail: input.senderEmail,
    profileStatus: input.profileStatus,
    approvedRecipients: input.approvedRecipients,
    recipientsUsedToday: input.recipientsUsedToday,
    recipientsRemaining: input.recipientsRemaining,
    remainingVolumeToday: input.remainingVolumeToday,
    maxAdditionalSendsToday,
  }
}

export function computeWarmupCapacityStatus(input: {
  totalPlannedToday: number
  totalAchievableToday: number
  totalTheoreticalMaximumToday: number
  approvedRecipients: number
  warmingSenders: number
}): Pick<WarmupDailyCapacityPlan, "status" | "statusReason" | "recommendation"> {
  const { totalPlannedToday, totalAchievableToday, totalTheoreticalMaximumToday } = input

  if (input.approvedRecipients === 0) {
    return {
      status: "impossible",
      statusReason: "No approved warmup recipients configured.",
      recommendation: "Add and approve warmup recipients before expecting executor sends.",
    }
  }

  if (input.warmingSenders === 0) {
    return {
      status: "healthy",
      statusReason: "No warming senders — daily volume targets do not apply yet.",
      recommendation: null,
    }
  }

  if (totalPlannedToday <= totalAchievableToday) {
    return {
      status: "healthy",
      statusReason: "Today's planned warmup volume is achievable with the current recipient network.",
      recommendation: null,
    }
  }

  if (totalAchievableToday === 0) {
    return {
      status: "impossible",
      statusReason:
        "Today's planned volume cannot be delivered — no unique recipients remain under per-sender daily dedup.",
      recommendation: "Increase approved recipient pool or wait for dedup windows to reset.",
    }
  }

  return {
    status: "constrained",
    statusReason: `Per-sender daily dedup limits each sender to ${input.approvedRecipients} unique recipient(s) — planned volume exceeds achievable sends today.`,
    recommendation: "Increase approved recipient pool.",
  }
}

export function aggregateWarmupDailyCapacityPlan(input: {
  senders: WarmupSenderCapacitySnapshot[]
  approvedRecipients: number
  dedupPolicy?: WarmupCapacityDedupPolicy
}): WarmupDailyCapacityPlan {
  const warmingSenders = input.senders.filter((sender) => sender.profileStatus === "warming")
  const totalPlannedToday = warmingSenders.reduce((sum, sender) => sum + sender.remainingVolumeToday, 0)
  const totalAchievableToday = warmingSenders.reduce((sum, sender) => sum + sender.maxAdditionalSendsToday, 0)
  const totalTheoreticalMaximumToday = warmingSenders.reduce(
    (sum, sender) => sum + Math.min(sender.remainingVolumeToday, input.approvedRecipients),
    0,
  )
  const expectedMaxToday = totalAchievableToday
  const capacityShortfall = Math.max(0, totalPlannedToday - totalAchievableToday)
  const statusFields = computeWarmupCapacityStatus({
    totalPlannedToday,
    totalAchievableToday,
    totalTheoreticalMaximumToday,
    approvedRecipients: input.approvedRecipients,
    warmingSenders: warmingSenders.length,
  })

  return {
    qaMarker: GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER,
    dedupPolicy: input.dedupPolicy ?? WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY,
    warmingSenders: warmingSenders.length,
    approvedRecipients: input.approvedRecipients,
    totalPlannedToday,
    totalAchievableToday,
    totalTheoreticalMaximumToday,
    expectedMaxToday,
    capacityShortfall,
    ...statusFields,
    senders: input.senders,
  }
}

export function formatWarmupCapacityStatusLabel(status: WarmupCapacityStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy"
    case "constrained":
      return "Constrained"
    case "impossible":
      return "Impossible"
    default:
      return status
  }
}
