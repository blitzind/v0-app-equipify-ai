import {
  baseConfidenceForCompanyIntelligenceSource,
  confidenceTierForCompanyIntelligence,
} from "@/lib/growth/company-intelligence/company-intelligence-confidence"
import type {
  GrowthCompanyIntelligenceDraftFinding,
  GrowthCompanyIntelligenceVerificationStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

function valuePresent(draft: GrowthCompanyIntelligenceDraftFinding): boolean {
  const text = draft.value_text?.trim() ?? ""
  if (text) return true
  if (draft.value_json && Object.keys(draft.value_json).length > 0) return true
  return false
}

const SHORT_LITERAL_VALUES = new Set(["true", "false", "present", "yes", "no"])

function sourceEvidenceRows(draft: GrowthCompanyIntelligenceDraftFinding) {
  return draft.evidence.filter((e) => e.evidence_type !== "verification")
}

function evidenceSupportsValue(draft: GrowthCompanyIntelligenceDraftFinding): boolean {
  if (!valuePresent(draft)) return false
  const sourceEvidence = sourceEvidenceRows(draft)
  if (sourceEvidence.length === 0) return false

  const valueText = (draft.value_text ?? "").trim().toLowerCase()
  if (!valueText) return sourceEvidence.length > 0

  const isShortLiteral = valueText.length <= 12 || SHORT_LITERAL_VALUES.has(valueText)

  return sourceEvidence.some((e) => {
    const hay = `${e.evidence_text} ${JSON.stringify(e.metadata ?? {})}`.toLowerCase()

    if (draft.intelligence_category === "technology") {
      return hay.includes(valueText) || hay.includes(draft.intelligence_key.replace(/^tech_/, ""))
    }

    if (isShortLiteral) {
      if (hay.includes(valueText)) return true
      if (draft.intelligence_category === "hiring" && (valueText === "present" || valueText === "true")) {
        return /career|hiring|job|position|technician|manager|employment|openings/i.test(hay)
      }
      if (draft.intelligence_category === "website_signal" && valueText === "true") {
        return /social|review|booking|portal|chat|link|widget|financing/i.test(hay)
      }
      return false
    }

    return hay.includes(valueText.slice(0, 48))
  })
}

/**
 * Deterministic verification — evidence must support the proposed value; no AI, no paid enrichment.
 */
export function verifyCompanyIntelligenceDraft(
  draft: GrowthCompanyIntelligenceDraftFinding,
): {
  verification_status: GrowthCompanyIntelligenceVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthCompanyIntelligenceDraftFinding["confidence_tier"]
  evidence: GrowthCompanyIntelligenceDraftFinding["evidence"]
} {
  const reasons: string[] = []
  let verification_status: GrowthCompanyIntelligenceVerificationStatus = "unverified"
  let confidence = draft.confidence

  if (!valuePresent(draft)) {
    return failDraft(draft, ["Finding has no observable value."])
  }
  if (draft.evidence.length === 0) {
    return failDraft(draft, ["Every intelligence item requires source evidence."])
  }
  if (!evidenceSupportsValue(draft)) {
    return failDraft(draft, ["Evidence excerpt does not support the proposed value."])
  }

  const hasDirectWebsite = draft.evidence.some(
    (e) =>
      e.evidence_type === "website_page" ||
      e.evidence_type === "website_structured" ||
      e.evidence_type === "schema_org" ||
      e.evidence_type === "meta_tag" ||
      e.evidence_type === "pattern_match",
  )
  const stagingTrusted = draft.staging_trusted === true

  if (draft.source === "website" && hasDirectWebsite && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Public website evidence directly supports this intelligence item.")
  } else if (draft.source === "canonical_social" && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Canonical company social profile channel with URL evidence.")
  } else if (draft.source === "staging_company" && stagingTrusted && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Trusted staging company row with explicit field evidence.")
  } else if (draft.source === "canonical_company" && confidence >= 0.8) {
    verification_status = "probable"
    reasons.push("Existing canonical company field — lineage not re-crawled.")
  } else if (draft.source === "canonical_snapshot" && confidence >= 0.8) {
    verification_status = "probable"
    reasons.push("Prior intelligence snapshot — not re-derived this run.")
  } else if (hasDirectWebsite && confidence >= 0.7) {
    verification_status = "probable"
    reasons.push("Website evidence present; below verified confidence threshold.")
  } else if (confidence >= baseConfidenceForCompanyIntelligenceSource("manual")) {
    verification_status = "unverified"
    reasons.push("Value format valid; awaiting stronger public evidence.")
  } else {
    verification_status = "unverified"
    reasons.push("Insufficient public evidence for this intelligence item.")
  }

  const verified_at = verification_status === "verified" ? new Date().toISOString() : null
  const confidence_tier = confidenceTierForCompanyIntelligence({
    source: draft.source,
    verification_status,
    base_confidence: confidence,
  })

  const evidence = [
    ...draft.evidence,
    {
      evidence_type: "verification" as const,
      extraction_method: "deterministic_evidence_value_check",
      evidence_text: reasons.join(" · ") || `Verification: ${verification_status}`,
      confidence,
    },
  ]

  return {
    verification_status,
    verified_at,
    verification_provider: "growth_deterministic_company_intelligence_verify",
    verification_reasons: reasons,
    confidence,
    confidence_tier,
    evidence,
  }
}

function failDraft(
  draft: GrowthCompanyIntelligenceDraftFinding,
  reasons: string[],
): ReturnType<typeof verifyCompanyIntelligenceDraft> {
  return {
    verification_status: "invalid",
    verified_at: null,
    verification_provider: "growth_deterministic_company_intelligence_verify",
    verification_reasons: reasons,
    confidence: draft.confidence,
    confidence_tier: confidenceTierForCompanyIntelligence({
      source: draft.source,
      verification_status: "invalid",
      base_confidence: draft.confidence,
    }),
    evidence: [
      ...draft.evidence,
      {
        evidence_type: "verification",
        extraction_method: "deterministic_evidence_value_check",
        evidence_text: reasons.join(" · "),
        confidence: draft.confidence,
      },
    ],
  }
}
