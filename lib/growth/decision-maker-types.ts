/** Client-safe Growth Engine decision maker types. */

export const GROWTH_DECISION_MAKER_SOURCES = [
  "website",
  "public_web",
  "apollo",
  "seamless",
  "manual",
  "lead_contact",
] as const

export type GrowthDecisionMakerSource = (typeof GROWTH_DECISION_MAKER_SOURCES)[number]

export const GROWTH_DECISION_MAKER_STATUSES = ["suspected", "confirmed", "rejected"] as const

export type GrowthDecisionMakerStatus = (typeof GROWTH_DECISION_MAKER_STATUSES)[number]

export const GROWTH_DECISION_MAKER_PRESENCE_STATUSES = [
  "none",
  "suspected",
  "confirmed",
  "verified_contactable",
] as const

export type GrowthDecisionMakerPresenceStatus = (typeof GROWTH_DECISION_MAKER_PRESENCE_STATUSES)[number]

export type GrowthLeadDecisionMaker = {
  id: string
  leadId: string
  fullName: string
  title: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  source: GrowthDecisionMakerSource
  sourceDetail: string | null
  confidence: number | null
  evidenceExcerpt: string | null
  status: GrowthDecisionMakerStatus
  isPrimary: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthDecisionMakerCandidate = {
  fullName: string
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  source: GrowthDecisionMakerSource
  sourceDetail?: string | null
  confidence?: number | null
  evidenceExcerpt?: string | null
}
