/** Apollo pipeline growth_lead_id resolution evidence — client-safe. */

export const APOLLO_PIPELINE_GROWTH_LEAD_RESOLUTION_QA_MARKER =
  "apollo-pipeline-growth-lead-resolution-v1" as const

export const APOLLO_PIPELINE_GROWTH_LEAD_SOURCES = [
  "enrollment_candidate",
  "account_playbook",
  "voice_drop_candidate",
  "multichannel_candidate",
  "multichannel_metadata",
  "source_attribution",
  "company_contact",
  "created_for_sequence_execution",
] as const

export type ApolloPipelineGrowthLeadSource =
  (typeof APOLLO_PIPELINE_GROWTH_LEAD_SOURCES)[number]

export type ApolloPipelineGrowthLeadChainInput = {
  enrollment_growth_lead_id?: string | null
  account_playbook_growth_lead_id?: string | null
  voice_drop_growth_lead_id?: string | null
  multichannel_growth_lead_id?: string | null
  multichannel_metadata?: Record<string, unknown> | null
  source_attribution?: Record<string, unknown> | null
  company_contact_growth_lead_id?: string | null
}

export type ApolloPipelineGrowthLeadResolutionEvidence = {
  growth_lead_resolution_attempted: boolean
  growth_lead_resolution_source: ApolloPipelineGrowthLeadSource | null
  growth_lead_id: string | null
  growth_lead_id_before: string | null
  growth_lead_id_after: string | null
  growth_lead_backfilled_rows: string[]
  growth_lead_resolution_blockers: string[]
}

function asGrowthLeadId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function growthLeadIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  return asGrowthLeadId(metadata.growth_lead_id)
}

function growthLeadIdFromAttribution(
  attribution: Record<string, unknown> | null | undefined,
): string | null {
  if (!attribution) return null
  return asGrowthLeadId(attribution.growth_lead_id)
}

export function resolveApolloPipelineGrowthLeadIdFromChain(
  input: ApolloPipelineGrowthLeadChainInput,
): { growth_lead_id: string | null; source: ApolloPipelineGrowthLeadSource | null } {
  const checks: Array<[ApolloPipelineGrowthLeadSource, string | null]> = [
    ["enrollment_candidate", asGrowthLeadId(input.enrollment_growth_lead_id)],
    ["account_playbook", asGrowthLeadId(input.account_playbook_growth_lead_id)],
    ["voice_drop_candidate", asGrowthLeadId(input.voice_drop_growth_lead_id)],
    ["multichannel_candidate", asGrowthLeadId(input.multichannel_growth_lead_id)],
    ["multichannel_metadata", growthLeadIdFromMetadata(input.multichannel_metadata)],
    ["source_attribution", growthLeadIdFromAttribution(input.source_attribution)],
    ["company_contact", asGrowthLeadId(input.company_contact_growth_lead_id)],
  ]

  for (const [source, growthLeadId] of checks) {
    if (growthLeadId) return { growth_lead_id: growthLeadId, source }
  }

  return { growth_lead_id: null, source: null }
}

export function buildApolloPipelineGrowthLeadResolutionEvidence(input: {
  attempted: boolean
  source: ApolloPipelineGrowthLeadSource | null
  growth_lead_id_before: string | null
  growth_lead_id_after: string | null
  backfilled_rows: string[]
  blockers: string[]
}): ApolloPipelineGrowthLeadResolutionEvidence {
  return {
    growth_lead_resolution_attempted: input.attempted,
    growth_lead_resolution_source: input.source,
    growth_lead_id: input.growth_lead_id_after,
    growth_lead_id_before: input.growth_lead_id_before,
    growth_lead_id_after: input.growth_lead_id_after,
    growth_lead_backfilled_rows: input.backfilled_rows,
    growth_lead_resolution_blockers: input.blockers,
  }
}
