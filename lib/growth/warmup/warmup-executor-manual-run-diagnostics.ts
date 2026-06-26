/** GS-GROWTH-WARMUP-EXECUTOR-1G — manual run no-send explanations (client-safe). */

import type {
  GrowthWarmupExecutorRunResult,
  GrowthWarmupExecutorSkipCode,
  GrowthWarmupRecipient,
  WarmupExecutorProfileDiagnostic,
  WarmupExecutorRecipientPoolSummary,
} from "@/lib/growth/warmup/warmup-executor-types"
import { isWithinWarmupSendingWindow } from "@/lib/growth/warmup/warmup-executor-types"
import { computeWarmupRecipientPoolHealth, type WarmupRecipientPoolHealth } from "@/lib/growth/warmup/warmup-recipient-pool-health"
import { GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER, MAX_SENDS_PER_PROFILE_PER_RUN } from "@/lib/growth/warmup/warmup-executor-diagnostics"

export const GROWTH_WARMUP_EXECUTOR_1G_QA_MARKER = "growth-warmup-executor-1g-v1" as const

/** Expected production executor build — surfaced in API so operators can detect stale Vercel deploys. */
export const GROWTH_WARMUP_EXECUTOR_BUILD_MARKER = GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER

export const WARMUP_MANUAL_RUN_BEHAVIOR =
  "Manual runs send up to 1 message per eligible warming profile immediately (no hourly wait). Hourly cron sends the same during UTC 13–21. Daily warmup targets still cap total sends per mailbox." as const

export type WarmupExecutorDisplaySkipCode =
  | "daily_target_reached"
  | "recipient_daily_cap"
  | "recipient_weekly_cap"
  | "per_sender_dedup_exhausted"
  | "recipient_pool_exhausted_for_sender"
  | "sender_daily_cap"
  | "pre_send_guard_blocked"
  | "idempotency_duplicate"
  | "outside_sending_window"
  | "profile_not_warming"
  | "sender_not_healthy"
  | "transport_failed"
  | "no_approved_recipients"
  | "production_build_stale"
  | GrowthWarmupExecutorSkipCode

export type WarmupExecutorProfileResultView = {
  sender: string
  profileId: string
  remainingToday: number
  nextRunCanSend: number
  eligible: boolean
  skipCode: WarmupExecutorDisplaySkipCode | null
  skipReason: string | null
  nextAction: string | null
  sent: number
  attempted: number
}

export type { WarmupExecutorRecipientPoolSummary }

export type WarmupExecutorManualRunBreakdown = {
  ok: true
  sent: number
  planned: number
  eligibleProfiles: number
  remainingProfiles: number
  waitingProfilesThisRun: number
  poolPressureMessage: string | null
  skipSummary: Array<{ code: WarmupExecutorDisplaySkipCode; count: number; label: string }>
  profileResults: WarmupExecutorProfileResultView[]
  recipientPool: WarmupExecutorRecipientPoolSummary
  noSendExplanation: string | null
  nextCronSendAt: string | null
  manualRunBehavior: string
  executorBuildMarker: string
  productionBuildStale: boolean
}

const SKIP_LABELS: Record<string, string> = {
  daily_target_reached: "Daily warmup target reached",
  recipient_daily_cap: "Recipient daily cap",
  recipient_weekly_cap: "Recipient weekly cap",
  per_sender_dedup_exhausted: "Per-sender dedup exhausted",
  recipient_pool_exhausted_for_sender: "No unique recipients for sender",
  sender_daily_cap: "Sender daily send cap",
  pre_send_guard_blocked: "Pre-send guard blocked",
  idempotency_duplicate: "Duplicate run (idempotency)",
  outside_sending_window: "Outside sending window",
  profile_not_warming: "Profile not in warming status",
  sender_not_healthy: "Sender not healthy",
  transport_failed: "Transport failed",
  no_approved_recipients: "No approved recipients",
  production_build_stale: "Production build stale",
  warmup_cap_exhausted: "Daily warmup target reached",
  warmup_paused: "Warmup paused",
  warmup_throttled: "Warmup throttled",
  pre_send_blocked: "Pre-send guard blocked",
  idempotent_skip: "Duplicate run (idempotency)",
  sender_not_connected: "Sender not connected",
  sender_unhealthy: "Sender not healthy",
  no_recipients: "No recipients available now",
  no_warming_profiles: "No warming profiles",
  batch_limit_reached: "Batch safety cap reached",
  profile_execution_failed: "Profile execution failed",
  schema_not_ready: "Executor schema not ready",
}

export function normalizeWarmupSkipCodeForDisplay(
  code: GrowthWarmupExecutorSkipCode | "no_recipients" | null | undefined,
): WarmupExecutorDisplaySkipCode | null {
  if (!code) return null
  switch (code) {
    case "warmup_cap_exhausted":
      return "daily_target_reached"
    case "idempotent_skip":
      return "idempotency_duplicate"
    case "pre_send_blocked":
      return "pre_send_guard_blocked"
    case "sender_unhealthy":
    case "sender_not_connected":
      return "sender_not_healthy"
    case "no_recipients":
      return "no_approved_recipients"
    default:
      return code
  }
}

export function labelWarmupSkipCode(code: WarmupExecutorDisplaySkipCode | string): string {
  return SKIP_LABELS[code] ?? code.replace(/_/g, " ")
}

export function computeNextWarmupCronSendAt(now = new Date()): string {
  const cursor = new Date(now)
  if (isWithinWarmupSendingWindow(cursor)) {
    cursor.setUTCMinutes(0, 0, 0)
    cursor.setUTCHours(cursor.getUTCHours() + 1)
  } else {
    cursor.setUTCHours(13, 0, 0, 0)
    if (cursor.getUTCHours() >= 22 || cursor.getUTCHours() < 13) {
      if (cursor.getUTCHours() >= 22) {
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      cursor.setUTCHours(13, 0, 0, 0)
    }
  }
  return cursor.toISOString()
}

export function formatWarmupCronAvailability(now = new Date()): string {
  if (isWithinWarmupSendingWindow(now)) {
    const next = new Date(computeNextWarmupCronSendAt(now))
    return `Next scheduled cron warmup send: ${next.toLocaleString()} (hourly during UTC 13–21). Manual runs are immediate.`
  }
  const next = new Date(computeNextWarmupCronSendAt(now))
  return `Outside cron window (UTC 13–21). Next scheduled cron send: ${next.toLocaleString()}. Manual runs still send immediately when eligible.`
}

export function summarizeRecipientPoolPressure(input: {
  recipients: GrowthWarmupRecipient[]
  availableNow: number
  availableForSender?: number | null
  health?: WarmupRecipientPoolHealth
}): WarmupExecutorRecipientPoolSummary {
  const activeApprovedRecipients = input.recipients.filter((r) => r.active && r.approved).length
  const exhausted = activeApprovedRecipients > 0 && input.availableNow === 0
  const health =
    input.health ??
    computeWarmupRecipientPoolHealth({
      approvedRecipients: activeApprovedRecipients,
      availableGlobally: input.availableNow,
      availableForSender: input.availableForSender ?? null,
      warmingSenderCount: 0,
    })

  let message = health.message
  if (input.availableForSender === 0 && input.availableNow > 0) {
    message = "This sender has already used every available approved recipient today."
  } else if (exhausted) {
    message = "All approved recipients reached daily or weekly caps."
  }

  return {
    activeApprovedRecipients,
    availableNow: input.availableNow,
    availableForSender: input.availableForSender ?? null,
    exhausted,
    message,
    healthTier: health.tier,
    healthMessage: health.message,
    recommendations: health.recommendations,
  }
}

function buildProfileResultViews(result: GrowthWarmupExecutorRunResult): WarmupExecutorProfileResultView[] {
  const diagnostics = result.profileDiagnostics ?? []
  const senderByProfile = new Map(result.senderResults.map((row) => [row.profileId, row]))

  return diagnostics.map((diag) => {
    const sender = senderByProfile.get(diag.profileId)
    const sent = sender?.sent ?? 0
    const skipCode =
      sent > 0
        ? null
        : sender?.skipReasons[0]?.code
          ? normalizeWarmupSkipCodeForDisplay(sender.skipReasons[0].code)
          : diag.eligibility === "eligible"
            ? null
            : normalizeWarmupSkipCodeForDisplay(diag.skipCode)
    const skipReason =
      sent > 0
        ? null
        : sender?.skipReasons[0]?.message ?? (diag.eligibility === "skipped" ? diag.reason : null)

    return {
      sender: diag.senderEmail,
      profileId: diag.profileId,
      remainingToday: diag.remainingCapacity,
      nextRunCanSend:
        diag.eligibility === "eligible" && diag.remainingCapacity > 0 ? MAX_SENDS_PER_PROFILE_PER_RUN : 0,
      eligible: diag.eligibility === "eligible" && diag.remainingCapacity > 0,
      skipCode,
      skipReason,
      nextAction: diag.nextAction,
      sent,
      attempted: sender?.attempted ?? 0,
    }
  })
}

function buildSkipSummary(
  profileResults: WarmupExecutorProfileResultView[],
): WarmupExecutorManualRunBreakdown["skipSummary"] {
  const counts = new Map<string, number>()
  for (const row of profileResults) {
    if (row.sent > 0 || !row.skipCode) continue
    counts.set(row.skipCode, (counts.get(row.skipCode) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([code, count]) => ({
      code: code as WarmupExecutorDisplaySkipCode,
      count,
      label: labelWarmupSkipCode(code),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildNoSendExplanation(input: {
  sent: number
  planned: number
  eligibleProfiles: number
  skipSummary: WarmupExecutorManualRunBreakdown["skipSummary"]
  recipientPool: WarmupExecutorRecipientPoolSummary
  runSkipReasons: GrowthWarmupExecutorRunResult["skipReasons"]
  productionBuildStale: boolean
}): string | null {
  if (input.sent > 0) return null

  if (input.productionBuildStale) {
    return "Production is not running the 1F executor build. Redeploy Vercel production before retrying manual warmup."
  }

  if (input.recipientPool.exhausted) {
    return input.recipientPool.message
  }

  const top = input.skipSummary[0]
  if (top) {
    if (top.code === "recipient_daily_cap" || top.code === "recipient_weekly_cap") {
      return `${top.count} profile(s) blocked: all approved recipients reached daily or weekly caps. Add recipients or raise caps.`
    }
    if (top.code === "per_sender_dedup_exhausted" || top.code === "recipient_pool_exhausted_for_sender") {
      return `${top.count} profile(s) blocked: this sender has already used every available approved recipient today. Add more approved recipients.`
    }
    if (top.code === "daily_target_reached") {
      return `${top.count} profile(s) already reached today's warmup target.`
    }
    if (top.code === "idempotency_duplicate") {
      return "This run was skipped as a duplicate (idempotency). Wait for the next hour or run manual again."
    }
    if (top.code === "pre_send_guard_blocked" || top.code === "sender_daily_cap") {
      return `${top.count} profile(s) blocked by pre-send infrastructure guards.`
    }
    return `${top.count} profile(s) skipped: ${top.label}.`
  }

  const runLevel = input.runSkipReasons[0]
  if (runLevel) {
    if (runLevel.code === "idempotent_skip") {
      return "Duplicate run blocked by idempotency. " + (runLevel.message ?? "")
    }
    const display = normalizeWarmupSkipCodeForDisplay(runLevel.code)
    return runLevel.message ?? labelWarmupSkipCode(display ?? runLevel.code)
  }

  if (input.planned === 0 && input.eligibleProfiles === 0) {
    return "No eligible warming profiles with remaining daily capacity."
  }

  return "Manual run completed with 0 sends. See profile results below for per-mailbox reasons."
}

export function buildWarmupExecutorManualRunBreakdown(input: {
  result: GrowthWarmupExecutorRunResult
  recipientPool: WarmupExecutorRecipientPoolSummary
  executorBuildMarker?: string
  clientBuildMarker?: string | null
  now?: Date
}): WarmupExecutorManualRunBreakdown {
  const { result } = input
  const executorBuildMarker = input.executorBuildMarker ?? GROWTH_WARMUP_EXECUTOR_BUILD_MARKER
  const productionBuildStale =
    input.clientBuildMarker != null && input.clientBuildMarker !== executorBuildMarker

  const profileResults = buildProfileResultViews(result)
  const eligibleProfiles = profileResults.filter((row) => row.eligible && row.remainingToday > 0).length
  const sent = result.sendsSucceeded
  const planned = result.runSummary?.plannedSendsThisRun ?? eligibleProfiles * MAX_SENDS_PER_PROFILE_PER_RUN
  const remainingProfiles = profileResults.filter((row) => row.remainingToday > 0 && row.sent === 0).length
  const skipSummary = buildSkipSummary(profileResults)
  const waitingProfilesThisRun =
    input.recipientPool.waitingProfilesThisRun ??
    result.runSummary?.waitingProfilesThisRun ??
    Math.max(0, eligibleProfiles - planned)
  const poolPressureMessage =
    input.recipientPool.poolPressureMessage ?? result.runSummary?.poolPressureMessage ?? null

  if (productionBuildStale) {
    skipSummary.unshift({
      code: "production_build_stale",
      count: profileResults.length,
      label: labelWarmupSkipCode("production_build_stale"),
    })
  }

  return {
    ok: true,
    sent,
    planned,
    eligibleProfiles,
    remainingProfiles,
    waitingProfilesThisRun,
    poolPressureMessage,
    skipSummary,
    profileResults,
    recipientPool: input.recipientPool,
    noSendExplanation: buildNoSendExplanation({
      sent,
      planned,
      eligibleProfiles,
      skipSummary,
      recipientPool: input.recipientPool,
      runSkipReasons: result.skipReasons,
      productionBuildStale,
    }),
    nextCronSendAt: computeNextWarmupCronSendAt(input.now),
    manualRunBehavior: WARMUP_MANUAL_RUN_BEHAVIOR,
    executorBuildMarker,
    productionBuildStale,
  }
}

export function isWarmupExecutorBuildMarkerCurrent(marker: string | null | undefined): boolean {
  return marker === GROWTH_WARMUP_EXECUTOR_BUILD_MARKER
}

export function explainWarmupProfileDiagnostic(diag: WarmupExecutorProfileDiagnostic): string {
  if (diag.eligibility === "eligible") {
    return diag.reason
  }
  const code = normalizeWarmupSkipCodeForDisplay(diag.skipCode)
  return `${labelWarmupSkipCode(code ?? "profile_not_warming")}: ${diag.reason}`
}
