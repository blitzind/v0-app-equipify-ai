"use client"

import type { GrowthSharePageOperatorAnalyticsPanel } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function formatDuration(ms: number): string {
  if (ms <= 0) return "—"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`
}

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function BreakdownList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 6)
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between gap-2">
              <span className="truncate capitalize">{key.replace(/_/g, " ")}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GrowthSharePageAnalyticsPanel({ analytics }: { analytics: GrowthSharePageOperatorAnalyticsPanel }) {
  return (
    <section className="rounded-lg border p-4" aria-labelledby="sp-analytics">
      <h3 id="sp-analytics" className="text-sm font-semibold">
        Analytics
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Total views</p>
          <p className="text-sm font-semibold">{analytics.overview.totalViews}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Unique visitors</p>
          <p className="text-sm font-semibold">{analytics.overview.uniqueVisitors}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Time on page</p>
          <p className="text-sm font-semibold">{formatDuration(analytics.overview.timeOnPageMs)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CTA clicks</p>
          <p className="text-sm font-semibold">{analytics.overview.ctaClicks}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Calendar clicks</p>
          <p className="text-sm font-semibold">{analytics.overview.calendarClicks}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last visit</p>
          <p className="text-sm font-semibold">{formatWhen(analytics.overview.lastVisitAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <BreakdownList title="Device type" values={analytics.breakdowns.deviceType} />
        <BreakdownList title="Browser" values={analytics.breakdowns.browser} />
        <BreakdownList title="Referrer" values={analytics.breakdowns.referrer} />
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
        {analytics.trend.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No engagement events yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {analytics.trend.map((entry) => (
              <li key={`${entry.eventType}:${entry.occurredAt}`} className="rounded border px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{entry.label}</span>
                  <time dateTime={entry.occurredAt}>{formatWhen(entry.occurredAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
