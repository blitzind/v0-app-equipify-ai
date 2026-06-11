/** Apollo sequence placeholder detection — blocks placeholder SMS from transport. */

import {
  APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL,
  isApolloSequenceDraftPlaceholderContent,
} from "@/lib/growth/apollo/apollo-sequence-draft-readiness"

export const APOLLO_SEQUENCE_PLACEHOLDER_GUARD_QA_MARKER =
  "apollo-sequence-placeholder-guard-v1" as const

export const APOLLO_SMS_PLACEHOLDER_BLOCK_CODE = "apollo_sms_placeholder_blocked" as const

const GENERIC_EMAIL_SUBJECTS = new Set(["follow up", "following up"])
const GENERIC_EMAIL_BODY_PREFIX = "following up on our conversation"

export function isApolloSmsPlaceholderBody(body: string | null | undefined): boolean {
  return isApolloSequenceDraftPlaceholderContent(body)
}

export function isApolloEmailPlaceholderContent(input: {
  subject: string | null | undefined
  body: string | null | undefined
}): boolean {
  const subject = (input.subject ?? "").trim().toLowerCase()
  const body = (input.body ?? "").trim()
  if (!body) return true
  if (body.includes(APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL)) return true
  if (GENERIC_EMAIL_SUBJECTS.has(subject) && body.toLowerCase().startsWith(GENERIC_EMAIL_BODY_PREFIX)) {
    return true
  }
  return false
}

export function evaluateApolloSmsSendReadiness(body: string | null | undefined): {
  allowed: boolean
  code: string | null
  is_placeholder: boolean
} {
  const isPlaceholder = isApolloSmsPlaceholderBody(body)
  if (isPlaceholder) {
    return {
      allowed: false,
      code: APOLLO_SMS_PLACEHOLDER_BLOCK_CODE,
      is_placeholder: true,
    }
  }
  if (!body?.trim()) {
    return { allowed: false, code: "missing_sms_body", is_placeholder: true }
  }
  return { allowed: true, code: null, is_placeholder: false }
}
