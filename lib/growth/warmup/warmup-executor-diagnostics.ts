/** GS-GROWTH-WARMUP-EXECUTOR-1B — client-safe executor eligibility diagnostics. */

import type {
  GrowthWarmupExecutorSkipCode,
  WarmupExecutorProfileDiagnostic,
  WarmupExecutorRunSummary,
} from "@/lib/growth/warmup/warmup-executor-types"
import { isWithinWarmupSendingWindow } from "@/lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"
import { isWarmupThrottleLikelyClearable } from "@/lib/growth/warmup/warmup-reputation-throttle-policy"
import { evaluateWarmupExecutorSenderHealthGate } from "@/lib/growth/warmup/warmup-sender-health-gate"

export const GROWTH_WARMUP_EXECUTOR_1B_QA_MARKER = "growth-warmup-executor-1b-v1" as const
export const GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER = "growth-warmup-executor-1f-v1" as const
export { GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER } from "@/lib/growth/warmup/warmup-sender-health-gate"

/** GS-GROWTH-WARMUP-EXECUTOR-1E — one send attempt per warming profile per manual/cron run. */
export const MAX_SENDS_PER_PROFILE_PER_RUN = 1 as const

/** Platform safety ceiling when eligible profile count is extremely high. */
export const DEFAULT_WARMUP_EXECUTOR_TOTAL_SENDS_SAFETY_CAP = 100 as const

export function computeWarmupExecutorRunSendPlan(input: {
  eligibleProfileCount: number
  maxSendsOverride?: number
}): {
  maxSendsPerProfile: number
  maxTotalSends: number
  plannedSendsThisRun: number
} {
  const naturalTotal = Math.max(0, input.eligibleProfileCount) * MAX_SENDS_PER_PROFILE_PER_RUN
  const cappedTotal = Math.min(naturalTotal, DEFAULT_WARMUP_EXECUTOR_TOTAL_SENDS_SAFETY_CAP)
  const maxTotalSends = input.maxSendsOverride ?? cappedTotal
  return {
    maxSendsPerProfile: MAX_SENDS_PER_PROFILE_PER_RUN,
    maxTotalSends,
    plannedSendsThisRun: Math.min(naturalTotal, maxTotalSends),
  }
}

export function buildWarmupExecutorPacingMessage(input: {
  eligibleProfiles: number
  plannedSendsThisRun: number
  plannedTodayPerMailbox?: number | null
  representativeRemainingToday?: number | null
}): string {
  if (input.eligibleProfiles === 0) {
    return "All eligible profiles reached today's warmup target."
  }

  const parts = [
    `${input.eligibleProfiles} profile(s) eligible.`,
    `Would send up to ${input.plannedSendsThisRun} warmup message(s) now.`,
    "Manual runs send immediately (1 per eligible mailbox). Cron sends hourly during UTC 13–21.",
  ]
  if (input.representativeRemainingToday != null && input.representativeRemainingToday > 0) {
    parts.push(`Each mailbox has ${input.representativeRemainingToday} remaining today.`)
  } else if (input.plannedTodayPerMailbox != null && input.plannedTodayPerMailbox > 0) {
    parts.push(`Today's target remains ${input.plannedTodayPerMailbox} per mailbox.`)
  }
  return parts.join(" ")
}

export type { WarmupExecutorProfileDiagnostic, WarmupExecutorRunSummary }

/** Profiles the executor scans (dashboard-visible, non-disabled). */
export const WARMUP_EXECUTOR_SCANNABLE_STATUSES: GrowthWarmupProfileStatus[] = [
  "new",
  "warming",
  "active",
  "throttled",
  "paused",
]

export function isWarmupExecutorScannableProfile(profile: GrowthWarmupProfile): boolean {
  return profile.status !== "disabled" && WARMUP_EXECUTOR_SCANNABLE_STATUSES.includes(profile.status)
}

export function isWarmupExecutorSendEligibleStatus(status: GrowthWarmupProfileStatus): boolean {
  return status === "warming"
}

export function describeWarmupExecutorProfileDiagnostic(input: {
  profile: GrowthWarmupProfile
  remainingCapacity: number
  approvedRecipientCount: number
  enforceSendingWindow?: boolean
  now?: Date
  senderAccount?: {
    status: string
    health_status: string
  } | null
}): WarmupExecutorProfileDiagnostic {
  const { profile, remainingCapacity, approvedRecipientCount } = input
  const throttleReason = profile.throttle_reason ?? null
  const senderHealthStatus = input.senderAccount?.health_status ?? profile.sender_account_health_status ?? null
  const base = {
    profileId: profile.id,
    senderEmail: profile.sender_email,
    profileStatus: profile.status,
    remainingCapacity,
    throttleReason,
    senderHealthStatus,
  }

  if (profile.status === "paused") {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "warmup_paused",
      reason: "Warmup profile is paused by operator.",
      nextAction: "Resume warmup from the profile row or Warmup dashboard.",
    }
  }

  if (profile.status === "throttled") {
    const likelyClearable = isWarmupThrottleLikelyClearable({
      profileStatus: profile.status,
      profileWarmupHealth: profile.warmup_health,
      senderStatus: input.senderAccount?.status ?? profile.sender_account_status ?? null,
      senderHealthStatus,
    })
    const throttleLabel = throttleReason ?? "reputation protection active"
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "warmup_throttled",
      reason: likelyClearable
        ? `Skipped — reputation throttle: ${throttleLabel}`
        : `Skipped — reputation throttle: ${throttleLabel}`,
      nextAction: likelyClearable
        ? "Run Clear Throttle to re-evaluate reputation — controlled warmup may be allowed."
        : "Resolve the reputation issue before clearing throttle.",
      throttleClearable: likelyClearable,
    }
  }

  if (profile.status === "new") {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "pre_send_blocked",
      reason: "Warmup schedule not started.",
      nextAction: "Generate warmup schedule for this sender.",
    }
  }

  if (profile.status === "active") {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "warmup_cap_exhausted",
      reason: "Warmup completed — profile is active.",
      nextAction: "No executor sends needed; use normal outbound sequences.",
    }
  }

  if (profile.status === "disabled") {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "pre_send_blocked",
      reason: "Warmup profile is disabled.",
      nextAction: "Re-enable warmup or create a new profile.",
    }
  }

  if (profile.status !== "warming") {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "warmup_throttled",
      reason: `Profile status is ${profile.status}.`,
      nextAction: "Review warmup profile status on the dashboard.",
    }
  }

  if (remainingCapacity <= 0) {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "warmup_cap_exhausted",
      reason: "Daily warmup cap already met for today.",
      nextAction: "Wait until tomorrow or confirm real outbound sends counted toward cap.",
    }
  }

  if (approvedRecipientCount <= 0) {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "no_approved_recipients",
      reason: "No approved warmup recipients configured.",
      nextAction: "Add and approve at least one warmup recipient below.",
    }
  }

  const enforceWindow = input.enforceSendingWindow ?? false
  if (enforceWindow && !isWithinWarmupSendingWindow(input.now)) {
    return {
      ...base,
      eligibility: "skipped",
      skipCode: "outside_sending_window",
      reason: "Outside conservative executor sending window (UTC 13–21).",
      nextAction: "Manual preview works anytime; cron sends during business hours UTC.",
    }
  }

  if (input.senderAccount || senderHealthStatus) {
    const gate = evaluateWarmupExecutorSenderHealthGate({
      senderStatus: input.senderAccount?.status ?? profile.sender_account_status ?? null,
      senderHealthStatus,
      profileStatus: profile.status,
      warmupHealth: profile.warmup_health,
    })

    if (!gate.allowed) {
      return {
        ...base,
        eligibility: "skipped",
        skipCode: gate.skipCode ?? "sender_unhealthy",
        reason: gate.message ?? "Sender health blocked warmup send.",
        nextAction: gate.nextAction ?? "Review sender health before warmup continues.",
        controlledWarmupAllowed: false,
        senderHealthNote: gate.senderHealthNote,
      }
    }

    const capacityReason = `Eligible: ${remainingCapacity} remaining today; next run can send ${MAX_SENDS_PER_PROFILE_PER_RUN}.`
    return {
      ...base,
      eligibility: "eligible",
      skipCode: null,
      reason: gate.controlledWarmupAllowed
        ? `${capacityReason} ${gate.senderHealthNote ?? ""}`.trim()
        : capacityReason,
      nextAction: `Next run can send up to ${MAX_SENDS_PER_PROFILE_PER_RUN} warmup message.`,
      controlledWarmupAllowed: gate.controlledWarmupAllowed,
      senderHealthNote: gate.senderHealthNote,
    }
  }

  return {
    ...base,
    eligibility: "eligible",
    skipCode: null,
    reason: `Eligible: ${remainingCapacity} remaining today; next run can send ${MAX_SENDS_PER_PROFILE_PER_RUN}.`,
    nextAction: `Next run can send up to ${MAX_SENDS_PER_PROFILE_PER_RUN} warmup message.`,
  }
}

export function summarizeWarmupExecutorRun(input: {
  allProfiles: GrowthWarmupProfile[]
  scannableProfiles: GrowthWarmupProfile[]
  diagnostics: WarmupExecutorProfileDiagnostic[]
  approvedRecipientCount: number
  plannedSendsThisRun?: number
  pacingMessage?: string
}): WarmupExecutorRunSummary {
  const warmingProfiles = input.scannableProfiles.filter((p) => p.status === "warming").length
  const throttledProfiles = input.scannableProfiles.filter((p) => p.status === "throttled").length
  const pausedProfiles = input.scannableProfiles.filter((p) => p.status === "paused").length
  const eligibleProfiles = input.diagnostics.filter((d) => d.eligibility === "eligible").length

  let primaryMessage = "No warmup profiles exist."
  if (input.allProfiles.length === 0) {
    primaryMessage = "No warmup profiles exist."
  } else if (input.scannableProfiles.length === 0) {
    primaryMessage = "All warmup profiles are disabled."
  } else if (warmingProfiles === 0 && throttledProfiles > 0) {
    primaryMessage = `${throttledProfiles} profile(s) are throttled — executor only sends from warming profiles.`
  } else if (warmingProfiles === 0 && pausedProfiles > 0) {
    primaryMessage = `${pausedProfiles} profile(s) are paused — resume to enable executor sends.`
  } else if (eligibleProfiles === 0 && input.approvedRecipientCount === 0) {
    primaryMessage = "Profiles exist but no approved warmup recipients are configured."
  } else if (eligibleProfiles === 0) {
    primaryMessage = `${input.scannableProfiles.length} profile(s) scanned; none eligible for executor sends right now.`
  } else {
    primaryMessage = `${eligibleProfiles} profile(s) eligible for executor sends.`
  }

  return {
    totalProfiles: input.allProfiles.length,
    scannableProfiles: input.scannableProfiles.length,
    warmingProfiles,
    throttledProfiles,
    pausedProfiles,
    eligibleProfiles,
    primaryMessage,
    maxSendsPerProfilePerRun: MAX_SENDS_PER_PROFILE_PER_RUN,
    plannedSendsThisRun: input.plannedSendsThisRun,
    pacingMessage: input.pacingMessage,
  }
}
