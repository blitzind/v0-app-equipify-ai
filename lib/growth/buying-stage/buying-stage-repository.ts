import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCompanyIdentificationResult } from "@/lib/growth/company-identification/company-identification-types"
import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import type { GrowthIntentLeadCandidateIdentity } from "@/lib/growth/lead-engine/intent/intent-candidate-types"
import { assessBuyingStage } from "@/lib/growth/buying-stage/buying-stage-engine"
import { computeBuyingStageScoreContribution } from "@/lib/growth/buying-stage/buying-stage-score"
import { isGrowthBuyingStageSchemaReady } from "@/lib/growth/buying-stage/buying-stage-schema-health"
import {
  GROWTH_BUYING_STAGE_QA_MARKER,
  type GrowthBuyingStageAssessmentCandidate,
  type GrowthBuyingStageAssessmentRow,
  type GrowthBuyingStageInput,
  type GrowthBuyingStageResult,
  type GrowthBuyingStageSignal,
} from "@/lib/growth/buying-stage/buying-stage-types"
import type { GrowthSearchIntentCaptureResult } from "@/lib/growth/search-intent/search-intent-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseAttribution(value: unknown): GrowthBuyingStageAssessmentRow["source_attribution"] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = typeof row.confidence === "number" ? row.confidence : 0
      if (!source || !evidence) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthBuyingStageAssessmentRow["source_attribution"][number] => row !== null)
}

function parseSignalSummary(value: unknown): GrowthBuyingStageSignal[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const signal_type = asString(row.signal_type)
      const label = asString(row.label)
      const evidence = asString(row.evidence)
      if (!signal_type || !evidence) return null
      return {
        signal_type: signal_type as GrowthBuyingStageSignal["signal_type"],
        label: label || signal_type,
        evidence,
        source_attribution: parseAttribution(row.source_attribution),
        weight: typeof row.weight === "number" ? row.weight : 0,
        stage_hints:
          row.stage_hints && typeof row.stage_hints === "object"
            ? (row.stage_hints as GrowthBuyingStageSignal["stage_hints"])
            : {},
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
      }
    })
    .filter((s): s is GrowthBuyingStageSignal => s !== null)
}

function mapRow(row: Record<string, unknown>): GrowthBuyingStageAssessmentRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    lead_inbox_id: asString(row.lead_inbox_id) || null,
    intent_session_id: asString(row.intent_session_id) || null,
    company_identification_id: asString(row.company_identification_id) || null,
    detected_stage: asString(row.detected_stage) as GrowthBuyingStageAssessmentRow["detected_stage"],
    stage_confidence: typeof row.stage_confidence === "number" ? row.stage_confidence : 0,
    stage_score: typeof row.stage_score === "number" ? row.stage_score : 0,
    stage_reasoning: Array.isArray(row.stage_reasoning)
      ? row.stage_reasoning.filter((v): v is string => typeof v === "string")
      : [],
    evidence: asString(row.evidence),
    source_attribution: parseAttribution(row.source_attribution),
    signal_summary: parseSignalSummary(row.signal_summary),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export function buildBuyingStageInputFromAggregate(
  aggregated: GrowthIntentAggregatedSession,
  options: {
    intent_score: number
    searchCapture?: GrowthSearchIntentCaptureResult | null
    companyIdentification?: GrowthCompanyIdentificationResult | null
    existing_customer_ids?: string[]
    existing_lead_ids?: string[]
    lead_inbox_id?: string | null
    company_identification_id?: string | null
    operator_activity_count?: number
  },
): GrowthBuyingStageInput {
  const session = aggregated.primary_session
  const search = options.searchCapture

  return {
    site_key: aggregated.site_key,
    visitor_key: session.visitor_key,
    session_key: session.session_key,
    intent_session_id: session.id,
    lead_inbox_id: options.lead_inbox_id ?? null,
    company_identification_id: options.company_identification_id ?? null,
    intent_score: options.intent_score,
    session_count: aggregated.visit_history.session_count,
    visit_count: aggregated.all_pageviews.length,
    unique_page_count: aggregated.unique_page_count,
    total_time_on_site_ms: aggregated.total_time_on_site_ms,
    high_intent_path_hits: aggregated.high_intent_path_hits,
    conversion_types: aggregated.all_conversions.map((c) => c.conversion_type),
    has_identified_contact: aggregated.identified_contacts.length > 0,
    existing_customer_ids: options.existing_customer_ids ?? [],
    existing_lead_ids: options.existing_lead_ids ?? [],
    search_intent_top_category: search?.contribution.top_category ?? null,
    search_intent_signal_count: search?.contribution.signal_count ?? 0,
    search_intent_max_confidence: search?.contribution.max_confidence ?? 0,
    company_match_confidence: options.companyIdentification?.summary?.match_confidence ?? 0,
    company_matched_source: options.companyIdentification?.summary?.matched_source ?? null,
    operator_activity_count: options.operator_activity_count ?? 0,
  }
}

export function assessBuyingStageCandidates(
  input: GrowthBuyingStageInput,
): GrowthBuyingStageResult {
  return assessBuyingStage(input)
}

export function assessBuyingStageFromAggregatedSession(
  aggregated: GrowthIntentAggregatedSession,
  options: {
    intent_score: number
    searchCapture?: GrowthSearchIntentCaptureResult | null
    companyIdentification?: GrowthCompanyIdentificationResult | null
    existing_customer_ids?: string[]
    existing_lead_ids?: string[]
    lead_inbox_id?: string | null
    company_identification_id?: string | null
    operator_activity_count?: number
  },
): GrowthBuyingStageResult & {
  contribution: ReturnType<typeof computeBuyingStageScoreContribution>
} {
  const input = buildBuyingStageInputFromAggregate(aggregated, options)
  const result = assessBuyingStageCandidates(input)
  const contribution = computeBuyingStageScoreContribution(result.assessment)
  return { ...result, contribution }
}

export async function persistBuyingStageAssessment(
  admin: SupabaseClient,
  assessment: GrowthBuyingStageAssessmentCandidate,
  context: {
    lead_inbox_id?: string | null
    intent_session_id?: string | null
    company_identification_id?: string | null
  },
): Promise<{ ok: boolean; row: GrowthBuyingStageAssessmentRow | null; reason: string | null }> {
  if (!(await isGrowthBuyingStageSchemaReady(admin))) {
    return { ok: false, row: null, reason: "schema_not_ready" }
  }

  const payload = {
    lead_inbox_id: context.lead_inbox_id ?? null,
    intent_session_id: context.intent_session_id ?? null,
    company_identification_id: context.company_identification_id ?? null,
    detected_stage: assessment.detected_stage,
    stage_confidence: assessment.stage_confidence,
    stage_score: assessment.stage_score,
    stage_reasoning: assessment.stage_reasoning,
    evidence: assessment.evidence,
    source_attribution: assessment.source_attribution,
    signal_summary: assessment.signal_summary,
    metadata: {
      ...assessment.metadata,
      qa_marker: GROWTH_BUYING_STAGE_QA_MARKER,
      is_candidate_assessment: true,
      disclaimer: "Candidate buying stage assessment — not guaranteed truth. No autonomous actions.",
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .schema("growth")
    .from("buying_stage_assessments")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    return { ok: false, row: null, reason: error.message }
  }

  return { ok: true, row: mapRow(data as Record<string, unknown>), reason: null }
}

export async function loadBuyingStageAssessmentsForLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  limit = 5,
): Promise<GrowthBuyingStageAssessmentRow[]> {
  if (!(await isGrowthBuyingStageSchemaReady(admin))) return []

  const { data, error } = await admin
    .schema("growth")
    .from("buying_stage_assessments")
    .select("*")
    .eq("lead_inbox_id", leadInboxId)
    .order("stage_score", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => mapRow(row as Record<string, unknown>))
}

export async function linkBuyingStageAssessmentToLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  assessmentId: string,
): Promise<{ ok: boolean; reason: string | null }> {
  if (!(await isGrowthBuyingStageSchemaReady(admin))) {
    return { ok: false, reason: "schema_not_ready" }
  }

  const { error } = await admin
    .schema("growth")
    .from("buying_stage_assessments")
    .update({ lead_inbox_id: leadInboxId, updated_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .is("lead_inbox_id", null)

  return { ok: !error, reason: error?.message ?? null }
}
