"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
  type GrowthEngagementCommandCenterSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

const DATE_RANGE_OPTIONS: Array<{ value: GrowthEngagementDashboardDateRangePreset; label: string }> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
]

export function GrowthEngagementCommandCenterHeader({
  dateRange,
  search,
  loading,
  sourceAvailability,
  onDateRangeChange,
  onSearchChange,
  onRefresh,
}: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  search: string
  loading: boolean
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability | null
  onDateRangeChange: (value: GrowthEngagementDashboardDateRangePreset) => void
  onSearchChange: (value: string) => void
  onRefresh: () => void
}) {
  const unavailableCount = sourceAvailability
    ? Object.values(sourceAvailability).filter((entry) => !entry.source_available).length
    : 0

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Engagement Command Center</h2>
          <p className="text-sm text-muted-foreground">
            Unified read-only workspace for metrics, timeline, reports, alerts, and watchlists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label="Read-only" tone="neutral" />
          <span className="text-xs text-muted-foreground">{GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={dateRange === option.value ? "default" : "outline"}
              onClick={() => onDateRangeChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <label className="min-w-[220px] flex-1 space-y-1 text-sm">
          <span className="text-muted-foreground">Search feed</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter timeline, alerts, reports…"
          />
        </label>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <GrowthBadge
          label={unavailableCount === 0 ? "All sources available" : `${unavailableCount} sources limited`}
          tone={unavailableCount === 0 ? "healthy" : "attention"}
        />
      </div>
    </div>
  )
}
