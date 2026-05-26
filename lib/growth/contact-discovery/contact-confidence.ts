import type {
  GrowthContactCandidate,
  GrowthContactVerificationState,
} from "@/lib/growth/contact-discovery/contact-discovery-types"

const VERIFICATION_WEIGHT: Record<GrowthContactVerificationState, number> = {
  operator_verified: 0.25,
  unverified: 0.1,
  insufficient_evidence: 0,
  rejected: -0.2,
}

export function scoreContactCandidateConfidence(input: {
  base_confidence: number
  evidence_count: number
  verification_state: GrowthContactVerificationState
  has_observed_email: boolean
  has_observed_phone: boolean
  has_observed_linkedin: boolean
  title_role_match: boolean
}): number {
  let score = Math.min(0.85, Math.max(0.2, input.base_confidence))
  score += Math.min(0.12, input.evidence_count * 0.04)
  score += VERIFICATION_WEIGHT[input.verification_state] ?? 0
  if (input.has_observed_email) score += 0.04
  if (input.has_observed_phone) score += 0.03
  if (input.has_observed_linkedin) score += 0.02
  if (input.title_role_match) score += 0.06
  return Number(Math.min(0.99, Math.max(0, score)).toFixed(3))
}

export function averageContactConfidence(contacts: GrowthContactCandidate[]): number {
  if (contacts.length === 0) return 0
  const sum = contacts.reduce((acc, c) => acc + c.confidence, 0)
  return Number((sum / contacts.length).toFixed(3))
}
