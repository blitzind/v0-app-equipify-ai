"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Crown, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthRevenueExecutiveCommandSummary } from "@/lib/growth/revenue-operating/revenue-operating-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export function GrowthExecutiveRevenueSummary() {
  const [summary, setSummary] = useState<GrowthRevenueExecutiveCommandSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/revenue-operating/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        summary?: GrowthRevenueExecutiveCommandSummary
      }
      if (res.ok && data.ok) setSummary(data.summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <GrowthEngineCard title="Executive Revenue">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading executive revenue summary…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Executive Revenue">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="size-4" />
          Forecast to goal and pipeline coverage — deterministic only.
        </div>
        <Link href="/admin/growth/revenue-operating" className="text-sm text-indigo-600 hover:underline">
          Revenue operating
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Forecast to goal" value={`${summary?.forecastToGoalRatio ?? 0}%`} />
        <StatTile label="Pipeline coverage" value={`${summary?.pipelineCoverage ?? 0}x`} />
        <StatTile label="Revenue risks" value={summary?.revenueRiskCount ?? 0} />
        <StatTile label="High-value stale" value={summary?.highValueStaleCount ?? 0} />
        <StatTile label="Commit forecast" value={formatCurrency(summary?.commitForecast ?? 0)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <GrowthBadge label={`Goal ${formatCurrency(summary?.activeGoal ?? 0)}`} tone="neutral" />
        {summary && summary.forecastToGoalRatio < 100 ? (
          <GrowthBadge label="Below goal" tone="attention" />
        ) : (
          <GrowthBadge label="On pace" tone="healthy" />
        )}
      </div>
    </GrowthEngineCard>
  )
}
