export const GROWTH_LEAD_SOURCE_KINDS = [
  "manual",
  "import",
  "web",
  "referral",
  "partner",
  "other",
] as const

import type { GrowthContactTemperature } from "@/lib/growth/outbound/types"
import type { GrowthLeadCallDisposition, GrowthCallPriorityTier } from "@/lib/growth/call-types"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import type { GrowthLeadAgingBucket } from "@/lib/growth/lead-aging"
import type { GrowthMomentumTier } from "@/lib/growth/momentum-types"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"

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

export const GROWTH_LEAD_RESEARCH_PRIORITIES = ["low", "normal", "high", "critical"] as const

export type GrowthLeadResearchPriority = (typeof GROWTH_LEAD_RESEARCH_PRIORITIES)[number]

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
  latestResearchRunId: string | null
  lastResearchedAt: string | null
  researchPriority: GrowthLeadResearchPriority
  callDisposition: GrowthLeadCallDisposition | null
  callDispositionAt: string | null
  lastCallAt: string | null
  followUpAt: string | null
  callPriorityScore: number | null
  callPriorityTier: GrowthCallPriorityTier | null
  callPriorityComputedAt: string | null
  callPriorityOverride: number | null
  lastHumanTouchAt: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId: string | null
  nextBestAction: GrowthNextBestAction | null
  nextBestActionReason: string | null
  nextBestActionComputedAt: string | null
  estimatedAnnualRevenue: string | null
  estimatedEmployeeCount: string | null
  fleetSizeEstimate: string | null
  crmDetected: string | null
  fieldServiceStackDetected: string | null
  momentumScore: number | null
  momentumTier: GrowthMomentumTier | null
  momentumWhySummary: string | null
  momentumComputedAt: string | null
  workflowHealth: GrowthWorkflowHealthStatus | null
  workflowHealthReason: string | null
  workflowHealthComputedAt: string | null
  sourceChannel: string | null
  sourceCampaign: string | null
  sourceImportBatchId: string | null
  sourceVendor: string | null
  agingDays: number | null
  agingBucket: GrowthLeadAgingBucket | null
  firstHumanTouchAt: string | null
  timeToFirstTouchHours: number | null
  contactTemperature: GrowthContactTemperature | null
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
  researchPriority?: GrowthLeadResearchPriority
  callPriorityOverride?: number | null
  decisionMakerStatus?: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId?: string | null
  estimatedAnnualRevenue?: string | null
  estimatedEmployeeCount?: string | null
  fleetSizeEstimate?: string | null
  crmDetected?: string | null
  fieldServiceStackDetected?: string | null
  sourceChannel?: string | null
  sourceCampaign?: string | null
  sourceImportBatchId?: string | null
  sourceVendor?: string | null
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
  researchPriority?: GrowthLeadResearchPriority
  callPriorityOverride?: number | null
  decisionMakerStatus?: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId?: string | null
  estimatedAnnualRevenue?: string | null
  estimatedEmployeeCount?: string | null
  fleetSizeEstimate?: string | null
  crmDetected?: string | null
  fieldServiceStackDetected?: string | null
  sourceChannel?: string | null
  sourceCampaign?: string | null
  sourceImportBatchId?: string | null
  sourceVendor?: string | null
  assignedTo?: string | null
}

export type ListGrowthLeadsInput = {
  status?: GrowthLeadStatus
  limit?: number
  offset?: number
}
