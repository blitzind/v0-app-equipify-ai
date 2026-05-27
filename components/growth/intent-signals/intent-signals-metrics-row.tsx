"use client"

import { Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatIntentSignalCount } from "@/components/growth/intent-signals/intent-signals-ux-constants"

export function IntentSignalsMetricsRow({
  totalLabel,
  totalCount,
  count24h,
  count7d,
  count30d,
  isPreview = false,
  exportDisabled = false,
}: {
  totalLabel?: string
  totalCount: number | null
  count24h: number | null
  count7d: number | null
  count30d: number | null
  isPreview?: boolean
  exportDisabled?: boolean
}) {
  const totalDisplay = totalCount != null ? totalCount.toLocaleString() : "—"

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-label={isPreview ? "Sample result counts" : "Result counts"}>
        <span className="font-medium text-foreground">{totalLabel ?? "Results"}</span>{" "}
        <span className="tabular-nums text-foreground">{totalDisplay}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Results:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatIntentSignalCount(count24h)} (24h)
          </span>
          {" | "}
          <span className="font-medium tabular-nums text-foreground">
            {formatIntentSignalCount(count7d)} (7d)
          </span>
          {" | "}
          <span className="font-medium tabular-nums text-foreground">
            {formatIntentSignalCount(count30d)} (30d)
          </span>
        </p>
        <Button type="button" variant="outline" size="sm" disabled={exportDisabled} className="h-8 gap-1.5">
          <Upload className="size-3.5" />
          Export
          {exportDisabled ? (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              Soon
            </Badge>
          ) : null}
        </Button>
      </div>
    </div>
  )
}
