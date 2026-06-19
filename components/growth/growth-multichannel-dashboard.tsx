"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Layers, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import {
  channelTypeLabel,
  GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE,
  GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER,
  taskStatusLabel,
  type GrowthMultichannelDashboard,
  type GrowthSequenceChannelTask,
} from "@/lib/growth/multichannel/multichannel-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  pending: "attention",
  approved: "medium",
  in_progress: "medium",
  completed: "healthy",
  skipped: "neutral",
  blocked: "blocked",
  failed: "critical",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthMultichannelDashboard
  message?: string
}

export function GrowthMultichannelDashboardView({
  advancedSettingsMode = false,
}: {
  advancedSettingsMode?: boolean
}) {
  const sequenceExecutionHref = useGrowthFeaturePath("sequences/execution")
  const bookingIntelligenceHref = useGrowthFeaturePath("booking-intelligence")
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthMultichannelDashboard | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/multichannel/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load multi-channel dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load multi-channel dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function planTasks() {
    setPlanning(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/multichannel/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not plan channel tasks.")
      await load()
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Could not plan channel tasks.")
    } finally {
      setPlanning(false)
    }
  }

  async function taskAction(task: GrowthSequenceChannelTask, action: "approve" | "complete" | "skip") {
    setActionLoading(`${action}:${task.id}`)
    try {
      const response = await fetch(`/api/platform/growth/multichannel/tasks/${task.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? `Could not ${action} task.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} task.`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading multi-channel orchestration…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!advancedSettingsMode ? (
            <>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={sequenceExecutionHref}>Sequence Execution</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={bookingIntelligenceHref}>Booking Intelligence</Link>
              </Button>
            </>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void planTasks()} disabled={planning}>
            {planning ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Plan Tasks
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Multi-Channel Orchestration" icon={<Layers className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatTile label="Channel Tasks Due" value={String(dashboard?.channelTasksDue ?? 0)} />
          <StatTile label="Email Steps" value={String(dashboard?.emailSteps ?? 0)} />
          <StatTile label="Call Tasks" value={String(dashboard?.callTasks ?? 0)} />
          <StatTile label="LinkedIn Manual Tasks" value={String(dashboard?.linkedinManualTasks ?? 0)} />
          <StatTile label="Booking Follow-ups" value={String(dashboard?.bookingFollowups ?? 0)} />
          <StatTile label="Blocked Future Channels" value={String(dashboard?.blockedFutureChannels ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Task Queue">
        {(dashboard?.taskQueue ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No channel tasks yet. Plan tasks from due sequence steps.</p>
        ) : (
          <div className="space-y-3">
            {(dashboard?.taskQueue ?? []).map((task) => (
              <div key={task.id} className="rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={channelTypeLabel(task.channel)} tone="attention" />
                      <GrowthBadge label={taskStatusLabel(task.status)} tone={STATUS_TONE[task.status] ?? "neutral"} />
                      <span className="font-medium">{task.title}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{task.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.leadLabel} · {formatDate(task.scheduledFor)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.callWorkspaceHref ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={task.callWorkspaceHref}>Calls</Link>
                        </Button>
                      ) : null}
                      {task.bookingIntelligenceHref ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={bookingIntelligenceHref}>Booking Intelligence</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.status === "pending" ? (
                      <>
                        <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => void taskAction(task, "approve")}>
                          Approve
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void taskAction(task, "skip")}>
                          Skip
                        </Button>
                      </>
                    ) : null}
                    {task.status === "approved" || task.status === "in_progress" ? (
                      <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => void taskAction(task, "complete")}>
                        Complete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Channel Performance">
          {(dashboard?.channelPerformance ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No channel performance snapshots yet.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.channelPerformance ?? []).slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <GrowthBadge label={channelTypeLabel(entry.channel)} tone="healthy" />
                    <span className="ml-2 text-muted-foreground">{entry.leadLabel}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">{entry.metricValue} · w{entry.attributionWeight}</span>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Routing Rules">
          <div className="space-y-2">
            {(dashboard?.routingRules ?? []).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{rule.label}</p>
                  <p className="text-muted-foreground">{channelTypeLabel(rule.channel)}</p>
                </div>
                <GrowthBadge label={rule.isFuturePlaceholder ? "future" : rule.isActive ? "active" : "inactive"} tone={rule.isFuturePlaceholder ? "blocked" : "neutral"} />
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Events">
        {(dashboard?.recentEvents ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No channel task events yet.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.recentEvents ?? []).slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={event.eventType.replace(/_/g, " ")} tone="neutral" />
                  <span className="font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}
