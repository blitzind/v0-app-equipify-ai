"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import { GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER } from "@/lib/growth/command/command-center-daily-action-queue"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import { cn } from "@/lib/utils"

type ActionQueueCard = {
  label: string
  value: number
  href: string
}

function ActionQueueMetricCard({ label, value, href }: ActionQueueCard) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[120px] h-full flex-col justify-center rounded-xl border border-border/80 bg-background px-4 py-4",
        "transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  )
}

type GrowthCommandDailyActionQueueProps = {
  briefing?: AidenDailyBriefing | null
  loading?: boolean
}

export function GrowthCommandDailyActionQueue({ briefing = null, loading = false }: GrowthCommandDailyActionQueueProps) {
  const [callsDue, setCallsDue] = useState(0)
  const [cadenceLoading, setCadenceLoading] = useState(true)

  const loadCadence = useCallback(async () => {
    setCadenceLoading(true)
    try {
      const res = await fetch("/api/platform/growth/cadence/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { summary?: GrowthCadenceCommandSummary | null }
      setCallsDue(data.summary?.callTasksDueCount ?? 0)
    } finally {
      setCadenceLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCadence()
  }, [loadCadence])

  const cards: ActionQueueCard[] = [
    {
      label: "Replies",
      value: briefing?.summary.replies_needing_attention ?? 0,
      href: "/admin/growth/inbox",
    },
    {
      label: "Meetings",
      value: (briefing?.inbox.meeting_requests ?? 0) + (briefing?.summary.meetings_today ?? 0),
      href: "/admin/growth/meetings",
    },
    {
      label: "Approvals",
      value: briefing?.summary.pending_approvals ?? 0,
      href: "/admin/growth/sequences/execution",
    },
    {
      label: "Calls Due",
      value: callsDue,
      href: "/admin/growth/calls/workspace",
    },
  ]

  const showLoading = (loading || cadenceLoading) && !briefing

  return (
    <section data-qa-marker={GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today&apos;s action queue</p>
      {showLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading action queue…
        </div>
      ) : (
        <div
          className="grid items-stretch gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {cards.map((card) => (
            <ActionQueueMetricCard key={card.label} {...card} />
          ))}
        </div>
      )}
    </section>
  )
}
