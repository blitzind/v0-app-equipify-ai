"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import { cadenceCallQueueHref } from "@/lib/growth/cadence/cadence-channel-engine"
import {
  GROWTH_CADENCE_CHANNEL_LABELS,
  GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER,
  type GrowthCadenceTask,
  type GrowthCadenceTaskOutcome,
} from "@/lib/growth/cadence/cadence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadCadencePanelProps = {
  lead: GrowthLead
  onTimelineRefresh?: () => void
}

function taskStatusTone(task: GrowthCadenceTask): "healthy" | "high" | "neutral" | "critical" {
  if (task.status === "completed") return "healthy"
  if (task.status === "skipped") return "neutral"
  if (task.status === "open" && task.dueAt && Date.parse(task.dueAt) < Date.now()) return "critical"
  return "high"
}

function formatDue(iso: string | null): string {
  if (!iso) return "No due date"
  return new Date(iso).toLocaleString()
}

function taskStatusLabel(task: GrowthCadenceTask): string {
  if (task.status === "completed") return task.outcome?.replace(/_/g, " ") ?? "Completed"
  if (task.status === "skipped") return task.skippedReason ? `Skipped · ${task.skippedReason}` : "Skipped"
  if (task.dueAt && Date.parse(task.dueAt) < Date.now()) return "Overdue"
  return "Due"
}

export function GrowthLeadCadencePanel({ lead, onTimelineRefresh }: GrowthLeadCadencePanelProps) {
  const [tasks, setTasks] = useState<GrowthCadenceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        leadId: lead.id,
        view: "sequence_progress",
        limit: "50",
      })
      const res = await fetch(`/api/platform/growth/cadence/tasks?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        feed?: { items?: GrowthCadenceTask[] }
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load cadence tasks.")
      if (data.meta?.schemaReady === false) {
        setSetupMessage(data.meta.setupMessage ?? null)
        setTasks([])
        return
      }
      setSetupMessage(null)
      setTasks(data.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  const timeline = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = Date.parse(a.completedAt ?? a.dueAt ?? a.createdAt)
      const bTime = Date.parse(b.completedAt ?? b.dueAt ?? b.createdAt)
      return bTime - aTime
    })
  }, [tasks])

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
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionTaskId(null)
    }
  }

  const openCount = tasks.filter((t) => t.status === "open").length

  return (
    <GrowthCollapsibleEngineCard
      id="growth-cadence"
      cardKey={GROWTH_DRAWER_CARD_KEYS.cadence}
      title="Multi-Channel Cadence"
      icon={<GitBranch className="size-4" />}
      summary={openCount > 0 ? `${openCount} open task${openCount === 1 ? "" : "s"}` : "No open cadence tasks"}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER} tone="neutral" />
          <GrowthBadge label="Human-owned only" tone="neutral" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading cadence timeline…
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {setupMessage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
        ) : null}

        {!loading && timeline.length === 0 && !setupMessage ? (
          <p className="text-sm text-muted-foreground">No cadence tasks for this lead yet.</p>
        ) : null}

        {!loading && timeline.length > 0 ? (
          <ul className="divide-y divide-border">
            {timeline.map((task) => (
              <li key={task.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={GROWTH_CADENCE_CHANNEL_LABELS[task.channel]} tone="neutral" />
                      <GrowthBadge label={taskStatusLabel(task)} tone={taskStatusTone(task)} />
                      {task.stepOrder ? <GrowthBadge label={`Step ${task.stepOrder}`} tone="neutral" /> : null}
                    </div>
                    <p className="mt-1 text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.status === "completed" && task.completedAt
                        ? `Completed ${formatDue(task.completedAt)}`
                        : `Due ${formatDue(task.dueAt)}`}
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
                    {(task.channel === "manual_call" || task.channel === "voicemail") && task.status === "open" ? (
                      <Link href={cadenceCallQueueHref(lead.id)} className="text-sm text-indigo-600 hover:underline">
                        Open call queue
                      </Link>
                    ) : null}
                    {task.meetingId ? (
                      <Link
                        href={`/admin/growth/meetings?highlight=${task.meetingId}`}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        View meeting
                      </Link>
                    ) : null}
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
                      onClick={() => void patchTask(task.id, { action: "skip", reason: "Skipped from lead drawer" })}
                    >
                      Skip
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
