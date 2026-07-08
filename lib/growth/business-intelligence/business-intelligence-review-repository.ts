/** GE-AIOS-8A-7 — Business Intelligence review decision persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  BusinessIntelligenceReviewDecisionRecord,
  BusinessIntelligenceReviewDecisionType,
  BusinessIntelligenceReviewFieldKey,
  BusinessIntelligenceReviewFieldValue,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"

const REVIEW_TABLE = "business_intelligence_review_decisions"

function reviewTable(admin: SupabaseClient) {
  return admin.schema("growth").from(REVIEW_TABLE)
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "42P01" || /business_intelligence_review_decisions/i.test(error.message ?? "")
}

export async function isBusinessIntelligenceReviewSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await reviewTable(admin).select("id").limit(1)
  return !error
}

function mapReviewRow(row: Record<string, unknown>): BusinessIntelligenceReviewDecisionRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    business_intelligence_report_id: row.business_intelligence_report_id as string,
    evidence_snapshot_id: row.evidence_snapshot_id as string,
    field_key: row.field_key as BusinessIntelligenceReviewFieldKey,
    original_value_json: (row.original_value_json ?? null) as BusinessIntelligenceReviewFieldValue,
    approved_value_json: (row.approved_value_json ?? null) as BusinessIntelligenceReviewFieldValue,
    decision: row.decision as BusinessIntelligenceReviewDecisionType,
    confidence_at_decision:
      typeof row.confidence_at_decision === "number" ? row.confidence_at_decision : null,
    supporting_evidence_ids: Array.isArray(row.supporting_evidence_ids)
      ? (row.supporting_evidence_ids as string[])
      : [],
    decided_by: typeof row.decided_by === "string" ? row.decided_by : null,
    decided_at: typeof row.decided_at === "string" ? row.decided_at : new Date().toISOString(),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export async function fetchBusinessIntelligenceReviewDecisions(
  admin: SupabaseClient,
  input: {
    organization_id: string
    business_intelligence_report_id: string
  },
): Promise<BusinessIntelligenceReviewDecisionRecord[]> {
  const { data, error } = await reviewTable(admin)
    .select("*")
    .eq("organization_id", input.organization_id)
    .eq("business_intelligence_report_id", input.business_intelligence_report_id)
    .order("decided_at", { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(`fetchBusinessIntelligenceReviewDecisions: ${error.message}`)
  }

  return (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>))
}

export async function upsertBusinessIntelligenceReviewDecision(
  admin: SupabaseClient,
  input: {
    organization_id: string
    business_intelligence_report_id: string
    evidence_snapshot_id: string
    field_key: BusinessIntelligenceReviewFieldKey
    original_value_json: BusinessIntelligenceReviewFieldValue
    approved_value_json: BusinessIntelligenceReviewFieldValue
    decision: BusinessIntelligenceReviewDecisionType
    confidence_at_decision: number | null
    supporting_evidence_ids: string[]
    decided_by: string | null
    metadata?: Record<string, unknown>
  },
): Promise<BusinessIntelligenceReviewDecisionRecord> {
  const now = new Date().toISOString()

  const { data, error } = await reviewTable(admin)
    .upsert(
      {
        organization_id: input.organization_id,
        business_intelligence_report_id: input.business_intelligence_report_id,
        evidence_snapshot_id: input.evidence_snapshot_id,
        field_key: input.field_key,
        original_value_json: input.original_value_json,
        approved_value_json: input.approved_value_json,
        decision: input.decision,
        confidence_at_decision: input.confidence_at_decision,
        supporting_evidence_ids: input.supporting_evidence_ids,
        decided_by: input.decided_by,
        decided_at: now,
        metadata: input.metadata ?? {},
      },
      { onConflict: "organization_id,business_intelligence_report_id,field_key" },
    )
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Business Intelligence review schema is not ready.")
    }
    throw new Error(`upsertBusinessIntelligenceReviewDecision: ${error.message}`)
  }

  return mapReviewRow(data as Record<string, unknown>)
}
