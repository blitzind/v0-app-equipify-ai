/** Voice drop compliance gating — Phase 4B. Default suppress when unknown. */

import { evaluateVoiceBusinessHours } from "@/lib/voice/business-hours/business-hours-evaluator"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type { VoiceBusinessHoursRecord } from "@/lib/voice/types"
import type { VoiceDropComplianceSummary } from "@/lib/voice/voice-drops/types"

export type ComplianceCheckInput = {
  organizationId: string
  phoneNumber: string
  campaignId: string
  isOptedOut: boolean
  isOnDncList: boolean | null
  duplicateInCampaign: boolean
  recentDropWithinCapDays: boolean
  relationshipSuppressed: boolean
  businessHoursProfile: Pick<
    VoiceBusinessHoursRecord,
    "timezone" | "weeklyScheduleJson" | "holidayRulesJson"
  > | null
  now?: Date
}

export type ComplianceCheckResult = {
  allowed: boolean
  suppressed: boolean
  manualReview: boolean
  reason: string | null
}

export function evaluateRecipientCompliance(input: ComplianceCheckInput): ComplianceCheckResult {
  const normalized = normalizePhoneNumber(input.phoneNumber)
  if (!normalized || normalized.length < 10) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "invalid_phone_number" }
  }

  if (input.isOptedOut) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "opt_out" }
  }

  if (input.isOnDncList === true) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "dnc_listed" }
  }

  if (input.isOnDncList === null) {
    return { allowed: false, suppressed: false, manualReview: true, reason: "dnc_status_unknown" }
  }

  if (input.duplicateInCampaign) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "duplicate_campaign_recipient" }
  }

  if (input.recentDropWithinCapDays) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "frequency_cap" }
  }

  if (input.relationshipSuppressed) {
    return { allowed: false, suppressed: true, manualReview: false, reason: "relationship_suppressed" }
  }

  const hoursStatus = evaluateVoiceBusinessHours(input.businessHoursProfile, input.now ?? new Date())
  if (hoursStatus === "closed") {
    return { allowed: false, suppressed: false, manualReview: true, reason: "outside_call_hours" }
  }

  return { allowed: true, suppressed: false, manualReview: false, reason: null }
}

export function summarizeComplianceResults(
  results: Array<{ reason: string | null; suppressed: boolean; manualReview: boolean }>,
): VoiceDropComplianceSummary {
  const eligibleCount = results.filter((r) => !r.suppressed && !r.manualReview).length
  const suppressedCount = results.filter((r) => r.suppressed).length
  const manualReviewCount = results.filter((r) => r.manualReview).length
  const reasonMap = new Map<string, number>()

  for (const row of results) {
    if (!row.reason) continue
    reasonMap.set(row.reason, (reasonMap.get(row.reason) ?? 0) + 1)
  }

  return {
    eligibleCount,
    suppressedCount,
    manualReviewCount,
    reasons: [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })),
  }
}
