/** Lead Engine — provider adapter types (Prompt 14). Client-safe. */

import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

export const GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER =
  "lead-engine-provider-adapter-v1" as const

export const GROWTH_LEAD_ENGINE_PROVIDER_STATUSES = [
  "success",
  "partial",
  "failed",
  "skipped",
] as const

export type GrowthLeadEngineProviderStatus =
  (typeof GROWTH_LEAD_ENGINE_PROVIDER_STATUSES)[number]

export const GROWTH_LEAD_ENGINE_PROVIDER_TYPES = [
  "company_research",
  "company_identification",
  "decision_maker_research",
  "contact_research",
  "verification",
  "website_research",
  "intent_signal",
] as const

export type GrowthLeadEngineProviderType =
  (typeof GROWTH_LEAD_ENGINE_PROVIDER_TYPES)[number]

export const GROWTH_LEAD_ENGINE_PROVIDER_MODES = [
  "fixture",
  "internal",
  "future_external",
] as const

export type GrowthLeadEngineProviderMode =
  (typeof GROWTH_LEAD_ENGINE_PROVIDER_MODES)[number]

export type GrowthLeadEngineProviderSourceAttribution = {
  source: string
  field?: string
  section?: string
  signal?: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineProviderEvidence = {
  claim: string
  evidence: string
  source: string
}

export type GrowthLeadEngineProviderResponse = {
  provider_name: string
  provider_type: GrowthLeadEngineProviderType
  request_id: string
  query: Record<string, unknown>
  status: GrowthLeadEngineProviderStatus
  confidence: number
  evidence: GrowthLeadEngineProviderEvidence[]
  source_attribution: GrowthLeadEngineProviderSourceAttribution[]
  raw_payload: unknown
  normalized_payload: unknown
  warnings: string[]
  errors: string[]
}

export type GrowthLeadEngineProviderQuery = {
  company_name?: string
  domain?: string
  industry?: string
  location?: string
  lead_id?: string
  website_url?: string
  stage_id?: GrowthLeadEnginePipelineStageId
}

export type GrowthLeadEngineProviderContext = {
  input: GrowthLeadEngineSandboxInput
  stage_id: GrowthLeadEnginePipelineStageId
  query: GrowthLeadEngineProviderQuery
  upstream?: Record<string, unknown>
}

export interface GrowthLeadEngineCompanyResearchProvider {
  readonly provider_type: "company_research"
  research(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineDecisionMakerResearchProvider {
  readonly provider_type: "decision_maker_research"
  research(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineContactResearchProvider {
  readonly provider_type: "contact_research"
  research(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineVerificationProvider {
  readonly provider_type: "verification"
  verify(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineWebsiteResearchProvider {
  readonly provider_type: "website_research"
  research(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineIntentSignalProvider {
  readonly provider_type: "intent_signal"
  collect(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export interface GrowthLeadEngineCompanyIdentificationProvider {
  readonly provider_type: "company_identification"
  identify(context: GrowthLeadEngineProviderContext): Promise<GrowthLeadEngineProviderResponse>
}

export type GrowthLeadEngineProviderBundle = {
  mode: GrowthLeadEngineProviderMode
  company_research: GrowthLeadEngineCompanyResearchProvider
  company_identification: GrowthLeadEngineCompanyIdentificationProvider
  decision_maker_research: GrowthLeadEngineDecisionMakerResearchProvider
  contact_research: GrowthLeadEngineContactResearchProvider
  verification: GrowthLeadEngineVerificationProvider
  website_research: GrowthLeadEngineWebsiteResearchProvider
  intent_signal: GrowthLeadEngineIntentSignalProvider
}

export function buildProviderQuery(
  input: GrowthLeadEngineSandboxInput,
  stageId: GrowthLeadEnginePipelineStageId,
): GrowthLeadEngineProviderQuery {
  const domain = input.domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
  return {
    company_name: input.companyName.trim(),
    domain: domain || undefined,
    industry: input.industry.trim() || undefined,
    location: input.location.trim() || undefined,
    website_url: domain ? `https://${domain}` : undefined,
    stage_id: stageId,
  }
}

export function createProviderResponse(params: {
  provider_name: string
  provider_type: GrowthLeadEngineProviderType
  request_id: string
  query: Record<string, unknown>
  status: GrowthLeadEngineProviderStatus
  confidence?: number
  evidence?: GrowthLeadEngineProviderEvidence[]
  source_attribution: GrowthLeadEngineProviderSourceAttribution[]
  raw_payload: unknown
  normalized_payload: unknown
  warnings?: string[]
  errors?: string[]
}): GrowthLeadEngineProviderResponse {
  const attribution = params.source_attribution.filter(
    (entry) => entry.source.trim() && entry.evidence.trim(),
  )

  return {
    provider_name: params.provider_name,
    provider_type: params.provider_type,
    request_id: params.request_id,
    query: params.query,
    status: params.status,
    confidence: Math.max(0, Math.min(1, params.confidence ?? 0)),
    evidence: params.evidence ?? [],
    source_attribution: attribution,
    raw_payload: params.raw_payload,
    normalized_payload: params.normalized_payload,
    warnings: params.warnings ?? [],
    errors: params.errors ?? [],
  }
}

/** Safe for workspace UI — omits raw_payload. */
export function toPublicProviderResponse(
  response: GrowthLeadEngineProviderResponse,
): Omit<GrowthLeadEngineProviderResponse, "raw_payload"> & { raw_payload_retained: true } {
  const { raw_payload: _raw, ...rest } = response
  return { ...rest, raw_payload_retained: true }
}
