/**
 * GE-IRE-7A — Canonical contact acquisition artifact (versioned, forward-compatible).
 */

export const GROWTH_CONTACT_ACQUISITION_QA_MARKER = "contact-acquisition-engine-v1" as const

export type AcquisitionCandidateVersion = 1

export type AcquisitionCommitteeRole =
  | "economic_buyer"
  | "champion"
  | "technical"
  | "user"
  | "unknown"

export type AcquisitionDeliverability = "verified" | "risky" | "unknown"

export type AcquisitionOutreachReadiness = "ready" | "research" | "blocked"

export type AcquisitionPreferredChannel = "email" | "linkedin" | "phone" | "mixed"

export type AcquisitionPrimaryContact = {
  personId?: string
  fullName: string
  title?: string
  email?: string
  confidence: number
}

export type AcquisitionVerification = {
  emailVerified: boolean
  deliverability: AcquisitionDeliverability
  confidence: number
}

export type AcquisitionCommittee = {
  role: AcquisitionCommitteeRole
  confidence: number
}

export type AcquisitionOutreach = {
  readiness: AcquisitionOutreachReadiness
  preferredChannel: AcquisitionPreferredChannel
  recommendedSequence?: string
}

export type AcquisitionBackupContact = {
  name: string
  title?: string
  role: AcquisitionCommitteeRole
  email?: string
  confidence: number
  reasonSelected: string
}

/**
 * Normalized overall confidence (CAE v1):
 *
 * overall =
 *   identity              × 0.20
 * + verification          × 0.25
 * + committee             × 0.20
 * + recommendation        × 0.25
 * + outreach_readiness    × 0.10
 *
 * All component scores are normalized to 0–100 before weighting.
 */
export const CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING = {
  version: "cae-v1",
  components: {
    identity: 0.2,
    verification: 0.25,
    committee: 0.2,
    recommendation: 0.25,
    outreach_readiness: 0.1,
  },
} as const

export type AcquisitionCandidate = {
  version: AcquisitionCandidateVersion
  companyId: string
  generatedAt: string
  primaryContact: AcquisitionPrimaryContact
  verification: AcquisitionVerification
  committee: AcquisitionCommittee
  outreach: AcquisitionOutreach
  backupContacts: AcquisitionBackupContact[]
  blockers: string[]
  reasons: string[]
  overallConfidence: number
}
