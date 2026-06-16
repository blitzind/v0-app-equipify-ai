"use client"

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Loader2 } from "lucide-react"
import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOperatorNotificationAnalyticsSnapshot } from "@/lib/growth/notifications/growth-notification-analytics-types"
import { GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER } from "@/lib/growth/notifications/growth-notification-analytics-types"

type AnalyticsResponse = {
  ok?: boolean
  analytics?: GrowthOperatorNotificationAnalyticsSnapshot
  message?: string
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function GrowthNotificationAnalyticsSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<GrowthOperatorNotificationAnalyticsSnapshot | null>(null)

  const refreshAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/notifications/analytics?windowDays=30", {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as AnalyticsResponse
      if (!res.ok || !data.ok || !data.analytics) {
        throw new Error(data.message ?? "Could not load notification analytics.")
      }
      setAnalytics(data.analytics)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notification analytics.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAnalytics()
  }, [refreshAnalytics])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            <p className="font-medium">Notification analytics</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Read-only operator notification metrics for the last {analytics?.windowDays ?? 30} days.
          </p>
          <p className="text-xs text-muted-foreground">{GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER}</p>
        </div>
        <GrowthBadge label="Read-only" tone="neutral" />
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading analytics…
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {analytics ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Total" value={analytics.totals.total} />
            <StatTile label="Unread" value={analytics.totals.unread} />
            <StatTile label="Critical/High" value={analytics.totals.criticalHigh} />
            <StatTile label="Acknowledged" value={analytics.totals.acknowledged} />
            <StatTile label="Dismissed" value={analytics.totals.dismissed} />
            <StatTile label="Push sent" value={analytics.push.sent} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Push failed" value={analytics.push.failed} />
            <StatTile label="Ack rate" value={formatRate(analytics.rates.acknowledgeRate)} />
            <StatTile label="Dismiss rate" value={formatRate(analytics.rates.dismissRate)} />
            <StatTile
              label="Median response"
              value={formatDuration(analytics.responseTiming.medianMs)}
            />
          </div>

          <div>
            <p className="text-sm font-medium">Top event types</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analytics.topEventTypes.length > 0 ? (
                analytics.topEventTypes.map((entry) => (
                  <GrowthBadge key={entry.key} label={`${entry.key} (${entry.count})`} tone="neutral" />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No notifications in window.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Top sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analytics.topSources.length > 0 ? (
                analytics.topSources.map((entry) => (
                  <GrowthBadge key={entry.key} label={`${entry.key} (${entry.count})`} tone="neutral" />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No source data in window.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
