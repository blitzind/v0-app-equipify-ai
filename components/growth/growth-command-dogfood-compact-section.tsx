"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthDogfoodCommandSummary } from "@/lib/growth/dogfood/dogfood-types"

export function GrowthCommandDogfoodCompactSection() {
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
      <GrowthEngineCard title="Blitz Dogfood Readiness" icon={<ClipboardCheck className="size-4" />}>
        <p className="text-sm text-muted-foreground">Loading dogfood readiness…</p>
      </GrowthEngineCard>
    )
  }

  if (setupMessage) {
    return (
      <GrowthEngineCard title="Blitz Dogfood Readiness" icon={<ClipboardCheck className="size-4" />}>
        <p className="text-sm text-muted-foreground">{setupMessage}</p>
      </GrowthEngineCard>
    )
  }

  const validatedSubsystems = 6 - (summary?.failedSubsystems ?? 0)
  const nextAction = summary?.readyForBlitzUsage
    ? "All subsystems validated or warning — continue daily checks."
    : summary?.criticalBlockers
      ? "Resolve critical blockers before Blitz daily usage."
      : summary?.failedSubsystems
        ? "Re-run validation on failed subsystems."
        : "Record validation runs for untested subsystems."

  return (
    <GrowthEngineCard title="Blitz Dogfood Readiness" icon={<ClipboardCheck className="size-4" />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Readiness" value={`${summary?.overallReadinessPercent ?? 0}%`} />
        <StatTile label="Open blockers" value={summary?.openBlockers ?? 0} />
        <StatTile label="Critical blockers" value={summary?.criticalBlockers ?? 0} />
        <StatTile label="Validated subsystems" value={`${validatedSubsystems}/6`} />
        <StatTile label="Blitz ready" value={summary?.readyForBlitzUsage ? "Yes" : "No"} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{nextAction}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {summary?.readyForBlitzUsage ? (
          <GrowthBadge label="Ready for Blitz usage" tone="healthy" />
        ) : (
          <GrowthBadge label="Validation in progress" tone="neutral" />
        )}
        <Link href="/admin/growth/dogfood" className="text-sm text-indigo-600 hover:underline">
          Open validation center
        </Link>
      </div>
    </GrowthEngineCard>
  )
}
