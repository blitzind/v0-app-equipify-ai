import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import type { GrowthIntentLeadCandidateIdentity } from "@/lib/growth/lead-engine/intent/intent-candidate-types"

export const GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD = 6

export type GrowthIntentThresholdInput = {
  aggregated: GrowthIntentAggregatedSession
  intent_score: number
  identity: GrowthIntentLeadCandidateIdentity
  consent_required: boolean
  dedupe_matched: boolean
}

export type GrowthIntentThresholdResult = {
  threshold_passed: boolean
  lead_engine_eligible: boolean
  reasons: string[]
  blockers: string[]
}

export function isConsentValidForBridge(
  consentStatus: GrowthIntentAggregatedSession["primary_session"]["consent_status"],
  consentRequired: boolean,
): boolean {
  if (!consentRequired) return true
  return consentStatus === "granted" || consentStatus === "not_required"
}

export function evaluateIntentThreshold(input: GrowthIntentThresholdInput): GrowthIntentThresholdResult {
  const reasons: string[] = []
  const blockers: string[] = []

  if (input.intent_score >= GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD) {
    reasons.push(`Intent score ${input.intent_score} meets minimum threshold (${GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD}).`)
  } else {
    blockers.push(
      `Intent score ${input.intent_score} below minimum threshold (${GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD}).`,
    )
  }

  const consentOk = isConsentValidForBridge(
    input.aggregated.primary_session.consent_status,
    input.consent_required,
  )
  if (consentOk) {
    reasons.push("Consent valid for Lead Engine bridge.")
  } else {
    blockers.push(`Consent status "${input.aggregated.primary_session.consent_status}" blocks bridge.`)
  }

  if (input.aggregated.primary_session.consent_status === "denied") {
    blockers.push("Consent denied — intent cannot fuel Lead Engine.")
  }

  if (input.identity.identity_rejected) {
    blockers.push("Identity rejected — no Lead Engine entry.")
  }

  if (input.dedupe_matched) {
    blockers.push("Duplicate candidate — dedupe protection active.")
  }

  const threshold_passed =
    input.intent_score >= GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD &&
    consentOk &&
    !input.identity.identity_rejected &&
    input.aggregated.primary_session.consent_status !== "denied"

  const lead_engine_eligible = threshold_passed && !input.dedupe_matched

  return {
    threshold_passed,
    lead_engine_eligible,
    reasons,
    blockers,
  }
}
