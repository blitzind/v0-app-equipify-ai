"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Loader2 } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthMeetingCommandSummary } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

export function GrowthMeetingCommandSummary() {
  const [summary, setSummary] = useState<GrowthMeetingCommandSummary | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setSetupMessage(null)
    try {
      const res = await fetch("/api/platform/growth/meetings/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        summary?: GrowthMeetingCommandSummary | null
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
      <GrowthEngineCard title="Meeting Intelligence">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading meeting summary…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Meeting Intelligence">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          Calendar-aware meeting tracking — human confirms all writes.
        </div>
        <Link href="/admin/growth/meetings" className="text-sm text-indigo-600 hover:underline">
          Open meetings
        </Link>
      </div>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {setupMessage}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Meetings today" value={summary?.meetingsTodayCount ?? 0} />
        <StatTile label="No-shows" value={summary?.noShowCount ?? 0} />
        <StatTile label="Outcomes missing" value={summary?.outcomesMissingCount ?? 0} />
        <StatTile label="Follow-ups due" value={summary?.followUpsDueCount ?? 0} />
      </div>
    </GrowthEngineCard>
  )
}
