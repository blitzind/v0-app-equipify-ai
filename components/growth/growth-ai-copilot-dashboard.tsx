"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"

type DashboardPayload = {
  recentGenerations: Array<GrowthAiCopilotGeneration & { companyName: string }>
  approvalQueue: Array<GrowthAiCopilotGeneration & { companyName: string }>
  topClassifications: Array<{ key: string; count: number }>
  generationEffectiveness: {
    approvedRate: number
    outcomeCounts: Record<string, number>
    variantAverages: Array<{ variant: string; averageScore: number; count: number }>
  }
}

function GenerationList({
  title,
  items,
}: {
  title: string
  items: Array<GrowthAiCopilotGeneration & { companyName: string }>
}) {
  return (
    <GrowthEngineCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{entry.companyName}</p>
                <p className="text-muted-foreground capitalize">{entry.generationType.replace(/_/g, " ")}</p>
                {entry.generatedSubject ? (
                  <p className="mt-1 text-xs text-foreground/80">{entry.generatedSubject}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <GrowthBadge label={entry.status} tone={entry.status === "draft" ? "warning" : "neutral"} />
                <GrowthBadge label={entry.promptVariant} tone="neutral" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthAiCopilotDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/copilot/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load copilot dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading copilot dashboard…
      </div>
    )
  }

  if (error && !dashboard) return <p className="text-sm text-rose-600">{error}</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={<Bot className="size-3.5" />} label="Approval queue" value={dashboard.approvalQueue.length} />
          <StatTile label="Approved rate" value={`${dashboard.generationEffectiveness.approvedRate}%`} />
          <StatTile label="Generated (30d)" value={dashboard.generationEffectiveness.outcomeCounts.generated ?? 0} />
          <StatTile label="Approved (30d)" value={dashboard.generationEffectiveness.outcomeCounts.approved ?? 0} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GenerationList title="Recent generations" items={dashboard.recentGenerations} />
        <GenerationList title="Approval queue" items={dashboard.approvalQueue} />
      </div>

      <GrowthEngineCard title="Top classifications">
        {dashboard.topClassifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classifications recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.topClassifications.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="capitalize">{entry.key.replace(/_/g, " ")}</span>
                <span className="tabular-nums font-semibold">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Generation effectiveness">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(dashboard.generationEffectiveness.outcomeCounts).map(([key, count]) => (
            <StatTile key={key} label={key} value={count} />
          ))}
        </div>
        {dashboard.generationEffectiveness.variantAverages.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {dashboard.generationEffectiveness.variantAverages.map((entry) => (
              <li key={entry.variant} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>{entry.variant}</span>
                <span className="tabular-nums font-semibold">
                  {entry.averageScore} · n={entry.count}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </GrowthEngineCard>
    </div>
  )
}
