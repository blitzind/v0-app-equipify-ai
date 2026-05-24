import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

export const GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE =
  "Opportunity pipeline tables are not available yet. Apply migration 20270226120000_growth_engine_opportunity_pipeline.sql, then run supabase db push (or refresh the Supabase schema cache in the dashboard) before using Pipeline."

export type GrowthOpportunityPipelineSchemaProbe = {
  pipelineSettings: boolean
  opportunities: boolean
}

let cachedProbe: { value: GrowthOpportunityPipelineSchemaProbe; checkedAt: number } | null = null
const CACHE_MS = 60_000

function isMissingSchemaError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return looksLikePostgrestMissingSchemaError(error.message, error.code)
}

export function isGrowthOpportunityPipelineSchemaReady(probe: GrowthOpportunityPipelineSchemaProbe): boolean {
  return probe.pipelineSettings && probe.opportunities
}

export async function probeGrowthOpportunityPipelineSchema(
  admin: SupabaseClient,
): Promise<GrowthOpportunityPipelineSchemaProbe> {
  if (cachedProbe && Date.now() - cachedProbe.checkedAt < CACHE_MS) {
    return cachedProbe.value
  }

  const probe: GrowthOpportunityPipelineSchemaProbe = {
    pipelineSettings: true,
    opportunities: true,
  }

  const settings = await admin.schema("growth").from("opportunity_pipeline_settings").select("id").limit(1)
  if (isMissingSchemaError(settings.error)) {
    probe.pipelineSettings = false
  }

  const opportunities = await admin.schema("growth").from("opportunities").select("id").limit(1)
  if (isMissingSchemaError(opportunities.error)) {
    probe.opportunities = false
  }

  cachedProbe = { value: probe, checkedAt: Date.now() }
  return probe
}

export function resetGrowthOpportunityPipelineSchemaProbeCacheForTests(): void {
  cachedProbe = null
}

export function invalidateGrowthOpportunityPipelineSchemaProbeCache(): void {
  cachedProbe = null
}

export function isGrowthOpportunityPipelineSchemaError(message: string): boolean {
  return looksLikePostgrestMissingSchemaError(message)
}
