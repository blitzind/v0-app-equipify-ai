/** Client-safe prospect intelligence research types (slice 6.28A). */

export const GROWTH_AI_RESEARCH_AGENT_QA_MARKER = "ai-research-agent-v1" as const

export const GROWTH_RESEARCH_RUN_STATUSES = ["queued", "running", "completed", "failed"] as const
export type GrowthResearchRunStatus = (typeof GROWTH_RESEARCH_RUN_STATUSES)[number]

export const GROWTH_RESEARCH_PAIN_SIGNALS = [
  "missing_online_booking",
  "weak_reviews",
  "missing_customer_portal",
  "outdated_site",
  "weak_mobile",
  "no_financing",
  "missing_chat",
  "limited_service_visibility",
  "no_trust_indicators",
  "missing_scheduling_flow",
  "weak_cta_density",
  "weak_customer_retention_indicators",
] as const

export type GrowthResearchPainSignal = (typeof GROWTH_RESEARCH_PAIN_SIGNALS)[number]

export const GROWTH_RESEARCH_INDUSTRIES = [
  "HVAC",
  "Electrical",
  "Medical Equipment",
  "Plumbing",
  "Garage Door",
  "MEP",
  "Field Service",
  "Appliance Repair",
  "Commercial Equipment",
  "Specialty Contractor",
  "Equipment Service",
  "Unknown",
] as const

export type GrowthResearchIndustry = (typeof GROWTH_RESEARCH_INDUSTRIES)[number]

export const GROWTH_RESEARCH_RECOMMENDED_ACTIONS = [
  "Call Prospect",
  "Enroll Sequence",
  "Review Website",
  "Schedule Demo",
  "Follow Up",
  "Manual Review",
] as const

export type GrowthResearchRecommendedAction = (typeof GROWTH_RESEARCH_RECOMMENDED_ACTIONS)[number]

export type GrowthResearchCompetitorHint = {
  name: string
  source: string
  confidence: number
}

export type GrowthResearchSignals = {
  painSignals: GrowthResearchPainSignal[]
  maturityBreakdown?: Record<string, number>
  hasSsl?: boolean
  hasMobileViewport?: boolean
  hasOnlineBooking?: boolean
  hasCustomerPortal?: boolean
  hasChatWidget?: boolean
  hasFinancing?: boolean
  hasSocialLinks?: boolean
  hasReviewLinks?: boolean
  /** GE-AIOS-22 — structured company evidence profile for reuse across AI surfaces. */
  companyEvidence_v22?: import("@/lib/growth/research/company-evidence/company-evidence-types").GrowthCompanyEvidenceBundle
}

export type GrowthResearchRunPublicView = {
  id: string
  leadId: string
  status: GrowthResearchRunStatus
  websiteUrl: string | null
  companyName: string | null
  industryGuess: GrowthResearchIndustry | string | null
  employeeSizeGuess: string | null
  revenueSizeGuess: string | null
  websiteMaturityScore: number | null
  socialPresenceScore: number | null
  reputationScore: number | null
  technologyScore: number | null
  detectedTechnologies: string[]
  signals: GrowthResearchSignals
  competitors: GrowthResearchCompetitorHint[]
  researchSummary: string | null
  suggestedPitchAngle: string | null
  suggestedSequence: string | null
  suggestedCallOpening: string | null
  recommendedNextAction: GrowthResearchRecommendedAction | string | null
  researchConfidence: number | null
  completedAt: string | null
  failedReason: string | null
  createdAt: string
}

export type GrowthProspectIntelligenceBundle = {
  leadId: string
  latestRun: GrowthResearchRunPublicView | null
  runs: GrowthResearchRunPublicView[]
}

export type GrowthResearchCoverageSummary = {
  totalLeads: number
  researchedLeads: number
  researchCompletePercent: number
  unresearchedLeads: number
  weakWebsiteOpportunities: number
  topPainSignals: { signal: GrowthResearchPainSignal | string; count: number }[]
  topIndustries: { industry: string; count: number }[]
}

export type GrowthWebsiteScrapeResult = {
  url: string | null
  fetchStatus: string
  title: string | null
  metaDescription: string | null
  services: string[]
  serviceAreas: string[]
  contactMethods: string[]
  plainText: string
  html: string
  hasSsl: boolean
  hasMobileViewport: boolean
}

export type GrowthTechnologyDetectionResult = {
  technologies: string[]
  score: number
}

export type GrowthIndustryClassificationResult = {
  industry: GrowthResearchIndustry
  confidence: number
}

export type GrowthWebsiteMaturityResult = {
  score: number
  breakdown: Record<string, number>
}

export type GrowthPainSignalDetectionResult = {
  painSignals: GrowthResearchPainSignal[]
}

export type GrowthCompanySignalBuildResult = {
  socialPresenceScore: number
  reputationScore: number
  employeeSizeGuess: string | null
  revenueSizeGuess: string | null
  competitors: GrowthResearchCompetitorHint[]
}
