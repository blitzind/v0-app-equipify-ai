/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Outbound sender affinity (client-safe).
 */

export const OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER = "outbound-sender-affinity-1a-v1" as const

export const OUTBOUND_SENDER_ASSIGNMENT_SOURCES = [
  "primary_sender",
  "sender_pool",
  "existing_affinity",
  "explicit_migration",
] as const

export type OutboundSenderAssignmentSource = (typeof OUTBOUND_SENDER_ASSIGNMENT_SOURCES)[number]

export const OUTBOUND_SENDER_ASSIGNMENT_STATUSES = [
  "active",
  "paused_capacity",
  "blocked_reconnect",
  "migrated",
] as const

export type OutboundSenderAssignmentStatus = (typeof OUTBOUND_SENDER_ASSIGNMENT_STATUSES)[number]

export type OutboundSenderAssignment = {
  id: string
  organizationId: string
  leadId: string
  contactEmail: string
  senderAccountId: string
  mailboxConnectionId: string | null
  senderEmail: string
  providerFamily: string
  assignmentSource: OutboundSenderAssignmentSource
  assignmentStrategy: string | null
  senderPoolId: string | null
  senderRotationDecisionId: string | null
  status: OutboundSenderAssignmentStatus
  assignedAt: string
  lastUsedAt: string | null
  migrationMetadata: Record<string, unknown>
}

export type OutboundSenderAssignmentKey = {
  organizationId: string
  leadId: string
  contactEmail: string
}

export function normalizeOutboundContactEmail(email: string): string {
  return email.trim().toLowerCase()
}
