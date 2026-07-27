/**
 * AVA-SUPERVISED-OUTBOUND-1A — Supervised Ava send contract (client-safe).
 */

export const AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER = "ava-supervised-outbound-1a-v1" as const

export const AVA_SUPERVISED_OUTBOUND_PROMPT_VARIANT = "ava_direct_production_cutover_1a" as const

export const AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES = [
  "Write the email body only — no subject line inside the body.",
  "Do NOT include a signature block, sender name, title, company, email, website, tagline, scheduling CTA, or separator lines such as --.",
  "The platform appends the approved outbound signature exactly once at send time.",
  "NEVER use an em dash (—) in the subject or body. Use a comma, period, colon, parentheses, or a rewritten sentence instead.",
] as const

export type AvaSupervisedOutboundApprovalBinding = {
  qaMarker: typeof AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER
  generationId: string
  organizationId: string
  recipientEmail: string
  subject: string
  unsignedBody: string
  bodyFingerprint: string
  senderAccountId: string
  senderAssignmentId?: string | null
  mailboxConnectionId?: string | null
  senderEmail?: string | null
  assignmentSource?: string | null
  assignmentStrategy?: string | null
  senderPoolId?: string | null
  signatureProfileId: string | null
  signatureResolutionSource: string | null
  approvedAt: string
  approvedBy: string
}

export type AvaSupervisedOutboundSendReceipt = {
  qaMarker: typeof AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER
  generationId: string
  deliveryAttemptId: string
  providerMessageId: string | null
  senderAccountId: string
  recipientEmail: string
  subject: string
  bodyFingerprint: string
  signatureProfileId: string | null
  signatureResolutionSource: string | null
  signatureInjected: boolean
  sentAt: string
  status: "sent" | "failed" | "delivery_unknown"
  errorCode?: string | null
  errorMessage?: string | null
}

export function isAvaSupervisedOutboundGeneration(input: {
  promptVariant?: string | null
}): boolean {
  return input.promptVariant?.trim() === AVA_SUPERVISED_OUTBOUND_PROMPT_VARIANT
}

export function readAvaSupervisedOutboundApprovalBinding(
  classification: Record<string, unknown> | null | undefined,
): AvaSupervisedOutboundApprovalBinding | null {
  const raw = classification?.avaSupervisedOutboundApproval
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<AvaSupervisedOutboundApprovalBinding>
  if (
    row.qaMarker !== AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER ||
    !row.generationId?.trim() ||
    !row.organizationId?.trim() ||
    !row.recipientEmail?.trim() ||
    !row.subject?.trim() ||
    !row.unsignedBody?.trim() ||
    !row.bodyFingerprint?.trim() ||
    !row.senderAccountId?.trim() ||
    !row.approvedAt?.trim() ||
    !row.approvedBy?.trim()
  ) {
    return null
  }
  return row as AvaSupervisedOutboundApprovalBinding
}

export function readAvaSupervisedOutboundSendReceipt(
  classification: Record<string, unknown> | null | undefined,
): AvaSupervisedOutboundSendReceipt | null {
  const raw = classification?.avaSupervisedOutboundSendReceipt
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<AvaSupervisedOutboundSendReceipt>
  if (
    row.qaMarker !== AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER ||
    !row.generationId?.trim() ||
    !row.deliveryAttemptId?.trim() ||
    !row.senderAccountId?.trim() ||
    !row.recipientEmail?.trim() ||
    !row.subject?.trim() ||
    !row.bodyFingerprint?.trim() ||
    !row.sentAt?.trim() ||
    (row.status !== "sent" && row.status !== "failed" && row.status !== "delivery_unknown")
  ) {
    return null
  }
  return row as AvaSupervisedOutboundSendReceipt
}
