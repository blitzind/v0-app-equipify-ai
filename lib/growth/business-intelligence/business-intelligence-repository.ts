/** GE-AIOS-8A-3 — Business Intelligence report persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  BusinessIntelligenceConfidenceSummary,
  BusinessIntelligenceGap,
  BusinessIntelligenceReport,
  BusinessIntelligenceReportRecord,
  BusinessIntelligenceReportStatus,
} from "@/lib/growth/business-intelligence/business-intelligence-types"

const REPORTS_TABLE = "business_intelligence_reports"

function reportsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(REPORTS_TABLE)
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "42P01" || /business_intelligence_reports/i.test(error.message ?? "")
}

export async function isBusinessIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await reportsTable(admin).select("id").limit(1)
  return !error
}

function mapReportRow(row: Record<string, unknown>): BusinessIntelligenceReportRecord {
  const reportJson =
    row.report_json && typeof row.report_json === "object"
      ? (row.report_json as BusinessIntelligenceReport)
      : ({} as BusinessIntelligenceReport)

  return {
    report_id: row.id as string,
    organization_id: row.organization_id as string,
    evidence_snapshot_id: row.evidence_snapshot_id as string,
    evidence_run_id: row.evidence_run_id as string,
    status: row.status as BusinessIntelligenceReportStatus,
    generated_at: typeof row.generated_at === "string" ? row.generated_at : reportJson.generated_at,
    is_current: Boolean(row.is_current),
    report: reportJson,
  }
}

export async function persistBusinessIntelligenceReport(
  admin: SupabaseClient,
  input: {
    organization_id: string
    evidence_snapshot_id: string
    evidence_run_id: string
    status: BusinessIntelligenceReportStatus
    report: BusinessIntelligenceReport
    confidence_summary: BusinessIntelligenceConfidenceSummary
    gaps: BusinessIntelligenceGap[]
    source_providers: string[]
    generated_at?: string
    metadata?: Record<string, unknown>
  },
): Promise<string | null> {
  const schemaReady = await isBusinessIntelligenceSchemaReady(admin)
  if (!schemaReady) return null

  const generatedAt = input.generated_at ?? input.report.generated_at

  const { error: clearError } = await reportsTable(admin)
    .update({ is_current: false })
    .eq("organization_id", input.organization_id)
    .eq("is_current", true)
  if (clearError && !isMissingTableError(clearError)) {
    throw new Error(`persistBusinessIntelligenceReport(clear current): ${clearError.message}`)
  }

  const { data, error } = await reportsTable(admin)
    .insert({
      organization_id: input.organization_id,
      evidence_snapshot_id: input.evidence_snapshot_id,
      evidence_run_id: input.evidence_run_id,
      status: input.status,
      report_json: input.report,
      confidence_summary: input.confidence_summary,
      gaps_json: input.gaps,
      source_providers: input.source_providers,
      generated_at: generatedAt,
      is_current: true,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()

  if (error) throw new Error(`persistBusinessIntelligenceReport: ${error.message}`)
  return data.id as string
}

export async function fetchLatestBusinessIntelligenceReport(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BusinessIntelligenceReportRecord | null> {
  const { data, error } = await reportsTable(admin)
    .select(
      "id, organization_id, evidence_snapshot_id, evidence_run_id, status, report_json, generated_at, is_current",
    )
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(`fetchLatestBusinessIntelligenceReport: ${error.message}`)
  }
  if (!data) return null
  return mapReportRow(data as Record<string, unknown>)
}

export async function fetchBusinessIntelligenceReportBySnapshot(
  admin: SupabaseClient,
  input: {
    organization_id: string
    evidence_snapshot_id: string
  },
): Promise<BusinessIntelligenceReportRecord | null> {
  const { data, error } = await reportsTable(admin)
    .select(
      "id, organization_id, evidence_snapshot_id, evidence_run_id, status, report_json, generated_at, is_current",
    )
    .eq("organization_id", input.organization_id)
    .eq("evidence_snapshot_id", input.evidence_snapshot_id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(`fetchBusinessIntelligenceReportBySnapshot: ${error.message}`)
  }
  if (!data) return null
  return mapReportRow(data as Record<string, unknown>)
}
