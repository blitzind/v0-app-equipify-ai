/**
 * BlitzPay Phase 3B — deterministic collections orchestration (pure logic, no I/O).
 * Retry windows are anchored to first failure; caps prevent infinite retries.
 */

export const BLITZPAY_COLLECTION_STATE_LIST_CAP = 100
export const BLITZPAY_COLLECTION_ATTEMPT_LIST_CAP = 150
export const BLITZPAY_COLLECTION_FLOW_LIST_CAP = 80
export const BLITZPAY_COLLECTION_ACTIVITY_LIST_CAP = 120
export const BLITZPAY_PHASE_3B_REPORTING_SCAN_CAP = 200

/** Offsets in days from `first_failure_at` for each automated retry slot (deterministic). */
export const RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE = [1, 3, 7, 14] as const

/** After this many failed automated slots, move to final escalation (no further auto schedule from engine). */
export const MAX_DETERMINISTIC_RETRY_SLOTS = 4

/** Hard cap on stored payment attempts per invoice path (orchestration + processor mirror). */
export const MAX_PAYMENT_ATTEMPT_COUNT = 24

export const MAX_ESCALATION_LEVEL = 10

export type CollectionStateStatus =
  | "current"
  | "upcoming"
  | "due"
  | "retry_scheduled"
  | "retry_in_progress"
  | "partial_payment"
  | "failed"
  | "escalated"
  | "resolved"
  | "uncollectible"

export type RecoveryReadiness = "on_track" | "attention" | "critical"

export type CollectionHealthBand = "strong" | "steady" | "strained"

function parseDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00.000Z`)
}

function addUtcDays(iso: string, days: number): string {
  const base = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00.000Z`)
  const t = base.getTime() + days * 86400000
  return new Date(t).toISOString()
}

/** Next retry instant from first failure anchor; null when schedule exhausted or invalid. */
export function computeNextRetryAtFromFirstFailure(firstFailureIso: string | null, failedAttemptCount: number): string | null {
  if (!firstFailureIso?.trim()) return null
  if (failedAttemptCount < 0) return null
  if (failedAttemptCount >= MAX_DETERMINISTIC_RETRY_SLOTS) return null
  const days = RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE[failedAttemptCount]
  if (days === undefined) return null
  return addUtcDays(firstFailureIso.trim(), days)
}

export function retryScheduleExhausted(failedAttemptCount: number): boolean {
  return failedAttemptCount >= MAX_DETERMINISTIC_RETRY_SLOTS
}

export function computeRetryEligibility(args: {
  recoveryPaused: boolean
  collectionStatus: CollectionStateStatus
  failedAttemptCount: number
  paymentAttemptCount: number
}): { eligible: boolean; reason: string } {
  if (args.recoveryPaused) return { eligible: false, reason: "recovery_paused" }
  if (args.collectionStatus === "resolved" || args.collectionStatus === "uncollectible") {
    return { eligible: false, reason: "terminal_status" }
  }
  if (args.paymentAttemptCount >= MAX_PAYMENT_ATTEMPT_COUNT) return { eligible: false, reason: "attempt_cap" }
  if (retryScheduleExhausted(args.failedAttemptCount)) return { eligible: false, reason: "retry_schedule_exhausted" }
  return { eligible: true, reason: "ok" }
}

export function computeEscalationLevel(failedAttemptCount: number): number {
  if (failedAttemptCount <= 0) return 0
  if (failedAttemptCount >= MAX_DETERMINISTIC_RETRY_SLOTS) return Math.min(MAX_ESCALATION_LEVEL, 3)
  return Math.min(MAX_ESCALATION_LEVEL, failedAttemptCount)
}

/** Derive collection status from invoice facts (deterministic; Stripe settlement reflected via invoice paid). */
export function deriveCollectionStatusFromInvoice(input: {
  invoiceStatus: string
  paidAt: string | null
  dueDate: string | null
  todayIsoDate: string
  partialPaidCents: number
  invoiceAmountCents: number
  recoveryPaused: boolean
  failedAttemptCount: number
  nextRetryAt: string | null
  explicitStatus?: CollectionStateStatus | null
}): CollectionStateStatus {
  const st = String(input.invoiceStatus || "").toLowerCase()
  if (st === "void") return "resolved"
  if (input.paidAt || st === "paid") return "resolved"

  const partial =
    input.partialPaidCents > 0 &&
    input.invoiceAmountCents > 0 &&
    input.partialPaidCents < input.invoiceAmountCents
  if (partial) return "partial_payment"

  if (input.recoveryPaused) return input.failedAttemptCount > 0 ? "failed" : "current"

  if (retryScheduleExhausted(input.failedAttemptCount) && input.failedAttemptCount > 0 && st !== "draft") {
    return "escalated"
  }

  if (input.nextRetryAt) {
    const nr = new Date(input.nextRetryAt).getTime()
    const now = new Date(`${input.todayIsoDate}T23:59:59.000Z`).getTime()
    if (nr > now) return "retry_scheduled"
    return "retry_in_progress"
  }

  if (!input.dueDate) return st === "draft" ? "current" : "due"

  const due = parseDay(input.dueDate)
  const today = parseDay(input.todayIsoDate)
  if (today < due) return "upcoming"
  if (today.getTime() === due.getTime()) return "due"
  if (st === "overdue" || today > due) return input.failedAttemptCount > 0 ? "failed" : "due"
  return "current"
}

export function categorizePaymentFailure(stripeStatusOrMessage: string | null | undefined): {
  category: string
  safeReason: string
} {
  const raw = String(stripeStatusOrMessage || "").toLowerCase()
  if (!raw.trim()) return { category: "unknown", safeReason: "Payment could not be completed." }
  if (raw.includes("insufficient") || raw.includes("funds")) return { category: "insufficient_funds", safeReason: "Insufficient funds." }
  if (raw.includes("expired") || raw.includes("invalid_cvc") || raw.includes("incorrect_cvc")) {
    return { category: "authentication", safeReason: "Card verification issue." }
  }
  if (raw.includes("declined") || raw.includes("card_declined")) return { category: "declined", safeReason: "Payment was declined." }
  if (raw.includes("processing") || raw.includes("requires_action")) return { category: "processing", safeReason: "Payment is still processing." }
  if (raw.includes("canceled") || raw.includes("cancelled")) return { category: "canceled", safeReason: "Payment attempt was canceled." }
  if (raw === "succeeded") return { category: "none", safeReason: "Payment completed." }
  return { category: "other", safeReason: "Payment could not be completed." }
}

export function recoveryFlowNextStage(currentStage: number, maxStage: number): { nextStage: number; completed: boolean } {
  if (currentStage >= maxStage) return { nextStage: maxStage, completed: true }
  return { nextStage: currentStage + 1, completed: false }
}

export function computeRecoveryReadiness(args: {
  collectionStatus: CollectionStateStatus
  escalationLevel: number
  recoveryPaused: boolean
}): RecoveryReadiness {
  if (args.recoveryPaused) return "attention"
  if (args.collectionStatus === "escalated" || args.escalationLevel >= 3) return "critical"
  if (args.collectionStatus === "failed" || args.collectionStatus === "retry_in_progress") return "attention"
  return "on_track"
}

export function computeCollectionHealthScore0to100(args: {
  resolvedCount: number
  activeProblemCount: number
  totalSample: number
}): number {
  const n = Math.max(1, args.totalSample)
  const base = Math.round((100 * args.resolvedCount) / n)
  const penalty = Math.min(60, args.activeProblemCount * 12)
  return Math.max(0, Math.min(100, base - penalty))
}

export function computeCollectionHealthBand(score: number): CollectionHealthBand {
  if (score >= 72) return "strong"
  if (score >= 44) return "steady"
  return "strained"
}

/** Human label for staff UI (calm language, no processor jargon). */
export function humanCollectionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    current: "On track",
    upcoming: "Upcoming",
    due: "Due now",
    retry_scheduled: "Follow-up scheduled",
    retry_in_progress: "Follow-up in progress",
    partial_payment: "Partial payment received",
    failed: "Needs attention",
    escalated: "Team review",
    resolved: "Settled",
    uncollectible: "Closed — not collectible",
  }
  return map[status] ?? "Unknown"
}

export function buildDeterministicRetryTimeline(firstFailureIso: string | null): Array<{ dayOffset: number; label: string }> {
  if (!firstFailureIso?.trim()) return []
  const out: Array<{ dayOffset: number; label: string }> = []
  for (let i = 0; i < RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE.length; i++) {
    const d = RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE[i]!
    out.push({ dayOffset: d, label: `Day ${d}` })
  }
  out.push({ dayOffset: 0, label: "Final review if still unpaid" })
  return out
}

export function phase3bReportingMetrics(args: {
  collectionStates: Array<{ collection_status: string; failed_attempt_count: number }>
  recoveryFlows: Array<{ flow_status: string; resolved_at: string | null; created_at: string }>
}): {
  collectionSuccessRate: number
  retryRecoveryRate: number
  failedPaymentRate: number
  delinquencyRate: number
  recoveryFlowCompletionRate: number
  averageRecoveryDurationDays: number
} {
  const states = args.collectionStates
  const flows = args.recoveryFlows
  const n = Math.max(1, states.length)

  const resolved = states.filter((s) => s.collection_status === "resolved").length
  const resolvedWithRetries = states.filter((s) => s.collection_status === "resolved" && s.failed_attempt_count > 0).length
  const failedLike = states.filter((s) =>
    ["failed", "escalated", "uncollectible", "retry_scheduled", "retry_in_progress"].includes(s.collection_status),
  ).length

  const collectionSuccessRate = Math.min(100, Math.round((100 * resolved) / n))
  const retryRecoveryRate =
    resolved > 0 ? Math.min(100, Math.round((100 * resolvedWithRetries) / Math.max(1, resolved))) : 0
  const failedPaymentRate = Math.min(100, Math.round((100 * failedLike) / n))
  const delinquencyRate = Math.min(
    100,
    Math.round(
      (100 *
        states.filter((s) => ["failed", "escalated", "uncollectible"].includes(s.collection_status)).length) /
        n,
    ),
  )

  const flowDenom = Math.max(
    1,
    flows.filter((f) => ["active", "paused", "completed", "canceled"].includes(f.flow_status)).length,
  )
  const completed = flows.filter((f) => f.flow_status === "completed").length
  const recoveryFlowCompletionRate = Math.min(100, Math.round((100 * completed) / flowDenom))

  let durSum = 0
  let durN = 0
  for (const f of flows) {
    if (!f.resolved_at) continue
    const a = new Date(f.created_at).getTime()
    const b = new Date(f.resolved_at).getTime()
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      durSum += (b - a) / 86400000
      durN++
    }
  }
  const averageRecoveryDurationDays = durN > 0 ? Math.round((10 * durSum) / durN) / 10 : 0

  return {
    collectionSuccessRate,
    retryRecoveryRate,
    failedPaymentRate,
    delinquencyRate,
    recoveryFlowCompletionRate,
    averageRecoveryDurationDays,
  }
}
