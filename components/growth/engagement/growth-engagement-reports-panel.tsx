"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementExportButton } from "@/components/growth/engagement/growth-engagement-export-button"
import { GrowthEngagementReportCard } from "@/components/growth/engagement/growth-engagement-report-card"
import { GrowthEngagementReportTable } from "@/components/growth/engagement/growth-engagement-report-table"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import {
  type GrowthEngagementReport,
  type GrowthEngagementReportCatalogEntry,
  type GrowthEngagementReportType,
} from "@/lib/growth/engagement/growth-engagement-report-types"

type ReportsListResponse = {
  ok?: boolean
  reports?: GrowthEngagementReportCatalogEntry[]
  message?: string
}

type ReportResponse = {
  ok?: boolean
  report?: GrowthEngagementReport
  message?: string
}

export function GrowthEngagementReportsPanel({
  dateRange,
  leadId,
  templateId,
  query,
}: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  leadId: string
  templateId: string
  query: string
}) {
  const [catalog, setCatalog] = useState<GrowthEngagementReportCatalogEntry[]>([])
  const [selectedType, setSelectedType] = useState<GrowthEngagementReportType>("overview")
  const [report, setReport] = useState<GrowthEngagementReport | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reportQuery = useMemo(() => {
    const params = new URLSearchParams(query)
    params.set("limit", "100")
    return params.toString()
  }, [query])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/engagement-dashboard/reports", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as ReportsListResponse
      if (!res.ok || !data.ok || !data.reports) {
        throw new Error(data.message ?? "Could not load engagement reports.")
      }
      setCatalog(data.reports)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement reports.")
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  const loadReport = useCallback(async () => {
    setLoadingReport(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement-dashboard/reports/${encodeURIComponent(selectedType)}?${reportQuery}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as ReportResponse
      if (!res.ok || !data.ok || !data.report) {
        throw new Error(data.message ?? "Could not load engagement report.")
      }
      setReport(data.report)
    } catch (loadError) {
      setReport(null)
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement report.")
    } finally {
      setLoadingReport(false)
    }
  }, [reportQuery, selectedType])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const unavailableSources = report
    ? Object.entries(report.sourceAvailability).filter(([, value]) => !value.source_available)
    : []

  return (
    <GrowthEngineCard title="Engagement reports">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label="Read-only export" tone="neutral" />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loadingCatalog ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading report catalog…
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((entry) => (
              <GrowthEngagementReportCard
                key={entry.reportType}
                entry={entry}
                selected={selectedType === entry.reportType}
                onSelect={setSelectedType}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Date range: {dateRange}
            {leadId.trim() ? ` · Lead ${leadId.trim()}` : ""}
            {templateId.trim() ? ` · Template ${templateId.trim()}` : ""}
          </p>
          <GrowthEngagementExportButton reportType={selectedType} query={reportQuery} disabled={loadingReport || !report} />
        </div>

        {unavailableSources.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              Some report sources are unavailable
            </div>
            <ul className="list-disc pl-5">
              {unavailableSources.map(([key, value]) => (
                <li key={key}>
                  {key}: {value.message ?? "Not queryable"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loadingReport ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading report preview…
          </div>
        ) : (
          <GrowthEngagementReportTable report={report} />
        )}

        {report ? (
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <p>Report ID: {report.reportId}</p>
            <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
            {Object.entries(report.totals).map(([key, value]) => (
              <p key={key}>
                {key.replaceAll("_", " ")}: {value ?? "—"}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}
