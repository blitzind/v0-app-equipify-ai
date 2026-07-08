/** GE-AIOS-8A-1/8A-2 — Ava Evidence Engine types (client-safe). */

export const GROWTH_EVIDENCE_ENGINE_QA_MARKER = "ge-aios-8a-2-evidence-engine-v1" as const

export const GROWTH_EVIDENCE_ENGINE_PHASE = "GE-AIOS-8A-2" as const

export const GROWTH_EVIDENCE_ENGINE_SCHEMA_MIGRATION =
  "20271002120000_growth_evidence_engine_ge_aios_8a_2.sql" as const

export const EVIDENCE_ENGINE_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
  "cached",
] as const

export type EvidenceEngineRunStatus = (typeof EVIDENCE_ENGINE_RUN_STATUSES)[number]

/** Canonical evidence source providers. */
export const EVIDENCE_ENGINE_PROVIDERS = [
  "website",
  "structured_website",
  "approved_profile",
  "crm",
  "knowledge_center",
  "operator_input",
  "ai_inference",
  "fallback",
] as const

export type EvidenceEngineProvider = (typeof EVIDENCE_ENGINE_PROVIDERS)[number]

/** Constitutional decision order — lower index = higher trust. */
export const EVIDENCE_ENGINE_DECISION_TIERS = [
  "explicit_website",
  "structured_extraction",
  "historical_customer",
  "ai_reasoning",
  "fallback_assumption",
] as const

export type EvidenceEngineDecisionTier = (typeof EVIDENCE_ENGINE_DECISION_TIERS)[number]

export const EVIDENCE_ENGINE_LIFECYCLE_STATUSES = [
  "active",
  "needs_review",
  "contradicted",
  "deprecated",
  "expired",
] as const

export type EvidenceEngineLifecycleStatus = (typeof EVIDENCE_ENGINE_LIFECYCLE_STATUSES)[number]

export const EVIDENCE_ENGINE_EVIDENCE_TYPES = [
  "website_page",
  "website_structured",
  "schema_org",
  "meta_tag",
  "pattern_match",
  "crm_record",
  "operator_input",
  "approved_profile",
  "knowledge_document",
  "ai_inference",
  "fallback_assumption",
] as const

export type EvidenceEngineEvidenceType = (typeof EVIDENCE_ENGINE_EVIDENCE_TYPES)[number]

export const EVIDENCE_ENGINE_FACT_CATEGORIES = [
  "company",
  "ideal_customers",
  "problems",
  "sales_marketing",
  "operations",
  "strategy",
  "support",
  "terminology",
] as const

export type EvidenceEngineFactCategory = (typeof EVIDENCE_ENGINE_FACT_CATEGORIES)[number]

export const EVIDENCE_ENGINE_TRIGGERS = [
  "initial",
  "scheduled_refresh",
  "operator_request",
  "profile_approved",
] as const

export type EvidenceEngineTrigger = (typeof EVIDENCE_ENGINE_TRIGGERS)[number]

export const EVIDENCE_ENGINE_CONTRADICTION_SEVERITIES = ["low", "medium", "high"] as const

export type EvidenceEngineContradictionSeverity = (typeof EVIDENCE_ENGINE_CONTRADICTION_SEVERITIES)[number]

/** Multi-dimensional confidence — never rely on a single score alone. */
export type EvidenceEngineConfidence = {
  evidence_confidence: number
  extraction_confidence: number
  verification_confidence: number
  freshness_confidence: number
  overall_confidence: number
}

export type AvaEvidenceItem = {
  evidence_id: string
  organization_id: string
  provider: EvidenceEngineProvider
  decision_tier: EvidenceEngineDecisionTier
  lifecycle_status: EvidenceEngineLifecycleStatus
  evidence_type: EvidenceEngineEvidenceType
  value_text: string | null
  value_json: Record<string, unknown> | null
  source_url: string | null
  page_title: string | null
  raw_excerpt: string | null
  confidence: EvidenceEngineConfidence
  extracted_at: string
  verified_at: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
}

export type AvaFact = {
  fact_id: string
  organization_id: string
  fact_key: string
  category: EvidenceEngineFactCategory
  value_text: string | null
  value_json: Record<string, unknown> | null
  lifecycle_status: EvidenceEngineLifecycleStatus
  confidence: EvidenceEngineConfidence
  supporting_evidence_ids: string[]
  contradicting_evidence_ids: string[]
  first_seen_at: string
  last_seen_at: string
  last_verified_at: string | null
  deprecated_at: string | null
  metadata: Record<string, unknown>
}

export type AvaContradiction = {
  contradiction_id: string
  organization_id: string
  fact_key: string
  conflicting_values: string[]
  evidence_ids: string[]
  severity: EvidenceEngineContradictionSeverity
  recommended_resolution: string
  requires_human_review: boolean
}

export type EvidenceCollectionResult = {
  organization_id: string
  provider: EvidenceEngineProvider
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: AvaContradiction[]
  warnings: string[]
  diagnostics: Record<string, unknown>
}

/** Raw provider output before normalization. */
export type EvidenceProviderRawItem = {
  fact_key: string
  category: EvidenceEngineFactCategory
  value_text: string
  value_json?: Record<string, unknown> | null
  provider: EvidenceEngineProvider
  decision_tier: EvidenceEngineDecisionTier
  evidence_type: EvidenceEngineEvidenceType
  source_url: string | null
  page_title: string | null
  raw_excerpt: string | null
  evidence_confidence?: number
  extraction_confidence?: number
  verification_confidence?: number
  freshness_confidence?: number
  extracted_at?: string
  metadata?: Record<string, unknown>
}

export type EvidenceProviderCollectionOutput = {
  organization_id: string
  provider: EvidenceEngineProvider
  raw_items: EvidenceProviderRawItem[]
  warnings: string[]
  diagnostics: Record<string, unknown>
}

export type EvidenceEngineRunInput = {
  organizationId: string
  trigger: EvidenceEngineTrigger
  websiteUrl?: string | null
  forceRefresh?: boolean
  providers?: EvidenceEngineProvider[]
  /** Default false — caller must explicitly opt in to persistence. */
  persist?: boolean
}

export type EvidenceEngineRunResult = {
  ok: true
  organization_id: string
  trigger: EvidenceEngineTrigger
  collections: EvidenceCollectionResult[]
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: AvaContradiction[]
  warnings: string[]
  diagnostics: Record<string, unknown>
  run_id?: string | null
  snapshot_id?: string | null
  input_hash?: string | null
  cached?: boolean
  persisted?: boolean
}

export function isEvidenceEngineProvider(value: string): value is EvidenceEngineProvider {
  return (EVIDENCE_ENGINE_PROVIDERS as readonly string[]).includes(value)
}

export function isEvidenceEngineDecisionTier(value: string): value is EvidenceEngineDecisionTier {
  return (EVIDENCE_ENGINE_DECISION_TIERS as readonly string[]).includes(value)
}

export function decisionTierRank(tier: EvidenceEngineDecisionTier): number {
  return EVIDENCE_ENGINE_DECISION_TIERS.indexOf(tier)
}

export function isLowerTrustDecisionTier(tier: EvidenceEngineDecisionTier): boolean {
  return decisionTierRank(tier) >= decisionTierRank("ai_reasoning")
}
