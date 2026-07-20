/** GE-AIOS-NEXT-3B — Admission evidence projection (client-safe, reuses 21C reason vocabulary). */

import type {
  GrowthAdmissionEvidenceCategory,
  GrowthAdmissionEvidenceFinding,
  GrowthAdmissionReasonCategoryCount,
  GrowthDiscoveryIntakeEvidence,
  GrowthEvidenceCompletenessClassification,
} from "./growth-organizational-evidence-completeness-next-3b-types"

export const GROWTH_ADMISSION_EVIDENCE_CATEGORY_LABELS: Record<GrowthAdmissionEvidenceCategory, string> = {
  policy: "Policy gate",
  icp_mismatch: "ICP mismatch",
  geography: "Geography",
  industry: "Industry",
  data_quality: "Data quality",
  duplicate: "Duplicate prevention",
  missing_evidence: "Missing evidence",
  unknown: "Unknown",
}

const CATEGORY_ORDER: GrowthAdmissionEvidenceCategory[] = [
  "policy",
  "icp_mismatch",
  "industry",
  "geography",
  "data_quality",
  "duplicate",
  "missing_evidence",
  "unknown",
]

export function categorizeGrowthLeadAdmissionReason(reason: string): GrowthAdmissionEvidenceCategory {
  const normalized = reason.trim().toLowerCase()
  if (!normalized) return "unknown"

  if (
    normalized.includes("operational_keyword") ||
    normalized.includes("industry_gate") ||
    normalized.includes("prospect_search_industry")
  ) {
    return "policy"
  }
  if (
    normalized.startsWith("negative_keyword:") ||
    normalized.startsWith("profile_disqualifier:") ||
    normalized.startsWith("known_icp_mismatch:")
  ) {
    return "icp_mismatch"
  }
  if (normalized.includes("industry_not_in_approved_profile")) return "industry"
  if (normalized.includes("geography") || normalized.includes("geo_") || normalized.includes("region")) {
    return "geography"
  }
  if (
    normalized.includes("consumer_domain") ||
    normalized.includes("invalid_company") ||
    normalized.includes("missing_credible") ||
    normalized.includes("identity_uncertain") ||
    normalized.includes("skipped_invalid")
  ) {
    return "data_quality"
  }
  if (normalized.includes("duplicate") || normalized.includes("already_exists")) return "duplicate"
  if (
    normalized.includes("missing_approved_profile") ||
    normalized.includes("pending_operational") ||
    normalized.includes("insufficient_evidence")
  ) {
    return "missing_evidence"
  }
  return "unknown"
}

const NON_REJECTION_REASONS = new Set([
  "profile_aligned",
  "operational_keyword_validation_passed",
])

export function aggregateAdmissionReasonCategories(
  evaluations: Array<{ evaluatedState: string; reasons: string[] }>,
): GrowthAdmissionReasonCategoryCount[] {
  const buckets = new Map<GrowthAdmissionEvidenceCategory, { count: number; examples: Set<string> }>()

  for (const evaluation of evaluations) {
    if (evaluation.evaluatedState === "accepted") continue
    for (const reason of evaluation.reasons) {
      const normalized = reason.trim().toLowerCase()
      if (NON_REJECTION_REASONS.has(normalized)) continue
      const category = categorizeGrowthLeadAdmissionReason(reason)
      const bucket = buckets.get(category) ?? { count: 0, examples: new Set<string>() }
      bucket.count += 1
      if (bucket.examples.size < 3) bucket.examples.add(reason)
      buckets.set(category, bucket)
    }
  }

  return CATEGORY_ORDER.filter((category) => buckets.has(category))
    .map((category) => {
      const bucket = buckets.get(category)!
      return {
        category,
        label: GROWTH_ADMISSION_EVIDENCE_CATEGORY_LABELS[category],
        count: bucket.count,
        exampleReasons: [...bucket.examples],
      }
    })
    .sort((a, b) => b.count - a.count)
}

function classifyDiscoveryIntakeCompleteness(
  intake: GrowthDiscoveryIntakeEvidence,
): GrowthEvidenceCompletenessClassification {
  if (intake.discoveryRunsInWindow === 0) return "insufficient_evidence"
  if (intake.intakeSelectedTotal > 0 || intake.intakeRejectedTotal > 0 || intake.intakePushedTotal > 0) {
    return "available"
  }
  if (intake.providerRecordsInWindow > 0) return "partially_available"
  return "unknown"
}

export function buildAdmissionEvidenceFinding(input: {
  driftRows: Array<{ evaluatedState: string; reasons: string[] }>
  discoveryIntake: GrowthDiscoveryIntakeEvidence
}): GrowthAdmissionEvidenceFinding {
  const leadPoolReasonCategories = aggregateAdmissionReasonCategories(input.driftRows)
  const totalReasonHits = leadPoolReasonCategories.reduce((sum, row) => sum + row.count, 0)
  const primary = leadPoolReasonCategories[0] ?? null
  const primaryCategorySharePct =
    primary && totalReasonHits > 0 ? Math.round((primary.count / totalReasonHits) * 1000) / 10 : null

  const intakeCompleteness = classifyDiscoveryIntakeCompleteness(input.discoveryIntake)
  let completeness: GrowthEvidenceCompletenessClassification = "partially_available"
  if (leadPoolReasonCategories.length > 0 && intakeCompleteness === "available") completeness = "available"
  else if (leadPoolReasonCategories.length === 0 && intakeCompleteness === "insufficient_evidence") {
    completeness = "insufficient_evidence"
  }

  let evidenceBackedExplanation: string | null = null
  if (
    input.discoveryIntake.providerRecordsInWindow > 0 &&
    input.discoveryIntake.leadsAdmittedInWindow === 0 &&
    input.discoveryIntake.intakeRejectedTotal > 0
  ) {
    evidenceBackedExplanation =
      "Discovery yield is low primarily because provider survivors are rejected during portfolio intake before lead admission."
  } else if (primary && primaryCategorySharePct !== null && primaryCategorySharePct >= 40) {
    evidenceBackedExplanation = `Lead-pool admission friction is concentrated in ${primary.label.toLowerCase()} (${primaryCategorySharePct}% of recorded rejection reasons).`
  } else if (
    input.discoveryIntake.intakeExistingTotal > 0 &&
    input.discoveryIntake.intakePushedTotal === 0
  ) {
    evidenceBackedExplanation =
      "Discovery survivors largely match existing leads — duplicate prevention is absorbing provider volume."
  }

  return {
    completeness,
    leadPoolReasonCategories,
    discoveryIntake: input.discoveryIntake,
    primaryCategory: primary?.category ?? null,
    primaryCategorySharePct,
    evidenceBackedExplanation,
    qualificationNote:
      evidenceBackedExplanation === null
        ? "Insufficient categorized rejection evidence — Ava should not speculate about admission yield."
        : null,
  }
}
