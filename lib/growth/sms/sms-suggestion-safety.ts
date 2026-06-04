/** Phase 5.6F + 5.6.1 — SMS response suggestion quality and safety rules. Client-safe. */

import {
  auditCustomerFacingSuggestionCopy,
  normalizeCustomerFacingCopy,
} from "@/lib/growth/sms/sms-customer-facing-phrases"
import { hasSmsBlastLanguage } from "@/lib/growth/sms/personalization/sms-memory-awareness"
import { trimSmsToMaxChars } from "@/lib/growth/sms/personalization/sms-quality-scoring"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { SMS_PERSONALIZATION_DEFAULT_MAX_CHARS } from "@/lib/growth/sms/personalization/sms-personalization-types"

const EMAIL_GREETING = /^(hi|hello|dear)\s+[\w\s]+[,—-]/i
const EMAIL_CLOSING = /\b(best regards|sincerely|kind regards|thanks,?[\s\n]+[\w\s]+)\b/i
const INTERNAL_SCORES =
  /\b(engagement score|health score|confidence tier|momentum score|fit score|workflow health|coverage score)\b/i
const OVERPROMISE = /\b(guarantee\w*|100%|best in class|revolutionary|disrupt|game.?changer)\b/i
const UNAVAILABLE_CAPABILITY = /\b(auto.?book|instant demo|live chat|24\/7 support line)\b/i
const PUSHY_SALES = /\b(limited time|act now|don't miss|last chance|exclusive offer)\b/i

export function sanitizeSmsSuggestionBody(body: string, maxChars = SMS_PERSONALIZATION_DEFAULT_MAX_CHARS): string {
  let result = normalizeCustomerFacingCopy(body)
  result = result.replace(EMAIL_GREETING, "")
  result = result.replace(EMAIL_CLOSING, "")
  return trimSmsToMaxChars(result, maxChars)
}

export function auditSmsSuggestionSafety(input: {
  body: string
  intent: GrowthReplyIntent
}): string[] {
  const warnings: string[] = []
  const { body, intent } = input

  if (hasSmsBlastLanguage(body)) {
    warnings.push("Contains email-style blast language — revise before sending.")
  }
  if (EMAIL_GREETING.test(body)) {
    warnings.push("Email-style greeting detected — SMS should skip formal salutations.")
  }
  if (INTERNAL_SCORES.test(body)) {
    warnings.push("Internal score language detected — remove before sending.")
  }
  if (OVERPROMISE.test(body)) {
    warnings.push("Overpromise language detected — soften claims.")
  }
  if (UNAVAILABLE_CAPABILITY.test(body)) {
    warnings.push("Mentions capability that may not be available — verify before sending.")
  }
  if (PUSHY_SALES.test(body)) {
    warnings.push("Pushy sales language detected — use conversational tone.")
  }
  if (body.length > 160) {
    warnings.push("Message exceeds 160 characters — may send as multiple segments.")
  }
  if (intent === "unsubscribe" || intent === "not_interested") {
    warnings.push("Respect opt-out or disinterest — do not pitch in follow-up SMS.")
  }
  if (intent === "objection" || intent === "timing_delay") {
    warnings.push("Objection or timing signal — avoid aggressive meeting push.")
  }

  warnings.push(...auditCustomerFacingSuggestionCopy(body))

  return warnings
}

export function shouldSuppressSmsReplySuggestion(intent: GrowthReplyIntent): boolean {
  return intent === "unsubscribe" || intent === "angry_complaint"
}
