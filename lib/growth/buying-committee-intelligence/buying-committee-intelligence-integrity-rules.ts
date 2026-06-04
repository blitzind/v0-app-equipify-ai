import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export type BuyingCommitteeIntelligenceMemberRow = {
  id: string
  company_id: string
  person_id: string
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  verification_status: string
  confidence: number
}

export function evaluateBuyingCommitteeMemberPromotion(input: {
  existing: BuyingCommitteeIntelligenceMemberRow | null
  target_company_id: string
  target_person_id: string
  incoming_confidence: number
  incoming_verification_status: string
}): { allowed: boolean; reason: string } {
  if (!input.existing) {
    return { allowed: true, reason: "No existing canonical committee assignment for this person+role." }
  }

  if (input.existing.company_id !== input.target_company_id) {
    return {
      allowed: false,
      reason: "Canonical committee assignment is owned by a different company.",
    }
  }
  if (input.existing.person_id !== input.target_person_id) {
    return {
      allowed: false,
      reason: "Canonical committee assignment person_id mismatch.",
    }
  }

  if (input.existing.verification_status === "verified") {
    if (
      input.incoming_verification_status === "verified" &&
      input.incoming_confidence > input.existing.confidence
    ) {
      return { allowed: true, reason: "Replacing verified assignment with higher-confidence evidence." }
    }
    return {
      allowed: false,
      reason: "Existing verified committee assignment has equal or higher confidence.",
    }
  }

  if (input.incoming_verification_status !== "verified") {
    return { allowed: false, reason: "Only verified assignments may supersede an existing row." }
  }

  return { allowed: true, reason: "Promoting verified assignment over non-verified existing row." }
}
