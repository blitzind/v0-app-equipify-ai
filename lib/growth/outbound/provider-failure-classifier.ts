/** Deterministic provider/transport failure classification — client-safe. */

import type {
  GrowthProviderFailureClass,
  GrowthProviderFailureClassification,
} from "@/lib/growth/outbound/outbound-reliability-types"

const NON_RETRYABLE: GrowthProviderFailureClass[] = [
  "auth_failure",
  "suppression_blocked",
  "reputation_blocked",
  "mailbox_paused",
  "validation_failed",
]

function summarize(failureClass: GrowthProviderFailureClass): string {
  switch (failureClass) {
    case "auth_failure":
      return "Provider authentication failed — check credentials in provider setup."
    case "rate_limit":
      return "Provider rate limit hit — retry after cooldown or reduce send velocity."
    case "quota_exceeded":
      return "Provider quota exceeded — upgrade plan or defer sends."
    case "reputation_blocked":
      return "Blocked by deliverability reputation protection — review Deliverability Protection."
    case "mailbox_paused":
      return "Sender mailbox is persistently paused — operator recovery required."
    case "suppression_blocked":
      return "Recipient is suppressed — do not retry without compliance review."
    case "provider_unavailable":
      return "Provider unavailable — check connection health and provider setup."
    case "timeout":
      return "Provider request timed out — safe to retry if transient."
    case "validation_failed":
      return "Send validation failed — fix payload or configuration before retry."
    default:
      return "Unknown failure — review failure details before retry."
  }
}

export function classifyProviderFailure(input: {
  message?: string | null
  code?: string | null
  blockCode?: string | null
}): GrowthProviderFailureClassification {
  const haystack = `${input.code ?? ""} ${input.blockCode ?? ""} ${input.message ?? ""}`.toLowerCase()

  let failure_class: GrowthProviderFailureClass = "unknown"

  if (/auth|unauthorized|401|403|invalid.?key|credential/.test(haystack)) {
    failure_class = "auth_failure"
  } else if (/rate.?limit|429|throttl|too many/.test(haystack)) {
    failure_class = "rate_limit"
  } else if (/quota|limit exceeded|plan/.test(haystack)) {
    failure_class = "quota_exceeded"
  } else if (/reputation|deliverability|bounce.?threshold|complaint/.test(haystack)) {
    failure_class = "reputation_blocked"
  } else if (/mailbox.?paused|sender.?paused|operational.?pause|reputation_paused/.test(haystack)) {
    failure_class = "mailbox_paused"
  } else if (/suppress|unsubscrib|complaint|hard.?bounce|block.?code.*suppression/.test(haystack)) {
    failure_class = "suppression_blocked"
  } else if (/provider_unavailable|unavailable|not.?active|connection/.test(haystack)) {
    failure_class = "provider_unavailable"
  } else if (/timeout|timed out|etimedout|econnreset/.test(haystack)) {
    failure_class = "timeout"
  } else if (/validation|invalid|missing|not.?configured|preflight/.test(haystack)) {
    failure_class = "validation_failed"
  }

  const retry_eligible = !NON_RETRYABLE.includes(failure_class)
  return {
    failure_class,
    retry_eligible,
    operator_summary: summarize(failure_class),
  }
}

export function isRetryEligibleFailureClass(failureClass: GrowthProviderFailureClass | null | undefined): boolean {
  if (!failureClass) return true
  return !NON_RETRYABLE.includes(failureClass)
}
