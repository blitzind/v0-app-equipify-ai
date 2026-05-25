"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { GitBranch, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"

export function GrowthCadenceCommandSummary() {
  const [summary, setSummary] = useState<GrowthCadenceCommandSummary | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/cadence/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        summary?: GrowthCadenceCommandSummary | null
      }
      if (res.ok && data.ok) {
        if (data.meta?.schemaReady === false) {
          setSetupMessage(data.meta.setupMessage ?? null)
          setSummary(null)
        } else {
          setSummary(data.summary ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <GrowthEngineCard title="Multi-Channel Cadence">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading cadence summary…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Multi-Channel Cadence">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="size-4" />
          Email → outreach queue · other channels → owner tasks (no auto-send).
        </div>
        <Link href="/admin/growth/sequences/execution" className="text-sm text-indigo-600 hover:underline">
          Open execution
        </Link>
      </div>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Tasks due today" value={summary?.tasksDueTodayCount ?? 0} />
        <StatTile label="Overdue cadence" value={summary?.overdueCadenceTasksCount ?? 0} />
        <StatTile label="Call tasks due" value={summary?.callTasksDueCount ?? 0} />
        <StatTile label="LinkedIn tasks due" value={summary?.linkedinTasksDueCount ?? 0} />
        <StatTile label="Meeting follow-ups" value={summary?.meetingFollowupsDueCount ?? 0} />
      </div>
      {summary ? (
        <div className="mt-3">
          <GrowthBadge label={summary.qaMarker} tone="healthy" />
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}
