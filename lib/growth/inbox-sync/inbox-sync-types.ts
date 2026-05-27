/** Client-safe Growth Engine inbox sync types (Phase 2I). */

export const GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER = "growth-inbox-sync-thread-continuity-v1" as const

export const GROWTH_INBOX_SYNC_PRIVACY_NOTE =
  "Inbox sync imports provider replies into unified inbox with deterministic thread matching. No autonomous replies, no raw provider payloads in UI."

export const GROWTH_INBOX_SYNC_RUN_STATUSES = ["running", "completed", "failed"] as const
export type GrowthInboxSyncRunStatus = (typeof GROWTH_INBOX_SYNC_RUN_STATUSES)[number]

export const GROWTH_INBOX_SYNC_TIMELINE_EVENT_TYPES = [
  "inbox_sync_started",
  "inbox_sync_completed",
  "inbox_reply_imported",
  "inbox_thread_matched",
  "inbox_thread_created",
  "inbox_duplicate_skipped",
] as const
export type GrowthInboxSyncTimelineEventType = (typeof GROWTH_INBOX_SYNC_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_INBOX_THREAD_MATCH_CONFIDENCE = {
  provider_thread: 100,
  provider_message: 100,
  message_reference: 90,
  delivery_attempt: 75,
  email_hash: 60,
  subject_similarity: 40,
  unknown: 0,
} as const

export type GrowthInboxSyncRun = {
  id: string
  mailboxConnectionId: string
  providerFamily: string
  status: GrowthInboxSyncRunStatus
  startedAt: string
  completedAt: string | null
  messagesSeen: number
  messagesImported: number
  threadsMatched: number
  threadsCreated: number
  duplicatesSkipped: number
  failureReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthInboxSyncRunView = GrowthInboxSyncRun & {
  mailboxLabel: string
}

export type GrowthInboxThreadLink = {
  id: string
  inboxThreadId: string
  leadId: string | null
  sequenceEnrollmentId: string | null
  deliveryAttemptId: string | null
  linkReason: string
  confidence: number
  createdAt: string
}

export type GrowthInboxThreadSyncDetail = {
  providerThreadId: string | null
  matchedBy: string | null
  confidence: number
  sequenceEnrollmentId: string | null
  deliveryAttemptId: string | null
  sequenceExitCandidate: boolean
}

export type GrowthInboxSyncDashboard = {
  qa_marker: typeof GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER
  lastSyncAt: string | null
  imported24h: number
  duplicatesSkipped24h: number
  failedRuns24h: number
  threadMatchRate: number
  runs: GrowthInboxSyncRunView[]
}

export type GrowthInboxSyncRunSummary = {
  runId: string
  mailboxConnectionId: string
  providerFamily: string
  status: GrowthInboxSyncRunStatus
  messagesSeen: number
  messagesImported: number
  threadsMatched: number
  threadsCreated: number
  duplicatesSkipped: number
  failureReason?: string | null
}

export type GrowthInboxNormalizedMessage = {
  providerMessageId: string
  providerThreadId: string | null
  inReplyTo: string | null
  references: string[]
  fromEmail: string
  toEmail: string
  subject: string
  bodyPreview: string
  messageTimestamp: string
  messageHash: string
}

export type GrowthInboxThreadMatchResult = {
  inboxThreadId: string | null
  leadId: string | null
  deliveryAttemptId: string | null
  sequenceEnrollmentId: string | null
  matchedBy: string
  confidence: number
  createNew: boolean
}

export function maskInboxSyncEmail(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase()
  if (!normalized) return "—"
  const [local, domain] = normalized.split("@")
  if (!domain) return `${normalized.slice(0, 2)}…`
  return `${local.slice(0, 2)}…@${domain}`
}

export function inboxSyncStatusLabel(status: GrowthInboxSyncRunStatus): string {
  return status.replace(/_/g, " ")
}
