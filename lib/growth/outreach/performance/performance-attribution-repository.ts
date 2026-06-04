import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildOutreachPerformanceAttributionRecord } from "@/lib/growth/outreach/performance/outreach-attribution-builder"
import type { OutreachPerformanceAttributionRecord } from "@/lib/growth/outreach/performance/performance-types"

type Row = Record<string, unknown>

function attributionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outreach_performance_attributions")
}

function mapAttributionRow(row: Row): OutreachPerformanceAttributionRecord {
  return {
    attributionId: String(row.attribution_id),
    generationId: row.generation_id ? String(row.generation_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    generationType: String(row.generation_type),
    strategyVersion: String(row.strategy_version),
    variationKey: String(row.variation_key),
    recordedAt: String(row.recorded_at),
    subjectStrategyKey: String(row.subject_strategy_key),
    subjectCategory: String(row.subject_category),
    subjectEvidenceSource: String(row.subject_evidence_source),
    subjectQualityScore: row.subject_quality_score == null ? null : Number(row.subject_quality_score),
    subjectMemoryAware: row.subject_memory_aware === true,
    subjectResearchBacked: row.subject_research_backed === true,
    openerStrategyKey: String(row.opener_strategy_key) as OutreachPerformanceAttributionRecord["openerStrategyKey"],
    openerEvidenceSource: row.opener_evidence_source ? String(row.opener_evidence_source) : null,
    openerResearchConfidenceTier:
      row.opener_research_confidence_tier === "high" || row.opener_research_confidence_tier === "medium"
        ? row.opener_research_confidence_tier
        : null,
    openerMemoryBacked: row.opener_memory_backed === true,
    openerResearchBacked: row.opener_research_backed === true,
    openerGeneric: row.opener_generic === true,
    ctaStrategyKey: String(row.cta_strategy_key),
    ctaCategory: String(row.cta_category),
    ctaEvidenceSource: String(row.cta_evidence_source),
    ctaQualityScore: row.cta_quality_score == null ? null : Number(row.cta_quality_score),
    contextUtilizationPercentage:
      row.context_utilization_pct == null ? null : Number(row.context_utilization_pct),
    memoryUtilizationPercentage: row.memory_utilization_pct == null ? null : Number(row.memory_utilization_pct),
    researchConfidence: row.research_confidence == null ? null : Number(row.research_confidence),
    memoryCoverageScore: row.memory_coverage_score == null ? null : Number(row.memory_coverage_score),
    leadEngineGuidanceUsed: row.lead_engine_guidance_used === true,
    contextSourcesUsed: Array.isArray(row.context_sources_used)
      ? row.context_sources_used.map(String)
      : [],
    memorySignalsUsed: Array.isArray(row.memory_signals_used) ? row.memory_signals_used.map(String) : [],
  }
}

export async function persistOutreachPerformanceAttribution(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    audit: OutreachPersonalizationAudit
    recordedAt?: string
  },
): Promise<OutreachPerformanceAttributionRecord> {
  const record = buildOutreachPerformanceAttributionRecord({
    audit: input.audit,
    generationId: input.generationId,
    leadId: input.leadId,
    recordedAt: input.recordedAt,
  })

  const { error } = await attributionsTable(admin).upsert(
    {
      attribution_id: record.attributionId,
      generation_id: input.generationId,
      lead_id: input.leadId,
      generation_type: record.generationType,
      strategy_version: record.strategyVersion,
      variation_key: record.variationKey,
      recorded_at: record.recordedAt,
      subject_strategy_key: record.subjectStrategyKey,
      subject_category: record.subjectCategory,
      subject_evidence_source: record.subjectEvidenceSource,
      subject_quality_score: record.subjectQualityScore,
      subject_memory_aware: record.subjectMemoryAware,
      subject_research_backed: record.subjectResearchBacked,
      opener_strategy_key: record.openerStrategyKey,
      opener_evidence_source: record.openerEvidenceSource,
      opener_research_confidence_tier: record.openerResearchConfidenceTier,
      opener_memory_backed: record.openerMemoryBacked,
      opener_research_backed: record.openerResearchBacked,
      opener_generic: record.openerGeneric,
      cta_strategy_key: record.ctaStrategyKey,
      cta_category: record.ctaCategory,
      cta_evidence_source: record.ctaEvidenceSource,
      cta_quality_score: record.ctaQualityScore,
      context_utilization_pct: record.contextUtilizationPercentage,
      memory_utilization_pct: record.memoryUtilizationPercentage,
      research_confidence: record.researchConfidence,
      memory_coverage_score: record.memoryCoverageScore,
      lead_engine_guidance_used: record.leadEngineGuidanceUsed,
      context_sources_used: record.contextSourcesUsed,
      memory_signals_used: record.memorySignalsUsed,
      attribution_payload: {
        contextQuality: input.audit.contextQuality ?? null,
        memoryQuality: input.audit.memoryQuality ?? null,
        subjectIntelligence: input.audit.subjectIntelligence ?? null,
        ctaIntelligence: input.audit.ctaIntelligence ?? null,
        researchOpener: input.audit.researchOpener ?? null,
        memoryOpener: input.audit.memoryOpener ?? null,
      },
    },
    { onConflict: "attribution_id" },
  )
  if (error) throw new Error(error.message)

  return record
}

export async function listOutreachPerformanceAttributions(
  admin: SupabaseClient,
  input?: { limit?: number; since?: string },
): Promise<OutreachPerformanceAttributionRecord[]> {
  let query = attributionsTable(admin).select("*").order("recorded_at", { ascending: false })
  if (input?.since) query = query.gte("recorded_at", input.since)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAttributionRow(row as Row))
}

export async function isOutreachPerformanceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await attributionsTable(admin).select("attribution_id").limit(1)
  return !error
}
