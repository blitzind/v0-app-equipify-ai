/** Growth Engine S4-C — engagement report + CSV export read-model types. */

import type {
  GrowthEngagementDashboardFilters,
  GrowthEngagementDashboardResolvedDateRange,
  GrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export const GROWTH_ENGAGEMENT_REPORT_QA_MARKER = "growth-engagement-report-s4c-v1" as const

export const GROWTH_ENGAGEMENT_REPORT_TYPES = [
  "overview",
  "template_performance",
  "media_performance",
  "lead_engagement",
  "cta_performance",
  "booking_readiness",
  "high_intent",
] as const

export type GrowthEngagementReportType = (typeof GROWTH_ENGAGEMENT_REPORT_TYPES)[number]

export type GrowthEngagementReportSafetyFlags = {
  read_only: true
  no_db_mutations: true
  no_file_writes: true
  no_notifications: true
  no_sequence_execution: true
  no_provider_execution: true
}

export const GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS: GrowthEngagementReportSafetyFlags = {
  read_only: true,
  no_db_mutations: true,
  no_file_writes: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
}

export type GrowthEngagementReportColumn = {
  key: string
  label: string
}

export type GrowthEngagementReportRow = Record<string, string | number | null>

export type GrowthEngagementReportFilters = GrowthEngagementDashboardFilters & {
  limit?: number
}

export type GrowthEngagementReportSourceAvailability = Partial<GrowthEngagementDashboardSourceAvailability>

export type GrowthEngagementReport = {
  reportId: string
  reportType: GrowthEngagementReportType
  title: string
  description: string
  dateRange: GrowthEngagementDashboardResolvedDateRange
  filters: GrowthEngagementReportFilters
  columns: GrowthEngagementReportColumn[]
  rows: GrowthEngagementReportRow[]
  totals: Record<string, string | number | null>
  sourceAvailability: GrowthEngagementReportSourceAvailability
  generatedAt: string
  safety: GrowthEngagementReportSafetyFlags
}

export type GrowthEngagementReportCatalogEntry = {
  reportType: GrowthEngagementReportType
  title: string
  description: string
}

export type GrowthEngagementReportsListResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_REPORT_QA_MARKER
  reports: GrowthEngagementReportCatalogEntry[]
  safety: GrowthEngagementReportSafetyFlags
}

export type GrowthEngagementReportResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_REPORT_QA_MARKER
  report: GrowthEngagementReport
  safety: GrowthEngagementReportSafetyFlags
}

export type GrowthEngagementReportCsvExport = {
  headers: string[]
  rows: string[][]
  filename: string
  mimeType: "text/csv"
}

export type GrowthEngagementReportCsvResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_REPORT_QA_MARKER
  csv: GrowthEngagementReportCsvExport
  csvText: string
  safety: GrowthEngagementReportSafetyFlags
}
