/**
 * Canonical Growth Engine runtime feature registry (Phase 8G).
 *
 * Single source of truth for capability tiers and cold-storage intent.
 * **Not enforced in Phase 8G** — routes, UI, polling, and APIs remain unchanged until Phase 8H wiring.
 */

export const GROWTH_FEATURE_REGISTRY_VERSION = "8g.1" as const

export type GrowthFeatureMode =
  | "active"
  | "cold_hidden_disabled"
  | "lazy_on_demand"

export type GrowthFeatureTier = 1 | 2 | 3

export type GrowthFeatureConfig = {
  enabled: boolean
  mode: GrowthFeatureMode
  adminOnly?: boolean
  /** Human-readable label for docs and future operator tooling. */
  label: string
  /** Packaging tier — see docs/GROWTH_RUNTIME_FEATURE_REGISTRY_8G.md */
  tier: GrowthFeatureTier
}

export type GrowthFeatureKey =
  // Tier 1 — Active (core operator workflow)
  | "prospectSearch"
  | "apolloImport"
  | "canonicalCompanies"
  | "canonicalPersons"
  | "companyIntelligence"
  | "buyingCommittee"
  | "leadResearch"
  | "accountPlaybooks"
  | "personalization"
  | "emailGeneration"
  | "smsGeneration"
  | "voiceDropGeneration"
  | "sequenceExecution"
  | "scheduler"
  | "unifiedInbox"
  | "timeline"
  | "notifications"
  | "replyIntelligence"
  | "engagementScoring"
  | "nextBestAction"
  | "meetingRecommendations"
  | "humanApprovalEngine"
  // Tier 2 — Hidden + disabled (cold storage)
  | "campaignBuilder"
  | "sequencePreviewStudio"
  | "agentOrchestrationDashboard"
  | "humanInterventionDashboard"
  | "diagnosticsDashboards"
  | "realtimeEventBus"
  | "executionGraphs"
  | "workflowSummaryAutofetch"
  // Tier 3 — On-demand (lazy load)
  | "conversationalPlaybooks"
  | "smartFollowUpPolicies"
  | "sequenceExitCandidates"
  | "revenueCommandCenter"
  | "forecastEvidence"
  | "executionPlans"
  | "bookingIntelligence"
  | "opportunityRecommendations"

export type GrowthFeatureRegistry = Readonly<Record<GrowthFeatureKey, GrowthFeatureConfig>>

const tier1Active = (label: string): GrowthFeatureConfig => ({
  enabled: true,
  mode: "active",
  label,
  tier: 1,
})

const tier2Cold = (label: string): GrowthFeatureConfig => ({
  enabled: false,
  mode: "cold_hidden_disabled",
  adminOnly: true,
  label,
  tier: 2,
})

const tier3Lazy = (label: string): GrowthFeatureConfig => ({
  enabled: true,
  mode: "lazy_on_demand",
  label,
  tier: 3,
})

/** Static registry — documents intended runtime posture; enforcement is opt-in in Phase 8H+. */
export const GROWTH_FEATURE_REGISTRY: GrowthFeatureRegistry = {
  // Tier 1 — Active
  prospectSearch: tier1Active("Prospect search"),
  apolloImport: tier1Active("Apollo import"),
  canonicalCompanies: tier1Active("Canonical companies"),
  canonicalPersons: tier1Active("Canonical persons"),
  companyIntelligence: tier1Active("Company intelligence"),
  buyingCommittee: tier1Active("Buying committee intelligence"),
  leadResearch: tier1Active("Lead research"),
  accountPlaybooks: tier1Active("Account playbooks"),
  personalization: tier1Active("Personalization"),
  emailGeneration: tier1Active("Email generation"),
  smsGeneration: tier1Active("SMS generation"),
  voiceDropGeneration: tier1Active("Voice drop generation"),
  sequenceExecution: tier1Active("Sequence execution"),
  scheduler: tier1Active("Sequence scheduler"),
  unifiedInbox: tier1Active("Unified inbox"),
  timeline: tier1Active("Activity timeline"),
  notifications: tier1Active("Operator notifications"),
  replyIntelligence: tier1Active("Reply intelligence"),
  engagementScoring: tier1Active("Engagement scoring"),
  nextBestAction: tier1Active("Next best action"),
  meetingRecommendations: tier1Active("Meeting recommendations"),
  humanApprovalEngine: tier1Active("Human approval engine"),

  // Tier 2 — Hidden + disabled
  campaignBuilder: tier2Cold("Campaign builder"),
  sequencePreviewStudio: tier2Cold("Sequence preview studio"),
  agentOrchestrationDashboard: tier2Cold("Agent orchestration dashboard"),
  humanInterventionDashboard: tier2Cold("Human intervention dashboard"),
  diagnosticsDashboards: tier2Cold("Diagnostics dashboards"),
  realtimeEventBus: tier2Cold("Realtime event bus"),
  executionGraphs: tier2Cold("Execution graphs"),
  workflowSummaryAutofetch: tier2Cold("Workflow summary autofetch"),

  // Tier 3 — On-demand
  conversationalPlaybooks: tier3Lazy("Conversational playbooks"),
  smartFollowUpPolicies: tier3Lazy("Smart follow-up policies"),
  sequenceExitCandidates: tier3Lazy("Sequence exit candidates"),
  revenueCommandCenter: tier3Lazy("Revenue command center"),
  forecastEvidence: tier3Lazy("Forecast evidence"),
  executionPlans: tier3Lazy("Execution plans"),
  bookingIntelligence: tier3Lazy("Booking intelligence"),
  opportunityRecommendations: tier3Lazy("Opportunity recommendations"),
} as const

export const GROWTH_FEATURE_KEYS = Object.keys(GROWTH_FEATURE_REGISTRY) as GrowthFeatureKey[]

export function getGrowthFeatureConfig(key: GrowthFeatureKey): GrowthFeatureConfig {
  return GROWTH_FEATURE_REGISTRY[key]
}

export function listGrowthFeaturesByTier(tier: GrowthFeatureTier): GrowthFeatureKey[] {
  return GROWTH_FEATURE_KEYS.filter((key) => GROWTH_FEATURE_REGISTRY[key].tier === tier)
}

export function listGrowthFeaturesByMode(mode: GrowthFeatureMode): GrowthFeatureKey[] {
  return GROWTH_FEATURE_KEYS.filter((key) => GROWTH_FEATURE_REGISTRY[key].mode === mode)
}
