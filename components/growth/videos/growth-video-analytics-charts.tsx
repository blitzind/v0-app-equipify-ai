"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type {
  GrowthVideoAnalyticsDistributionBucket,
  GrowthVideoAnalyticsTimeSeriesPoint,
  GrowthVideoAnalyticsTopItem,
} from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoAnalyticsViewsChart({
  data,
}: {
  data: GrowthVideoAnalyticsTimeSeriesPoint[]
}) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No views recorded yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function GrowthVideoAnalyticsDistributionChart({
  data,
  title,
}: {
  data: GrowthVideoAnalyticsDistributionBucket[]
  title: string
}) {
  if (!data.some((bucket) => bucket.count > 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No {title.toLowerCase()} data yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GrowthVideoAnalyticsTopList({
  title,
  items,
}: {
  title: string
  items: GrowthVideoAnalyticsTopItem[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{item.title}</span>
              <span className="tabular-nums text-muted-foreground">
                {item.views} views
                {item.engagementScore != null ? ` · ${item.engagementScore} score` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
