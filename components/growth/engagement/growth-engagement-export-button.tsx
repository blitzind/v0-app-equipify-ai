"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthEngagementReportType } from "@/lib/growth/engagement/growth-engagement-report-types"

export function GrowthEngagementExportButton({
  reportType,
  query,
  disabled,
}: {
  reportType: GrowthEngagementReportType | null
  query: string
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (!reportType) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement-dashboard/reports/${encodeURIComponent(reportType)}/csv?${query}&format=csv`,
        {
          cache: "no-store",
          headers: { Accept: "text/csv" },
        },
      )
      if (!res.ok) {
        throw new Error("Could not export CSV.")
      }
      const blob = await res.blob()
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `${reportType}-export.csv`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={disabled || !reportType || loading} onClick={() => void handleDownload()}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Download CSV
    </Button>
  )
}
