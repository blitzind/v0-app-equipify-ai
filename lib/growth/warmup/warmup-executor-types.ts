/** GS-GROWTH-WARMUP-EXECUTOR-1A — types (client-safe). */

export const GROWTH_WARMUP_EXECUTOR_QA_MARKER = "growth-warmup-executor-1a-v1" as const

export const GROWTH_WARMUP_EXECUTOR_MIGRATION =
  "20270925120000_growth_warmup_executor_1a.sql" as const

export const GROWTH_WARMUP_RECIPIENT_TYPES = [
  "internal",
  "colleague",
  "customer",
  "safe_contact",
  "owned_inbox",
] as const

export type GrowthWarmupRecipientType = (typeof GROWTH_WARMUP_RECIPIENT_TYPES)[number]

export type GrowthWarmupRecipient = {
  id: string
  email: string
  name: string
  label: string
  recipient_type: GrowthWarmupRecipientType
  active: boolean
  approved: boolean
  max_emails_per_day: number
  max_emails_per_week: number
  last_sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type GrowthWarmupSendRunKind = "cron" | "manual"

export type GrowthWarmupSendRunStatus =
  | "running"
  | "completed"
  | "partial"
  | "skipped"
  | "failed"

export type GrowthWarmupSendAttemptStatus = "pending" | "sent" | "failed" | "skipped"

export type GrowthWarmupExecutorSkipCode =
  | "schema_not_ready"
  | "outside_sending_window"
  | "no_warming_profiles"
  | "no_approved_recipients"
  | "warmup_paused"
  | "warmup_throttled"
  | "warmup_cap_exhausted"
  | "sender_not_connected"
  | "sender_unhealthy"
  | "recipient_daily_cap"
  | "recipient_weekly_cap"
  | "pre_send_blocked"
  | "transport_failed"
  | "idempotent_skip"
  | "batch_limit_reached"

export type GrowthWarmupExecutorSenderResult = {
  senderAccountId: string
  senderEmail: string
  profileId: string
  plannedToday: number
  sendsToday: number
  executorSendsToday: number
  remainingCapacity: number
  attempted: number
  sent: number
  skipped: number
  failed: number
  skipReasons: Array<{ code: GrowthWarmupExecutorSkipCode; message: string }>
}

export type GrowthWarmupExecutorRunResult = {
  qa_marker: typeof GROWTH_WARMUP_EXECUTOR_QA_MARKER
  runId: string | null
  runKind: GrowthWarmupSendRunKind
  idempotencyKey: string
  status: GrowthWarmupSendRunStatus
  profilesScanned: number
  sendsAttempted: number
  sendsSucceeded: number
  sendsFailed: number
  sendsSkipped: number
  senderResults: GrowthWarmupExecutorSenderResult[]
  skipReasons: Array<{ code: GrowthWarmupExecutorSkipCode; message: string }>
  previewOnly: boolean
}

export type GrowthWarmupProfileExecutorStats = {
  profileId: string
  senderEmail: string
  plannedToday: number
  sendsToday: number
  executorSendsToday: number
  realOutboundCounted: number
  remainingToday: number
  lastExecutorRunAt: string | null
  pausedOrThrottled: boolean
  recipientPoolActive: number
}

/** Conservative business-hours window 13:00–22:00 UTC. TODO: sender timezone. */
export function isWithinWarmupSendingWindow(now = new Date()): boolean {
  const hourUtc = now.getUTCHours()
  return hourUtc >= 13 && hourUtc < 22
}
