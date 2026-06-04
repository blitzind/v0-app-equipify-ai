/** Client-safe helpers for Inbox SMS operator send (Phase 5.5). */

import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"

export const GROWTH_SMS_OPERATOR_SEND_QA_MARKER = "growth-sms-operator-send-v1" as const
export const GROWTH_SMS_OPERATOR_SEND_WARN_CHARS = 320
export const GROWTH_SMS_OPERATOR_SEND_MAX_CHARS = 1600

export type GrowthSmsSendApiSuccess = {
  ok: true
  deliveryAttemptId?: string
  conversationId?: string
  messageId?: string
  providerMessageId?: string | null
  status?: string
}

export type GrowthSmsSendApiFailure = {
  ok?: false
  error?: string
  message?: string
}

export function resolveInboxSmsRecipientE164(input: {
  subject: string
  leadContactPhone?: string | null
  messages?: Array<{ direction: string; sender: string; recipient: string }>
}): string | null {
  const subjectMatch = input.subject.match(/SMS\s·\s*(\+[1-9]\d{6,14})/)
  if (subjectMatch?.[1]) {
    const normalized = normalizeToE164(subjectMatch[1])
    if (normalized) return normalized
  }

  if (input.leadContactPhone) {
    const normalized = normalizeToE164(input.leadContactPhone)
    if (normalized) return normalized
  }

  for (const message of input.messages ?? []) {
    const candidate = message.direction === "inbound" ? message.sender : message.recipient
    const normalized = normalizeToE164(candidate)
    if (normalized) return normalized
  }

  return null
}

export function mapGrowthSmsSendApiError(
  status: number,
  payload: GrowthSmsSendApiFailure,
): string {
  const code = payload.error?.trim()
  const detail = payload.message?.trim()

  if (status === 401 || status === 403 || code === "forbidden") {
    return "You do not have permission to send SMS from Growth Engine."
  }
  if (status === 503 || code === "growth_schema_incomplete") {
    return "SMS is not ready — Growth schema is incomplete. Contact platform support."
  }
  if (code === "sms_inactive") {
    return "Growth SMS workspace is not active."
  }
  if (code === "invalid_phone") {
    return "Recipient phone number is not valid E.164."
  }
  if (code === "empty_body") {
    return "Enter a message before sending."
  }
  if (code === "body_too_long") {
    return "Message exceeds the 1600 character SMS limit."
  }
  if (code === "lead_not_found") {
    return "Lead not found — refresh the thread and try again."
  }
  if (code === "invalid_body") {
    return detail || "Invalid SMS send request."
  }
  if (detail) return detail
  if (code === "sms_send_failed") return "SMS send failed. Try again or check SMS readiness."
  return "Could not send SMS. Try again."
}
