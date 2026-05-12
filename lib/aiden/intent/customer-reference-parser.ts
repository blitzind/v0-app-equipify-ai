/**
 * Best-effort customer name / handle extraction from **normalized** (lower-case, collapsed-space) text.
 * Returns a display string for resolvers (not a validated UUID).
 */

function trimCapture(s: string): string | null {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length > 0 ? t : null
}

/**
 * Extract a free-text customer reference for resolver pipelines (not a validated UUID).
 */
export function extractCustomerReference(normalized: string): string | null {
  // "For Acme LLC, invoice all completed work orders from yesterday"
  const mBulkLead = normalized.match(/^\s*for\s+(.+?),\s+(?:invoice|create|prepare|draft)\b/)
  if (mBulkLead) return trimCapture(mBulkLead[1])

  // "Invoice all completed work orders from yesterday for acme llc"
  const mBulkTail = normalized.match(
    /\b(?:invoice|create|prepare|draft)\s+(?:all\s+)?completed\s+work\s+orders\s+from\s+.+?\s+for\s+(.+)$/,
  )
  if (mBulkTail) return trimCapture(mBulkTail[1])

  const m1 = normalized.match(/\bfor\s+(.+?)\s+based\s+on\b/)
  if (m1) return trimCapture(m1[1])

  const m2 = normalized.match(/\bfor\s+(.+?)\s+from\s+their\b/)
  if (m2) return trimCapture(m2[1])

  const m3 = normalized.match(/\bfor\s+(.+?)\s+from\s+the\b/)
  if (m3) return trimCapture(m3[1])

  const m4 = normalized.match(/\bfor\s+(.+?)\s+from\s+my\b/)
  if (m4) return trimCapture(m4[1])

  const m5 = normalized.match(/\bfor\s+(.+?)\s+(?:from|using)\s+(?:my|their)\s+last\b/)
  if (m5) return trimCapture(m5[1])

  const m6 = normalized.match(/\b(?:latest|last|most\s+recent)\s+completed\s+(?:work\s+order|job)\s+for\s+(.+)$/)
  if (m6) return trimCapture(m6[1])

  const m6b = normalized.match(/\b(?:latest|last|most\s+recent)\s+(?:work\s+order|job)\s+for\s+(.+)$/)
  if (m6b) return trimCapture(m6b[1])

  const m7 = normalized.match(/\binvoice\s+from\s+the\s+.+?\s+for\s+(.+)$/)
  if (m7) return trimCapture(m7[1])

  const mSummary = normalized.match(/\bcustomer\s+summary\s+for\s+(.+)$/)
  if (mSummary) return trimCapture(mSummary[1])

  const mAccount = normalized.match(/\baccount\s+overview\s+for\s+(.+)$/)
  if (mAccount) return trimCapture(mAccount[1])

  const mFollowTask = normalized.match(/\bfollow[\s-]*up\s+task\s+for\s+(.+)$/)
  if (mFollowTask) return trimCapture(mFollowTask[1])

  const mMaintVisit1 = normalized.match(/\b(?:maintenance|service)\s+visit\s+for\s+(.+)$/)
  if (mMaintVisit1) return trimCapture(mMaintVisit1[1])

  const mMaintVisit2 = normalized.match(/\bschedule\s+(?:a\s+)?(?:maintenance|service)\s+for\s+(.+)$/)
  if (mMaintVisit2) return trimCapture(mMaintVisit2[1])

  return null
}

/**
 * When user says "this customer", caller must supply `sourceContext.customerId`; no inline name.
 */
export function normalizedTextRequestsThisCustomer(normalized: string): boolean {
  return /\bthis\s+customer\b/.test(normalized)
}

export type MaintenancePlanPossessiveHint = { customer: string; equipment: string }

/**
 * “PM plan for Acme’s pump” / “maintenance plan for Client A’s compressor” — normalized lower-case text.
 */
export function extractMaintenancePlanPossessiveCustomerEquipment(
  normalized: string,
): MaintenancePlanPossessiveHint | null {
  const apostrophe = "['’]"
  const patterns = [
    new RegExp(`\\b(?:maintenance|preventive)\\s+plan\\s+for\\s+(.+?)${apostrophe}s\\s+(.+)$`, "i"),
    new RegExp(`\\bpm\\s+plan\\s+for\\s+(.+?)${apostrophe}s\\s+(.+)$`, "i"),
    new RegExp(`\\bplan\\s+for\\s+(.+?)${apostrophe}s\\s+(.+)$`, "i"),
    new RegExp(`\\b(?:pm|maintenance)\\s+for\\s+(.+?)${apostrophe}s\\s+(.+)$`, "i"),
  ]
  for (const re of patterns) {
    const m = normalized.match(re)
    if (!m) continue
    const customer = trimCapture(m[1])
    const equipment = trimCapture(m[2])
    if (customer && equipment) return { customer, equipment }
  }
  return null
}
