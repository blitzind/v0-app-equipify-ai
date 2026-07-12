"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import { GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER } from "@/lib/growth/command/command-center-daily-action-queue"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import { isDailyRevenueWorkQueueEnabledClient } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { isAutonomousExecutionGuardrailsEnabledClient } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-feature"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import { teammatePossessive } from "@/lib/workspace/ai-teammate-voice"
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
  const { teammate } = useAiTeammateIdentity()
  const [callsDue, setCallsDue] = useState(0)
  const [cadenceLoading, setCadenceLoading] = useState(true)
  const [workQueue, setWorkQueue] = useState<DailyRevenueWorkQueueDisplaySummary | null>(null)
  const [workQueueLoading, setWorkQueueLoading] = useState(false)

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

  const loadWorkQueue = useCallback(async () => {
    if (!isDailyRevenueWorkQueueEnabledClient()) {
      setWorkQueue(null)
      return
    }
    setWorkQueueLoading(true)
    try {
      const res = await fetch("/api/platform/growth/daily-revenue-work-queue", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        enabled?: boolean
        display?: DailyRevenueWorkQueueDisplaySummary | null
      }
      setWorkQueue(res.ok && data.ok && data.enabled ? data.display ?? null : null)
    } finally {
      setWorkQueueLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCadence()
    void loadWorkQueue()
  }, [loadCadence, loadWorkQueue])

  const cards: ActionQueueCard[] = workQueue
    ? [
        {
          label: "Actionable today",
          value: workQueue.actionable_count,
          href: "/admin/growth/command",
        },
        {
          label: "Waiting",
          value: workQueue.waiting_count,
          href: "/admin/growth/command",
        },
        {
          label: "Blocked",
          value: workQueue.blocked_count,
          href: "/admin/growth/command",
        },
        {
          label: "Est. minutes",
          value: workQueue.estimated_workload_minutes,
          href: "/admin/growth/execution",
        },
      ]
    : [
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

  const showLoading = (loading || cadenceLoading || workQueueLoading) && !briefing && !workQueue

  return (
    <section data-qa-marker={GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {workQueue ? `${teammatePossessive(teammate)} daily work queue` : "Today\u2019s action queue"}
      </p>
      {workQueue?.channel_summary ? (
        <p className="mb-3 text-sm text-muted-foreground">{workQueue.channel_summary}</p>
      ) : null}
      {showLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading action queue…
        </div>
      ) : (
        <>
          <div
            className="grid items-stretch gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
            {cards.map((card) => (
              <ActionQueueMetricCard key={card.label} {...card} />
            ))}
          </div>
          {workQueue && workQueue.top_items.length > 0 ? (
            <ul className="mt-4 space-y-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              {workQueue.top_items.slice(0, 5).map((item) => (
                <li key={`${item.lead_id}-${item.action_label}`} className="flex justify-between gap-3 text-sm">
                  <span>
                    {item.action_label} · {item.channel_label}
                  </span>
                  <span className="text-xs uppercase text-muted-foreground">{item.priority}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {isAutonomousExecutionGuardrailsEnabledClient() ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Autonomous execution guardrails preview is active — queue items still require human approval before send.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
