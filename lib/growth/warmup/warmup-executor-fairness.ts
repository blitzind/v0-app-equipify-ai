/** GS-GROWTH-WARMUP-FAIRNESS-1P — fair profile ordering + recipient pool planning (client-safe). */

import type {
  GrowthWarmupExecutorRunSkipReason,
  GrowthWarmupExecutorSenderResult,
  GrowthWarmupExecutorSkipCode,
} from "@/lib/growth/warmup/warmup-executor-types"
import {
  DEFAULT_WARMUP_EXECUTOR_TOTAL_SENDS_SAFETY_CAP,
  MAX_SENDS_PER_PROFILE_PER_RUN,
} from "@/lib/growth/warmup/warmup-executor-diagnostics"
import type { GrowthWarmupProfile } from "@/lib/growth/warmup/warmup-types"

export const GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER = "growth-warmup-fairness-1p-v1" as const

/** Same approved recipient may receive from different senders in one run; per-sender/recipient/day dedup stays in selector. */
export const WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY = "per_sender_daily" as const

export type WarmupSendCandidateSortContext = {
  now?: Date
  senderLastSendAt: Map<string, string | null>
}

function sendsTodayForProfile(profile: GrowthWarmupProfile, today: string): number {
  return profile.sends_today_date === today ? profile.sends_today : 0
}

function compareNullableTimestampAsc(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  const aTs = Date.parse(a)
  const bTs = Date.parse(b)
  if (!Number.isFinite(aTs) && !Number.isFinite(bTs)) return 0
  if (!Number.isFinite(aTs)) return -1
  if (!Number.isFinite(bTs)) return 1
  return aTs - bTs
}

export function compareWarmupSendCandidateProfiles(
  a: GrowthWarmupProfile,
  b: GrowthWarmupProfile,
  ctx: WarmupSendCandidateSortContext,
): number {
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10)
  const sendsDiff = sendsTodayForProfile(a, today) - sendsTodayForProfile(b, today)
  if (sendsDiff !== 0) return sendsDiff

  const lastSendDiff = compareNullableTimestampAsc(
    ctx.senderLastSendAt.get(a.sender_account_id),
    ctx.senderLastSendAt.get(b.sender_account_id),
  )
  if (lastSendDiff !== 0) return lastSendDiff

  const updatedDiff = compareNullableTimestampAsc(a.updated_at, b.updated_at)
  if (updatedDiff !== 0) return updatedDiff

  const createdDiff = compareNullableTimestampAsc(a.created_at, b.created_at)
  if (createdDiff !== 0) return createdDiff

  return a.id.localeCompare(b.id)
}

export function sortWarmupSendCandidateProfiles(
  profiles: GrowthWarmupProfile[],
  ctx: WarmupSendCandidateSortContext,
): GrowthWarmupProfile[] {
  return [...profiles].sort((a, b) => compareWarmupSendCandidateProfiles(a, b, ctx))
}

export function computeWarmupExecutorRunSendPlan(input: {
  eligibleProfileCount: number
  maxSendsOverride?: number
}): {
  maxSendsPerProfile: number
  maxTotalSends: number
  plannedSendsThisRun: number
  waitingProfilesThisRun: number
} {
  const naturalTotal = Math.max(0, input.eligibleProfileCount) * MAX_SENDS_PER_PROFILE_PER_RUN
  const cappedTotal = Math.min(naturalTotal, DEFAULT_WARMUP_EXECUTOR_TOTAL_SENDS_SAFETY_CAP)
  const maxTotalSends = input.maxSendsOverride ?? cappedTotal
  const plannedSendsThisRun = Math.min(naturalTotal, maxTotalSends)
  const waitingProfilesThisRun = Math.max(0, input.eligibleProfileCount - plannedSendsThisRun)
  return {
    maxSendsPerProfile: MAX_SENDS_PER_PROFILE_PER_RUN,
    maxTotalSends,
    plannedSendsThisRun,
    waitingProfilesThisRun,
  }
}

export function buildWarmupRecipientPoolPressureMessage(input: {
  activeApprovedRecipients: number
  eligibleProfiles: number
  plannedSendsThisRun: number
  waitingProfilesThisRun: number
  availableNow: number
}): string | null {
  if (input.eligibleProfiles <= 0) return null
  if (input.activeApprovedRecipients <= 0) {
    return "No approved warmup recipients configured."
  }

  const parts = [
    `${input.activeApprovedRecipients} approved recipient(s) available for ${input.eligibleProfiles} eligible sender(s).`,
    `${input.plannedSendsThisRun} send(s) planned this run.`,
  ]

  if (input.waitingProfilesThisRun > 0) {
    parts.push(
      `${input.waitingProfilesThisRun} sender(s) will wait this run (batch safety cap or remaining daily capacity).`,
    )
  } else if (input.activeApprovedRecipients < input.eligibleProfiles) {
    parts.push(
      "Recipients may receive from multiple senders this run; per-sender/recipient daily dedup still applies.",
    )
  }

  if (input.availableNow === 0 && input.activeApprovedRecipients > 0) {
    parts.push("All approved recipients reached daily or weekly caps.")
  } else if (
    input.availableNow > 0 &&
    input.activeApprovedRecipients > 0 &&
    input.activeApprovedRecipients < input.eligibleProfiles
  ) {
    parts.push(
      "Some senders may exhaust per-sender daily dedup before others — add more approved recipients than warming senders.",
    )
  }

  return parts.join(" ")
}

export function mergeWarmupExecutorRunSkipReasons(
  runLevel: GrowthWarmupExecutorRunSkipReason[],
  senderResults: GrowthWarmupExecutorSenderResult[],
): GrowthWarmupExecutorRunSkipReason[] {
  const merged = [...runLevel]
  const aggregated = new Map<
    GrowthWarmupExecutorSkipCode,
    { code: GrowthWarmupExecutorSkipCode; message: string; count: number; profiles: string[] }
  >()

  for (const result of senderResults) {
    if (result.skipped <= 0) continue
    for (const skip of result.skipReasons) {
      const existing = aggregated.get(skip.code) ?? {
        code: skip.code,
        message: skip.message,
        count: 0,
        profiles: [],
      }
      existing.count += 1
      if (!existing.profiles.includes(result.senderEmail)) {
        existing.profiles.push(result.senderEmail)
      }
      aggregated.set(skip.code, existing)
    }
  }

  for (const row of aggregated.values()) {
    merged.push({
      code: row.code,
      message: row.message,
      count: row.count,
      profiles: row.profiles,
    })
  }

  return merged
}
