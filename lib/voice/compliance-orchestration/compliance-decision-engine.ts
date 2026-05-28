/** Deterministic compliance decision engine — Phase 4C. Conservative by default. */

import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type {
  CommunicationComplianceEvaluationContext,
  CommunicationComplianceEvaluationInput,
  CommunicationComplianceResult,
  VoiceComplianceDecision,
  VoiceConsentChannel,
  VoiceConsentStatus,
} from "@/lib/voice/compliance-orchestration/types"

const HIGH_RISK_CHANNELS: VoiceConsentChannel[] = [
  "sms",
  "voicemail",
  "ringless_voicemail",
  "voice_call",
]

const MEDIUM_RISK_CHANNELS: VoiceConsentChannel[] = ["email", "callback"]

function consentAllowsContact(status: VoiceConsentStatus, channel: VoiceConsentChannel): boolean {
  if (status === "granted") return true
  if (status === "denied" || status === "revoked" || status === "expired") return false
  if (status === "manual_review_required") return false
  return false
}

function unknownConsentDecision(channel: VoiceConsentChannel): VoiceComplianceDecision {
  if (HIGH_RISK_CHANNELS.includes(channel)) return "manual_review_required"
  if (MEDIUM_RISK_CHANNELS.includes(channel)) return "manual_review_required"
  return "manual_review_required"
}

export function evaluateCommunicationCompliance(
  input: CommunicationComplianceEvaluationInput,
  context: CommunicationComplianceEvaluationContext,
): CommunicationComplianceResult {
  const reasons: string[] = []
  const requiredActions: string[] = []
  const evidence: string[] = []
  let decision: VoiceComplianceDecision = "allowed"

  const normalized = normalizePhoneNumber(input.phoneNumber)
  if (!normalized || normalized.length < 10) {
    return buildResult("blocked", ["invalid_phone_number"], ["verify_phone_number"], [
      "Phone number failed normalization.",
    ])
  }

  if (context.isOptedOut) {
    return buildResult("blocked", ["opt_out"], ["remove_from_campaigns"], ["Number is on organization opt-out registry."])
  }

  for (const suppression of context.activeSuppressions) {
    if (suppression.severity === "high" || suppression.suppressionType === "legal_hold") {
      return buildResult(
        "blocked",
        [`suppression_${suppression.suppressionType}`],
        ["review_suppression_entry"],
        [suppression.suppressionReason || suppression.suppressionType],
      )
    }
    reasons.push(`suppression_${suppression.suppressionType}`)
    evidence.push(suppression.suppressionReason)
  }

  if (context.dncListed === true) {
    return buildResult("blocked", ["dnc_listed"], ["remove_from_outbound"], ["Number is on DNC registry."])
  }

  if (context.dncListed === null) {
    const dncDecision = HIGH_RISK_CHANNELS.includes(input.channel) ? "manual_review_required" : "manual_review_required"
    return buildResult(dncDecision, ["dnc_status_unknown"], ["verify_dnc_status"], [
      "DNC status unknown — conservative manual review.",
    ])
  }

  if (!consentAllowsContact(context.consentStatus, input.channel)) {
    if (context.consentStatus === "unknown") {
      decision = unknownConsentDecision(input.channel)
      reasons.push("consent_unknown")
      requiredActions.push("capture_consent_or_manual_review")
      evidence.push(`Consent status unknown for channel ${input.channel}.`)
    } else {
      return buildResult("blocked", [`consent_${context.consentStatus}`], ["do_not_contact"], [
        `Consent status is ${context.consentStatus}.`,
      ])
    }
  }

  if (context.duplicateInCampaign) {
    return buildResult("blocked", ["duplicate_campaign_recipient"], ["dedupe_recipients"], [
      "Duplicate recipient in campaign.",
    ])
  }

  if (context.recentContactWithinCap) {
    return buildResult("blocked", ["frequency_cap"], ["wait_for_cooldown"], [
      "Recent contact within frequency cap window.",
    ])
  }

  if (context.relationshipSuppressed) {
    return buildResult("blocked", ["relationship_suppression"], ["review_relationship_context"], [
      "Relationship-level suppression active.",
    ])
  }

  if (context.providerReputationFlag) {
    decision = escalate(decision, "manual_review_required")
    reasons.push("provider_reputation")
    requiredActions.push("operator_review")
    evidence.push("Provider reputation flag — manual review.")
  }

  if (!context.timezoneKnown || context.withinCallHours === null) {
    decision = escalate(decision, "manual_review_required")
    reasons.push("call_hours_unknown")
    requiredActions.push("confirm_timezone_and_hours")
    evidence.push("Call-hour timezone could not be verified.")
  } else if (context.withinCallHours === false) {
    decision = escalate(decision, "manual_review_required")
    reasons.push("outside_call_hours")
    requiredActions.push("schedule_within_allowed_hours")
    evidence.push("Outside configured call-hour window.")
  }

  if (decision === "allowed" && reasons.length === 0) {
    evidence.push(`Compliance checks passed for ${input.channel}.`)
  }

  return buildResult(decision, reasons, requiredActions, evidence)
}

function escalate(current: VoiceComplianceDecision, next: VoiceComplianceDecision): VoiceComplianceDecision {
  if (current === "blocked" || next === "blocked") return "blocked"
  if (current === "manual_review_required" || next === "manual_review_required") return "manual_review_required"
  return "allowed"
}

function buildResult(
  decision: VoiceComplianceDecision,
  reasons: string[],
  requiredActions: string[],
  evidence: string[],
): CommunicationComplianceResult {
  return {
    decision,
    allowed: decision === "allowed",
    blocked: decision === "blocked",
    manualReviewRequired: decision === "manual_review_required",
    reasons,
    requiredActions,
    evidence,
    expiresAt: null,
  }
}

export function mapComplianceToRecipientStatus(result: CommunicationComplianceResult): {
  status: "pending" | "suppressed" | "skipped"
  manualReviewRequired: boolean
} {
  if (result.blocked) return { status: "suppressed", manualReviewRequired: false }
  if (result.manualReviewRequired) return { status: "pending", manualReviewRequired: true }
  return { status: "pending", manualReviewRequired: false }
}

export function mapComplianceResultToRecipientPatch(result: CommunicationComplianceResult) {
  const mapped = mapComplianceToRecipientStatus(result)
  return {
    status: mapped.status,
    manualReviewRequired: mapped.manualReviewRequired,
    complianceDecision: result.decision,
    complianceReasons: result.reasons,
    suppressionReason: result.blocked ? result.reasons[0] ?? "compliance_blocked" : null,
  }
}
