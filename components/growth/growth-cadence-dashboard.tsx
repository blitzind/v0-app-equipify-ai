"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { GitBranch, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CADENCE_CHANNEL_LABELS,
  GROWTH_CADENCE_INBOX_VIEWS,
  GROWTH_CADENCE_TASK_CHANNELS,
  GROWTH_CADENCE_TASK_OUTCOMES,
  type GrowthCadenceDashboard,
  type GrowthCadenceInboxView,
  type GrowthCadenceTask,
  type GrowthCadenceTaskChannel,
  type GrowthCadenceTaskOutcome,
} from "@/lib/growth/cadence/cadence-types"
import { cadenceCallQueueHref } from "@/lib/growth/cadence/cadence-channel-engine"

const VIEW_LABELS: Record<GrowthCadenceInboxView, string> = {
  due: "Due",
  overdue: "Overdue",
  by_channel: "By Channel",
  completed_today: "Completed Today",
  skipped: "Skipped",
  sequence_progress: "Open Tasks",
}

export function GrowthCadenceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthCadenceDashboard | null>(null)
  const [items, setItems] = useState<GrowthCadenceTask[]>([])
  const [view, setView] = useState<GrowthCadenceInboxView>("due")
  const [channelFilter, setChannelFilter] = useState<GrowthCadenceTaskChannel | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthCadenceInboxView) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50" })
      if (channelFilter) params.set("channel", channelFilter)
      const [dashRes, inboxRes] = await Promise.all([
        fetch("/api/platform/growth/cadence/dashboard", { cache: "no-store" }),
        fetch(`/api/platform/growth/cadence/tasks?${params.toString()}`, { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthCadenceDashboard | null
        message?: string
      }
      const inboxData = (await inboxRes.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: GrowthCadenceTask[] }
        message?: string
      }
      if (!dashRes.ok || !dashData.ok) throw new Error(dashData.message ?? "Could not load cadence dashboard.")
      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setDashboard(null)
        setItems([])
        return
      }
      if (!inboxRes.ok || !inboxData.ok) throw new Error(inboxData.message ?? "Could not load cadence tasks.")
      setSetupMessage(null)
      setDashboard(dashData.dashboard ?? null)
      setItems(inboxData.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [channelFilter])

  useEffect(() => {
    void load(view)
  }, [load, view])

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    setActionTaskId(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/cadence/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await load(view)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionTaskId(null)
    }
  }

  if (loading && !dashboard && !setupMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading multi-channel cadence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_CADENCE_INBOX_VIEWS.map((option) => (
            <Button key={option} size="sm" variant={view === option ? "default" : "outline"} onClick={() => setView(option)}>
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        value={channelFilter}
        onChange={(e) => setChannelFilter(e.target.value as GrowthCadenceTaskChannel | "")}
      >
        <option value="">All channels</option>
        {GROWTH_CADENCE_TASK_CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {GROWTH_CADENCE_CHANNEL_LABELS[channel]}
          </option>
        ))}
      </select>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {setupMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={dashboard.qaMarker} tone="healthy" />
            <GrowthBadge label="Human-owned tasks only" tone="neutral" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<GitBranch className="size-3.5" />} label="Due" value={dashboard.dueCount} />
            <StatTile label="Overdue" value={dashboard.overdueCount} />
            <StatTile label="Call tasks due" value={dashboard.callTasksDueCount} />
            <StatTile label="LinkedIn tasks due" value={dashboard.linkedinTasksDueCount} />
            <StatTile label="Meeting follow-ups" value={dashboard.meetingFollowupsDueCount} />
            <StatTile label="Completed today" value={dashboard.completedTodayCount} />
            <StatTile label="Skipped" value={dashboard.skippedCount} />
          </div>
        </>
      ) : null}

      <GrowthEngineCard title="Owner task queue">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cadence tasks in this view.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((task) => (
              <li key={task.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{task.companyName ?? "Lead"}</p>
                    <p className="text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {GROWTH_CADENCE_CHANNEL_LABELS[task.channel]}
                      {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleString()}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.instructions}</p>
                    {task.suggestedSmsText ? (
                      <p className="mt-2 rounded border border-dashed border-border bg-muted/30 p-2 text-xs">
                        Suggested SMS (copy & send manually): {task.suggestedSmsText}
                      </p>
                    ) : null}
                    {task.templateDraft ? (
                      <p className="mt-2 rounded border border-dashed border-border bg-muted/30 p-2 text-xs">
                        Draft: {task.templateDraft}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/admin/growth/leads?open=${task.leadId}&focus=sequence`}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Open lead
                    </Link>
                    {(task.channel === "manual_call" || task.channel === "voicemail") && (
                      <Link href={cadenceCallQueueHref(task.leadId)} className="text-sm text-indigo-600 hover:underline">
                        Call queue
                      </Link>
                    )}
                  </div>
                </div>
                {task.status === "open" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["connected", "left_voicemail", "no_answer", "interested", "meeting_booked"] as GrowthCadenceTaskOutcome[]).map(
                      (outcome) => (
                        <Button
                          key={outcome}
                          size="sm"
                          variant="outline"
                          disabled={actionTaskId === task.id}
                          onClick={() => void patchTask(task.id, { action: "complete", outcome })}
                        >
                          {outcome.replace(/_/g, " ")}
                        </Button>
                      ),
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionTaskId === task.id}
                      onClick={() => void patchTask(task.id, { action: "skip", reason: "Skipped by operator" })}
                    >
                      Skip
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
