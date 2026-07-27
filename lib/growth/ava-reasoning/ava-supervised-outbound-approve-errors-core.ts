/**
 * AVA-BLOCK-IMAGING-APPROVE-ACTION-HOTFIX-1A — Operator-safe approve error messages (client-safe).
 */

export const AVA_SUPERVISED_OUTBOUND_APPROVE_ERRORS_CORE_QA_MARKER =
  "ava-supervised-outbound-approve-errors-core-1a-v1" as const

export function mapAvaSupervisedOutboundApproveError(input: {
  error?: string | null
  message?: string | null
  status?: number
}): string {
  const code = input.error?.trim().toLowerCase() ?? ""
  const message = input.message?.trim() ?? ""

  if (code === "generation_not_approvable" || message.includes("generation_not_approvable")) {
    return "This draft is no longer eligible for approval. Refresh and review the current version."
  }
  if (code === "approved_recipient_unavailable" || message.includes("approved_recipient_unavailable")) {
    return "Could not approve this email because the recipient is missing."
  }
  if (code === "approved_subject_unavailable" || message.includes("approved_subject_unavailable")) {
    return "Could not approve this email because the subject is missing."
  }
  if (code === "approved_body_unavailable" || message.includes("approved_body_unavailable")) {
    return "Could not approve this email because the body is empty."
  }
  if (
    code === "no_eligible_sender" ||
    code === "approved_sender_unavailable" ||
    code === "sender_not_found" ||
    code === "assignment_claim_unavailable" ||
    message.includes("no_eligible_sender") ||
    message.includes("approved_sender_unavailable")
  ) {
    return "Sender assignment failed. The email was not approved."
  }
  if (
    code === "mailbox_unhealthy" ||
    code === "mailbox_not_connected" ||
    message.includes("mailbox") ||
    message.includes("sender_rotation_decisions")
  ) {
    return "Sender assignment failed. The email was not approved."
  }
  if (code === "approval_binding_persist_failed" || message.includes("approval_binding_persist_failed")) {
    return "Could not freeze this email for send. The email was not approved."
  }
  if (input.status === 404 || code === "not_found") {
    return "This review package could not be found. Refresh and try again."
  }
  if (message && !message.includes("violates check constraint")) {
    return message
  }
  return "Could not approve this email. Please try again."
}
