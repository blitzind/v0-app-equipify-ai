import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngagementReport, listGrowthEngagementReports } from "@/lib/growth/engagement/growth-engagement-report-service"
import {
  buildEngagementReportCsvExport,
  clampEngagementReportLimit,
  parseEngagementReportType,
  renderEngagementReportCsvText,
  rowsFromColumns,
} from "@/lib/growth/engagement/growth-engagement-report-utils"
import {
  GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
  GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  GROWTH_ENGAGEMENT_REPORT_TYPES,
} from "@/lib/growth/engagement/growth-engagement-report-types"

export type GrowthEngagementReportDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_REPORT_QA_MARKER
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail?: string }>
}

export async function runGrowthEngagementReportDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthEngagementReportDiagnosticsResult> {
  const checks: GrowthEngagementReportDiagnosticsResult["checks"] = []

  checks.push({ name: "report_types", ok: GROWTH_ENGAGEMENT_REPORT_TYPES.length === 7 })
  checks.push({ name: "report_type_validation", ok: parseEngagementReportType("overview") === "overview" })
  checks.push({ name: "invalid_report_type", ok: parseEngagementReportType("invalid") === null })
  checks.push({ name: "limit_clamp", ok: clampEngagementReportLimit(999) === 500 && clampEngagementReportLimit(0) === 1 })

  const sampleReport = {
    reportId: "overview:test",
    reportType: "overview" as const,
    title: "Engagement overview",
    description: "Test",
    dateRange: { preset: "last_30_days" as const, startIso: "2026-05-01T00:00:00.000Z", endIso: "2026-06-01T00:00:00.000Z" },
    filters: { organizationId, dateRange: "last_30_days" as const },
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ],
    rows: rowsFromColumns(
      [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      [{ metric: "CTA clicks", value: 3 }],
    ),
    totals: { total_cta_clicks: 3 },
    sourceAvailability: {},
    generatedAt: "2026-06-01T00:00:00.000Z",
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }

  const csv = buildEngagementReportCsvExport(sampleReport)
  const csvText = renderEngagementReportCsvText(csv)
  checks.push({ name: "csv_headers", ok: csv.headers.length === 2 })
  checks.push({ name: "csv_rows", ok: csv.rows.length === 1 })
  checks.push({ name: "csv_text", ok: csvText.includes("Metric,Value") })
  checks.push({ name: "csv_mime", ok: csv.mimeType === "text/csv" })
  checks.push({
    name: "safety_flags",
    ok:
      GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.read_only === true &&
      GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_file_writes === true &&
      GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_db_mutations === true,
  })

  const catalog = listGrowthEngagementReports()
  checks.push({ name: "catalog", ok: catalog.reports.length === 7 })

  const report = await getGrowthEngagementReport(admin, "overview", {
    organizationId,
    dateRange: "last_30_days",
    limit: 25,
  })
  checks.push({ name: "overview_report_service", ok: report.report.reportType === "overview" })

  return {
    qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
    ok: checks.every((check) => check.ok),
    checks,
  }
}
