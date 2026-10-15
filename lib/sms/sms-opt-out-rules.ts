/** Common carrier STOP keywords (case-insensitive, trailing punctuation stripped). */
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"])
const HELP_KEYWORDS = new Set(["HELP", "INFO"])

export type SmsOptOutKeyword = "stop" | "help"

function normalizeKeywordBody(body: string): string {
  return body.trim().toUpperCase().replace(/[.!?,]+$/g, "").replace(/\s+/g, "")
}

export function classifySmsOptOutKeyword(body: string): SmsOptOutKeyword | null {
  const token = normalizeKeywordBody(body)
  if (STOP_KEYWORDS.has(token)) return "stop"
  if (HELP_KEYWORDS.has(token)) return "help"
  return null
}

export function isSmsStopKeyword(body: string): boolean {
  return classifySmsOptOutKeyword(body) === "stop"
}

/**
 * Live Growth/outreach SMS is fail-closed: suppression, org isolation, and recipient
 * promotional consent are all required. There is no promotional consent store today,
 * so live sends are blocked even when a marketing-form transactional checkbox was checked.
 */
export function evaluateGrowthSmsLiveSendGate(input: {
  liveSendEnabled: boolean
  suppressed: boolean
  organizationId: string | null | undefined
}): { allow: true } | { allow: false; code: string; message: string } {
  if (!input.liveSendEnabled) return { allow: true }
  if (!input.organizationId) {
    return {
      allow: false,
      code: "missing_org",
      message: "Live SMS is blocked because the recipient is not tied to an organization.",
    }
  }
  if (input.suppressed) {
    return {
      allow: false,
      code: "suppressed",
      message: "This number is opted out of SMS for the organization.",
    }
  }
  return {
    allow: false,
    code: "missing_consent",
    message:
      "Live Growth SMS is blocked until recipient-specific promotional consent is recorded. Transactional marketing-form consent is not treated as authorization to send outreach SMS.",
  }
}
