/** GE-AIOS-22 — Compare verified company evidence to approved profile + mission (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type {
  GrowthCompanyEvidenceMissionComparison,
  GrowthCompanyEvidenceMissionMatchLabel,
  GrowthCompanyEvidenceProfile,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function overlapScore(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right.map(normalizeText))
  let matches = 0
  for (const item of left) {
    if (rightSet.has(normalizeText(item))) matches += 1
  }
  return matches / Math.max(left.length, 1)
}

function containsAny(haystack: string, needles: string[]): boolean {
  const normalized = normalizeText(haystack)
  return needles.some((needle) => normalized.includes(normalizeText(needle)))
}

function collectEvidenceText(profile: GrowthCompanyEvidenceProfile): string {
  const parts: string[] = []
  if (profile.companyDescription?.value) parts.push(profile.companyDescription.value)
  for (const field of [
    profile.industriesServed,
    profile.primaryProducts,
    profile.primaryServices,
    profile.targetCustomers,
    profile.geographicMarkets,
  ]) {
    parts.push(...(field?.values ?? []))
  }
  return parts.join(" ")
}

function inferEvidenceLabels(text: string): GrowthCompanyEvidenceMissionMatchLabel[] {
  const labels: GrowthCompanyEvidenceMissionMatchLabel[] = []

  if (containsAny(text, ["manufacturing", "cnc", "precision machining", "fabrication"])) {
    labels.push("strong_manufacturing_match")
  }
  if (containsAny(text, ["industrial", "b2b", "commercial equipment", "oem"])) {
    labels.push("industrial_b2b")
  }
  if (containsAny(text, ["medical device", "medical equipment", "healthcare device"])) {
    labels.push("medical_device_supplier")
  }
  if (containsAny(text, ["retail", "consumer", "ecommerce", "shop online"])) {
    labels.push("consumer_retail")
  }
  if (containsAny(text, ["construction", "contractor", "roofing", "hvac"])) {
    labels.push("construction")
  }
  if (containsAny(text, ["software", "saas", "platform", "app development"])) {
    labels.push("software_vendor")
  }

  return labels
}

export function compareCompanyEvidenceToMission(input: {
  profile: GrowthCompanyEvidenceProfile
  approvedProfile: BusinessProfileDraftContent | null
  activeMissionTitle?: string | null
}): GrowthCompanyEvidenceMissionComparison {
  const evidenceText = collectEvidenceText(input.profile)
  const labels = inferEvidenceLabels(evidenceText)
  const explanations: string[] = []

  if (!evidenceText.trim()) {
    return {
      labels: ["insufficient_evidence"],
      explanations: ["Insufficient verified website evidence to compare against mission and profile."],
      profileAlignmentScore: 0,
      evidenceBacked: false,
    }
  }

  if (input.profile.companyDescription?.value) {
    explanations.push(
      `Website identifies the company as: ${input.profile.companyDescription.value.slice(0, 180)}`,
    )
  }

  if (input.profile.industriesServed?.values.length) {
    explanations.push(
      `Serves ${input.profile.industriesServed.values.slice(0, 4).join(", ")} industries (verified on website).`,
    )
  }

  if (input.profile.geographicMarkets?.values.length) {
    explanations.push(
      `Markets referenced: ${input.profile.geographicMarkets.values.slice(0, 4).join(", ")}.`,
    )
  }

  let profileAlignmentScore = 0.35

  if (input.approvedProfile) {
    const targetIndustries = input.approvedProfile.idealCustomers.targetIndustries ?? []
    const targetGeography = input.approvedProfile.idealCustomers.geography ?? []
    const disqualifiers = input.approvedProfile.idealCustomers.disqualifiers ?? []
    const profileKeywords = [
      ...tokenize(input.approvedProfile.company.shortDescription ?? ""),
      ...(input.approvedProfile.company.productsServices ?? []).flatMap(tokenize),
      ...(input.approvedProfile.problemsAndTriggers.keywords ?? []).flatMap(tokenize),
    ]

    const industryOverlap = overlapScore(input.profile.industriesServed?.values ?? [], targetIndustries)
    const geoOverlap = overlapScore(input.profile.geographicMarkets?.values ?? [], targetGeography)
    const keywordOverlap = overlapScore(tokenize(evidenceText), profileKeywords)

    profileAlignmentScore = Math.min(
      1,
      0.25 + industryOverlap * 0.35 + geoOverlap * 0.2 + keywordOverlap * 0.2,
    )

    if (industryOverlap >= 0.4) {
      labels.push("profile_aligned")
      explanations.push("Industry signals align with approved company profile target industries.")
    } else if (targetIndustries.length > 0) {
      labels.push("profile_mismatch")
      explanations.push("Website industries do not strongly match approved profile target industries.")
    }

    for (const disqualifier of disqualifiers) {
      if (containsAny(evidenceText, [disqualifier])) {
        labels.push("profile_mismatch")
        explanations.push(`Website evidence references disqualifier: ${disqualifier}.`)
        profileAlignmentScore = Math.min(profileAlignmentScore, 0.35)
      }
    }

    if (targetGeography.length > 0 && geoOverlap < 0.15 && input.profile.geographicMarkets?.values.length) {
      labels.push("outside_geographic_focus")
      explanations.push("Geographic focus appears outside approved profile target geography.")
    }
  }

  if (input.activeMissionTitle?.trim()) {
    explanations.push(`Evaluated against active mission: ${input.activeMissionTitle.trim()}.`)
  }

  return {
    labels: [...new Set(labels)],
    explanations,
    profileAlignmentScore,
    evidenceBacked: true,
  }
}
