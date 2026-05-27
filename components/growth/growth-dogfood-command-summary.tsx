"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthDogfoodCommandSummary } from "@/lib/growth/dogfood/dogfood-types"

export function GrowthDogfoodCommandSummary() {
  const [summary, setSummary] = useState<GrowthDogfoodCommandSummary | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/dogfood/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        summary?: GrowthDogfoodCommandSummary | null
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
      <GrowthEngineCard title="Blitz Dogfood Readiness">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading dogfood status…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Blitz Dogfood Readiness">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardCheck className="size-4" />
          Internal revenue validation for Blitz Industries daily usage.
        </div>
        <Link href="/admin/growth/dogfood" className="text-sm text-indigo-600 hover:underline">
          Open validation center
        </Link>
      </div>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Readiness" value={`${summary?.overallReadinessPercent ?? 0}%`} />
        <StatTile label="Open blockers" value={summary?.openBlockers ?? 0} />
        <StatTile label="Critical blockers" value={summary?.criticalBlockers ?? 0} />
        <StatTile label="Failed subsystems" value={summary?.failedSubsystems ?? 0} />
        <StatTile label="Blitz ready" value={summary?.readyForBlitzUsage ? "Yes" : "No"} />
      </div>
      {summary ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.readyForBlitzUsage ? (
            <GrowthBadge label="Ready for Blitz usage" tone="healthy" />
          ) : (
            <GrowthBadge label="Validation in progress" tone="high" />
          )}
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}
