/** Client-safe types for Growth Engine reply-flow QA harness. */

export const GROWTH_REPLY_FLOW_QA_MARKER = "growth-reply-flow-qa-v1" as const

export const GROWTH_REPLY_FLOW_CHECK_LABELS = [
  "Lead Created",
  "Enrollment Created",
  "Step Created",
  "Approval Created",
  "Execution Job Created",
  "Delivery Attempt Created",
  "Transport Sent",
  "Gmail Message ID Present",
  "Reply Received",
  "Inbox Sync Processed",
  "Relationship Memory Updated",
  "Reply Intelligence Processed",
  "Workflow Actions Created",
  "Lead Status Updated On Reply",
  "NBA Updated On Reply",
  "Owner Notification Created",
  "Sequence Paused On Reply",
] as const

export type GrowthReplyFlowCheckLabel = (typeof GROWTH_REPLY_FLOW_CHECK_LABELS)[number]

export type GrowthReplyFlowCheckResult = {
  label: GrowthReplyFlowCheckLabel
  pass: boolean
  detail: string
}

export type GrowthReplyFlowFkIssue = {
  code: string
  message: string
  expected?: string | null
  actual?: string | null
}

export type GrowthReplyFlowHarnessReport = {
  qaMarker: typeof GROWTH_REPLY_FLOW_QA_MARKER
  overall: "PASS" | "FAIL"
  generatedAt: string
  checks: GrowthReplyFlowCheckResult[]
  ids: {
    leadId: string | null
    enrollmentId: string | null
    enrollmentStepId: string | null
    executionJobId: string | null
    deliveryAttemptId: string | null
    senderAccountId: string | null
    mailboxConnectionId: string | null
    providerId: string | null
    sequencePatternId: string | null
  }
  statuses: {
    leadStatus: string | null
    enrollmentStatus: string | null
    step1Status: string | null
    step1Channel: string | null
    jobStatus: string | null
    deliveryAttemptStatus: string | null
    mailboxConnectionStatus: string | null
    senderAccountStatus: string | null
  }
  transport: {
    recipientEmail: string | null
    leadContactEmail: string | null
    gmailMessageId: string | null
    gmailThreadId: string | null
    rfcMessageId: string | null
    simulated: boolean | null
    senderEmail: string | null
    providerFamily: string | null
    providerName: string | null
  }
  counts: {
    timelineEvents: number
    jobEvents: number
    transportAuditEvents: number
    inboxMessages: number
    replyIngestionEvents: number
    leadMemoryEvents: number
    inboxSyncRuns: number
    outboundReplies: number
    replyWorkflowActions: number
    growthNotifications: number
  }
  missingRecords: string[]
  fkIssues: GrowthReplyFlowFkIssue[]
  diagnostics: string[]
  actions: Record<string, unknown>
}

export type GrowthReplyFlowHarnessStep =
  | "all"
  | "create"
  | "enroll"
  | "scheduler"
  | "approve"
  | "execute"
  | "inbox-sync"
  | "inspect"
