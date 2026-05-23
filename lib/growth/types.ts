export const GROWTH_LEAD_SOURCE_KINDS = [
  "manual",
  "import",
  "web",
  "referral",
  "partner",
  "other",
] as const

export type GrowthLeadSourceKind = (typeof GROWTH_LEAD_SOURCE_KINDS)[number]

export const GROWTH_LEAD_STATUSES = [
  "new",
  "researching",
  "enriched",
  "qualified",
  "in_outreach",
  "replied",
  "call_ready",
  "converted",
  "disqualified",
  "archived",
] as const

export type GrowthLeadStatus = (typeof GROWTH_LEAD_STATUSES)[number]

export type GrowthLead = {
  id: string
  sourceKind: GrowthLeadSourceKind
  sourceDetail: string | null
  externalRef: string | null
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  status: GrowthLeadStatus
  promotedOrganizationId: string | null
  promotedProspectId: string | null
  promotedAt: string | null
  score: number | null
  notes: string | null
  metadata: Record<string, unknown>
  createdBy: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

export type CreateGrowthLeadInput = {
  sourceKind?: GrowthLeadSourceKind
  sourceDetail?: string | null
  externalRef?: string | null
  companyName: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  status?: GrowthLeadStatus
  score?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  assignedTo?: string | null
  createdBy?: string | null
}

export type UpdateGrowthLeadInput = {
  sourceKind?: GrowthLeadSourceKind
  sourceDetail?: string | null
  externalRef?: string | null
  companyName?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  status?: GrowthLeadStatus
  score?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  assignedTo?: string | null
}

export type ListGrowthLeadsInput = {
  status?: GrowthLeadStatus
  limit?: number
  offset?: number
}
