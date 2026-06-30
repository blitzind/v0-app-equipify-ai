"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementAlertCard } from "@/components/growth/engagement/growth-engagement-alert-card"
import type { GrowthEngagementDrilldownTarget } from "@/components/growth/engagement/growth-engagement-drilldown-drawer"
import {
  useEngagementAlertFilterChips,
} from "@/components/growth/engagement/growth-engagement-watchlists-panel"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import {
  type GrowthEngagementAlert,
  type GrowthEngagementAlertSeverity,
  type GrowthEngagementAlertType,
  type GrowthEngagementAlertsListResponse,
} from "@/lib/growth/engagement/growth-engagement-alert-types"

type AlertsResponse = {
  ok?: boolean
  alerts?: GrowthEngagementAlert[]
  total?: number
  sourceAvailability?: GrowthEngagementAlertsListResponse["sourceAvailability"]
  message?: string
}

export function GrowthEngagementAlertsPanel({
  dateRange,
  query,
  selectedWatchlistId,
  onOpenDrilldown,
}: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  query: string
  selectedWatchlistId: string | null
  onOpenDrilldown?: (target: GrowthEngagementDrilldownTarget) => void
}) {
  const { severity, alertType, setSeverity, setAlertType, chipQuery, severityOptions, alertTypeOptions } =
    useEngagementAlertFilterChips()
  const [alerts, setAlerts] = useState<GrowthEngagementAlert[]>([])
  const [total, setTotal] = useState(0)
  const [sourceAvailability, setSourceAvailability] = useState<GrowthEngagementAlertsListResponse["sourceAvailability"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const alertQuery = useMemo(() => {
    const params = new URLSearchParams(query)
    params.set("limit", "100")
    if (selectedWatchlistId) params.set("watchlistId", selectedWatchlistId)
    if (chipQuery) {
      const chipParams = new URLSearchParams(chipQuery)
      chipParams.forEach((value, key) => params.set(key, value))
    }
    return params.toString()
  }, [query, selectedWatchlistId, chipQuery])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/engagement-dashboard/alerts?${alertQuery}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as AlertsResponse
      if (!res.ok || !data.ok || !data.alerts) {
        throw new Error(data.message ?? "Could not load engagement alerts.")
      }
      setAlerts(data.alerts)
      setTotal(data.total ?? data.alerts.length)
      setSourceAvailability(data.sourceAvailability ?? null)
    } catch (loadError) {
      setAlerts([])
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement alerts.")
    } finally {
      setLoading(false)
    }
  }, [alertQuery])

  useEffect(() => {
    void load()
  }, [load])

  const unavailableSources = sourceAvailability
    ? Object.entries(sourceAvailability).filter(([, value]) => !value.source_available)
    : []

  return (
    <GrowthEngineCard title="Engagement alerts">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label="Read-only feed" tone="neutral" />
          <span className="text-xs text-muted-foreground">{total} matching alerts · {dateRange}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChipGroup<GrowthEngagementAlertSeverity>
            label="Severity"
            value={severity}
            options={severityOptions}
            onChange={setSeverity}
          />
          <FilterChipGroup<GrowthEngagementAlertType>
            label="Type"
            value={alertType}
            options={alertTypeOptions}
            onChange={setAlertType}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {unavailableSources.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              Some alert sources are unavailable
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

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts match the current watchlist and filters.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <GrowthEngagementAlertCard key={alert.alertId} alert={alert} onOpenDrilldown={onOpenDrilldown} />
            ))}
          </ul>
        )}
      </div>
    </GrowthEngineCard>
  )
}

function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: readonly T[]
  onChange: (value: T | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Button size="sm" variant={value == null ? "default" : "outline"} onClick={() => onChange(null)}>
        All
      </Button>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={value === option ? "default" : "outline"}
          onClick={() => onChange(value === option ? null : option)}
        >
          {option.replaceAll("_", " ")}
        </Button>
      ))}
    </div>
  )
}
