import {
  baseConfidenceForBuyingCommitteeSource,
  confidenceTierForBuyingCommitteeIntelligence,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-confidence"
import type {
  GrowthBuyingCommitteeIntelligenceDraftAssignment,
  GrowthBuyingCommitteeIntelligenceVerificationStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

function sourceEvidenceRows(draft: GrowthBuyingCommitteeIntelligenceDraftAssignment) {
  return draft.evidence.filter((e) => e.evidence_type !== "verification")
}

function evidenceDeclaresMetadataRole(
  evidenceText: string,
  committee_role: string,
): boolean {
  const hay = evidenceText.toLowerCase()
  const roleToken = committee_role.trim().toLowerCase()
  return (
    hay.includes("metadata declares committee_role") &&
    (hay.includes(roleToken) || hay.includes(roleToken.replace(/_/g, " ")))
  )
}

/**
 * Evidence must substantiate the proposed role — not merely mention a person name.
 */
export function evidenceSupportsRole(draft: GrowthBuyingCommitteeIntelligenceDraftAssignment): boolean {
  const sourceEvidence = sourceEvidenceRows(draft)
  if (sourceEvidence.length === 0) return false

  const role = draft.committee_role
  const title = (draft.job_title ?? "").trim().toLowerCase()

  switch (draft.source) {
    case "canonical_role":
      return sourceEvidence.some(
        (e) =>
          e.evidence_type === "canonical_role" &&
          (e.evidence_text.toLowerCase().includes("role_type=") ||
            e.evidence_text.toLowerCase().includes(role.replace(/_/g, " ")) ||
            e.evidence_text.toLowerCase().includes(role)),
      )
    case "metadata_declared":
      return sourceEvidence.some(
        (e) =>
          e.evidence_type === "metadata_declared" &&
          evidenceDeclaresMetadataRole(e.evidence_text, role),
      )
    case "title_pattern":
      return sourceEvidence.some((e) => {
        if (e.evidence_type !== "title_pattern") return false
        const hay = e.evidence_text.toLowerCase()
        const method = (e.extraction_method ?? "").toLowerCase()
        return (
          hay.includes("title pattern") &&
          (hay.includes(role.replace(/_/g, " ")) || hay.includes(role)) &&
          (method.endsWith("_title") || hay.includes("matched"))
        )
      })
    case "confirmed_decision_maker":
      return sourceEvidence.some((e) => {
        if (e.evidence_type !== "confirmed_decision_maker") return false
        const hay = e.evidence_text.toLowerCase()
        return hay.includes("title pattern") && (title ? hay.includes(title.slice(0, 32)) : true)
      })
    default:
      return sourceEvidence.some((e) => {
        const hay = `${e.evidence_text} ${JSON.stringify(e.metadata ?? {})}`.toLowerCase()
        return hay.includes(role.replace(/_/g, " ")) || hay.includes(role)
      })
  }
}

/**
 * Deterministic verification — every assignment requires evidence; no AI, no paid enrichment.
 * Title-derived roles require deterministic pattern evidence (not blind title inference).
 */
export function verifyBuyingCommitteeIntelligenceDraft(
  draft: GrowthBuyingCommitteeIntelligenceDraftAssignment,
): {
  verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthBuyingCommitteeIntelligenceDraftAssignment["confidence_tier"]
  evidence: GrowthBuyingCommitteeIntelligenceDraftAssignment["evidence"]
} {
  const reasons: string[] = []
  let verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus = "unverified"
  let confidence = draft.confidence

  if (!draft.person_id?.trim()) {
    return failDraft(draft, ["Committee assignment requires a canonical person_id."])
  }
  if (!draft.full_name?.trim()) {
    return failDraft(draft, ["Committee assignment requires a person full_name."])
  }
  if (draft.evidence.length === 0) {
    return failDraft(draft, ["Every committee role assignment requires source evidence."])
  }
  if (!evidenceSupportsRole(draft)) {
    return failDraft(draft, ["Evidence excerpt does not support this committee role assignment."])
  }

  const hasCanonical = draft.evidence.some((e) => e.evidence_type === "canonical_role")
  const hasConfirmedDm = draft.evidence.some((e) => e.evidence_type === "confirmed_decision_maker")
  const hasTitlePattern = draft.evidence.some((e) => e.evidence_type === "title_pattern")
  const hasMetadataDeclared = draft.evidence.some(
    (e) =>
      e.evidence_type === "metadata_declared" &&
      evidenceDeclaresMetadataRole(e.evidence_text, draft.committee_role),
  )
  const stagingTrusted = draft.staging_trusted === true

  if (draft.source === "canonical_role" && hasCanonical && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Canonical person_company_roles assignment with explicit role_type evidence.")
  } else if (draft.source === "confirmed_decision_maker" && hasConfirmedDm && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Operator-confirmed lead decision maker with title pattern evidence.")
  } else if (
    draft.source === "metadata_declared" &&
    hasMetadataDeclared &&
    stagingTrusted &&
    confidence >= 0.85
  ) {
    verification_status = "verified"
    reasons.push(
      "Explicit committee_role in trusted staging metadata (verified contact or source evidence).",
    )
  } else if (draft.source === "metadata_declared" && !stagingTrusted) {
    verification_status = "unverified"
    reasons.push("metadata_declared requires verified contact status or trusted staging evidence.")
  } else if (draft.source === "staging_contact" && stagingTrusted && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Trusted staging contact with verified confidence threshold.")
  } else if (draft.source === "title_pattern" && hasTitlePattern && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Job title matched a deterministic committee role pattern with cited span.")
  } else if (hasTitlePattern && confidence >= 0.7) {
    verification_status = "probable"
    reasons.push("Title pattern evidence present; below verified confidence threshold.")
  } else if (hasCanonical && confidence >= 0.75) {
    verification_status = "probable"
    reasons.push("Canonical role evidence present; below verified promotion threshold.")
  } else if (confidence >= baseConfidenceForBuyingCommitteeSource("manual")) {
    verification_status = "unverified"
    reasons.push("Evidence present; awaiting stronger committee role proof.")
  } else {
    verification_status = "unverified"
    reasons.push("Insufficient evidence for this committee assignment.")
  }

  const verified_at = verification_status === "verified" ? new Date().toISOString() : null
  const confidence_tier = confidenceTierForBuyingCommitteeIntelligence({
    source: draft.source,
    verification_status,
    base_confidence: confidence,
  })

  const evidence = [
    ...draft.evidence,
    {
      evidence_type: "verification" as const,
      source_url: null,
      source_record_id: null,
      extraction_method: "deterministic_role_and_evidence",
      evidence_text: reasons.join(" · ") || `Verification: ${verification_status}`,
      confidence,
    },
  ]

  return {
    verification_status,
    verified_at,
    verification_provider: "growth_deterministic_buying_committee_verify",
    verification_reasons: reasons,
    confidence,
    confidence_tier,
    evidence,
  }
}

function failDraft(
  draft: GrowthBuyingCommitteeIntelligenceDraftAssignment,
  reasons: string[],
): {
  verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthBuyingCommitteeIntelligenceDraftAssignment["confidence_tier"]
  evidence: GrowthBuyingCommitteeIntelligenceDraftAssignment["evidence"]
} {
  return {
    verification_status: "invalid",
    verified_at: null,
    verification_provider: "growth_deterministic_buying_committee_verify",
    verification_reasons: reasons,
    confidence: draft.confidence,
    confidence_tier: "low",
    evidence: [
      ...draft.evidence,
      {
        evidence_type: "verification",
        evidence_text: reasons.join(" · "),
        confidence: draft.confidence,
      },
    ],
  }
}
