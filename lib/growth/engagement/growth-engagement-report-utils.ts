import { z } from "zod"
import {
  GROWTH_ENGAGEMENT_REPORT_TYPES,
  type GrowthEngagementReport,
  type GrowthEngagementReportCatalogEntry,
  type GrowthEngagementReportColumn,
  type GrowthEngagementReportCsvExport,
  type GrowthEngagementReportFilters,
  type GrowthEngagementReportRow,
  type GrowthEngagementReportType,
} from "@/lib/growth/engagement/growth-engagement-report-types"
import { GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { parseEngagementDashboardFilters } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"

export const GROWTH_ENGAGEMENT_REPORT_DEFAULT_LIMIT = 100 as const
export const GROWTH_ENGAGEMENT_REPORT_MAX_LIMIT = 500 as const

const REPORT_TYPE_SCHEMA = z.enum(GROWTH_ENGAGEMENT_REPORT_TYPES)

export const GROWTH_ENGAGEMENT_REPORT_CATALOG: GrowthEngagementReportCatalogEntry[] = [
  {
    reportType: "overview",
    title: "Engagement overview",
    description: "Share page, media, and booking rollup metrics for the selected date range.",
  },
  {
    reportType: "template_performance",
    title: "Template performance",
    description: "Share page template usage, views, CTA clicks, and booking outcomes.",
  },
  {
    reportType: "media_performance",
    title: "Media performance",
    description: "Video asset views, plays, completions, and CTA engagement.",
  },
  {
    reportType: "lead_engagement",
    title: "Lead engagement",
    description: "Per-lead engagement counts derived from normalized timeline events.",
  },
  {
    reportType: "cta_performance",
    title: "CTA performance",
    description: "Share page and media CTA click totals with top CTA keys.",
  },
  {
    reportType: "booking_readiness",
    title: "Booking handoff readiness",
    description: "Booking handoff foundation readiness counts and share page booking funnel.",
  },
  {
    reportType: "high_intent",
    title: "High-intent signals",
    description: "High-intent engagement signals from share page analytics and signal store.",
  },
]

export function parseEngagementReportType(value: string): GrowthEngagementReportType | null {
  const parsed = REPORT_TYPE_SCHEMA.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function clampEngagementReportLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return GROWTH_ENGAGEMENT_REPORT_DEFAULT_LIMIT
  return Math.min(Math.max(Math.floor(value ?? GROWTH_ENGAGEMENT_REPORT_DEFAULT_LIMIT), 1), GROWTH_ENGAGEMENT_REPORT_MAX_LIMIT)
}

export function parseEngagementReportFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): GrowthEngagementReportFilters {
  const dashboardFilters = parseEngagementDashboardFilters(organizationId, searchParams)
  const limitRaw = searchParams.get("limit")
  return {
    ...dashboardFilters,
    limit: limitRaw ? clampEngagementReportLimit(Number(limitRaw)) : GROWTH_ENGAGEMENT_REPORT_DEFAULT_LIMIT,
  }
}

export function buildEngagementReportId(reportType: GrowthEngagementReportType, generatedAt: string): string {
  return `${reportType}:${generatedAt}`
}

export function limitEngagementReportRows<T>(rows: T[], limit?: number): T[] {
  return rows.slice(0, clampEngagementReportLimit(limit))
}

export function csvEscapeValue(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function buildEngagementReportCsvExport(report: GrowthEngagementReport): GrowthEngagementReportCsvExport {
  const headers = report.columns.map((column) => column.label)
  const rows = report.rows.map((row) =>
    report.columns.map((column) => csvEscapeValue(row[column.key] as string | number | null | undefined)),
  )

  return {
    headers,
    rows,
    filename: `${report.reportType}-${report.dateRange.preset}-${report.generatedAt.slice(0, 10)}.csv`,
    mimeType: "text/csv",
  }
}

export function renderEngagementReportCsvText(exportModel: GrowthEngagementReportCsvExport): string {
  const lines = [exportModel.headers.map(csvEscapeValue).join(",")]
  for (const row of exportModel.rows) {
    lines.push(row.join(","))
  }
  return `${lines.join("\n")}\n`
}

export function rowsFromColumns(
  columns: GrowthEngagementReportColumn[],
  values: Array<Record<string, string | number | null>>,
): GrowthEngagementReportRow[] {
  return values.map((value) => {
    const row: GrowthEngagementReportRow = {}
    for (const column of columns) {
      row[column.key] = value[column.key] ?? null
    }
    return row
  })
}

export function defaultReportDateRangeLabel(filters: GrowthEngagementReportFilters): string {
  return filters.dateRange ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE
}
