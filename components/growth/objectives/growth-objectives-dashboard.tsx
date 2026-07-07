"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GrowthObjectiveDashboardModel } from "@/lib/growth/objectives/growth-objective-types"
import { computeObjectiveDashboardProgress, computeObjectiveStageDurationMs, isObjectiveRuntimeStalled } from "@/lib/growth/objectives/growth-objective-stage-state-machine"
import { summarizeObjectiveExecutionContext, summarizeObjectiveMaterializationHealth, normalizeGrowthObjectiveForRead } from "@/lib/growth/objectives/growth-objective-execution-context"
import { buildObjectiveSignalSnapshot } from "@/lib/growth/objectives/growth-objective-signal-handler"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthPriorityBindingObjectiveContext } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"

export function GrowthObjectivesDashboard() {
  const [dashboard, setDashboard] = useState<GrowthObjectiveDashboardModel | null>(null)
  const [selected, setSelected] = useState<GrowthObjective | null>(null)
  const [priorityContext, setPriorityContext] = useState<GrowthPriorityBindingObjectiveContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("Book 20 demos with medical equipment companies")
  const [targetValue, setTargetValue] = useState("20")

  const load = useCallback(async () => {
    const response = await fetch("/api/growth/workspace/objectives", { cache: "no-store" })
    const body = (await response.json()) as { ok?: boolean; dashboard?: GrowthObjectiveDashboardModel; error?: string }
    if (!response.ok || !body.ok || !body.dashboard) {
      throw new Error(body.error ?? "Could not load objectives.")
    }
    setDashboard(body.dashboard)
    setSelected(
      body.dashboard.objectives[0] ? normalizeGrowthObjectiveForRead(body.dashboard.objectives[0]) : null,
    )
    setError(null)
  }, [])

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load objectives.")
    })
  }, [load])

  useEffect(() => {
    if (!selected?.id) {
      setPriorityContext(null)
      return
    }
    void fetch(`/api/growth/workspace/objectives/priority-binding?objectiveId=${selected.id}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean
          objectiveContext?: GrowthPriorityBindingObjectiveContext | null
        }
        if (response.ok && body.ok) {
          setPriorityContext(body.objectiveContext ?? null)
        } else {
          setPriorityContext(null)
        }
      })
      .catch(() => setPriorityContext(null))
  }, [selected?.id])

  async function createObjective() {
    setSaving(true)
    try {
      const response = await fetch("/api/growth/workspace/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "Objective-driven demo booking campaign for medical equipment ICP.",
          objectiveType: "demos_booked",
          targetValue: Number(targetValue),
        }),
      })
      const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Create failed.")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create failed.")
    } finally {
      setSaving(false)
    }
  }

  async function runAction(objectiveId: string, action: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/growth/workspace/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          signals:
            action === "adapt"
              ? {
                  opens: 120,
                  clicks: 18,
                  replies: 0,
                  videoViews: 40,
                  videoCompletions: 28,
                  bookings: 2,
                  engagementScore: 72,
                  intentScore: 78,
                  sequenceOpenRate: 0.12,
                  sequenceReplyRate: 0.03,
                }
              : undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Action failed.")
      await load()
      if (body.objective) setSelected(normalizeGrowthObjectiveForRead(body.objective))
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.")
    } finally {
      setSaving(false)
    }
  }

  if (error && !dashboard) return <p className="text-sm text-destructive">{error}</p>
  if (!dashboard) return <p className="text-sm text-muted-foreground">Loading objectives…</p>

  return (
    <div className="space-y-6" data-qa-marker={dashboard.qa_marker} data-runtime-qa-marker={dashboard.runtime_qa_marker}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active objectives" value={String(dashboard.activeCount)} />
        <Stat label="Running" value={String(dashboard.runningCount)} />
        <Stat label="Paused" value={String(dashboard.pausedCount)} />
        <Stat label="Progress" value={`${dashboard.totalProgress}/${dashboard.totalTarget}`} />
        <Stat label="Emergency stop" value={dashboard.emergencyStopActive ? "Active" : "Off"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create objective</CardTitle>
          <CardDescription>Deterministic planner + closed-loop runtime — policy-gated execution.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="objective-title">Title</Label>
            <Input id="objective-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objective-target">Target demos</Label>
            <Input
              id="objective-target"
              type="number"
              min={1}
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button disabled={saving} onClick={() => void createObjective()}>
              Plan &amp; start
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Objectives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground">No objectives yet.</p>
            ) : (
              dashboard.objectives.map((objective) => (
                <button
                  key={objective.id}
                  type="button"
                  className="w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => setSelected(normalizeGrowthObjectiveForRead(objective))}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{objective.title}</p>
                    <Badge variant="outline">{objective.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {objective.currentValue}/{objective.targetValue} {objective.objectiveType.replace(/_/g, " ")}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {selected?.plan?.icpStrategy ? (
          <Card>
            <CardHeader>
              <CardTitle>Live runtime</CardTitle>
              <CardDescription>{selected.plan.icpStrategy.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.runtime?.running && isObjectiveRuntimeStalled(selected) ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                  Stalled — no runtime activity in the last 45 minutes. Scheduler will retry automatically.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <Stat
                  label="Current stage"
                  value={selected.runtime?.currentStageId?.replace(/_/g, " ") ?? "—"}
                />
                <Stat label="Progress %" value={`${computeObjectiveDashboardProgress(selected)}%`} />
                <Stat label="Leads needed" value={String(selected.plan.forecast.leadsNeeded)} />
                <Stat label="Est. completion" value={formatDate(selected.runtime?.estimatedCompletionDate)} />
                <Stat label="Last signal" value={formatDate(selected.runtime?.lastSignalAt)} />
                <Stat label="Last progress" value={formatDate(selected.runtime?.lastProgressAt)} />
                <Stat label="Last scheduler" value={formatDate(selected.runtime?.lastSchedulerAt)} />
                <Stat
                  label="Scheduler runs"
                  value={String(selected.runtime?.schedulerRunCount ?? 0)}
                />
                {selected.runtime?.stalledSince ? (
                  <Stat label="Stalled since" value={formatDate(selected.runtime.stalledSince)} />
                ) : null}
              </div>

              {(selected.recentSignals?.length ?? 0) > 0 ? (
                <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                  {(() => {
                    const snapshot = buildObjectiveSignalSnapshot(selected.recentSignals)
                    return (
                      <p>
                        Signals: {snapshot.opens} opens · {snapshot.replies} replies · {snapshot.videoCompletions}{" "}
                        video completions · {snapshot.bookings} bookings · {snapshot.opportunities} opportunities ·{" "}
                        {snapshot.customers} customers
                      </p>
                    )
                  })()}
                </div>
              ) : null}

              {priorityContext?.topBinding ? (
                <div
                  className="rounded-md border border-indigo-200 bg-indigo-50/40 px-3 py-3 text-sm"
                  data-qa-section="objective-priority-binding"
                >
                  <p className="font-medium">Priority binding (read-only)</p>
                  <p className="mt-1 text-xs text-muted-foreground">{priorityContext.topBinding.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">
                      Next: {(priorityContext.topBinding.recommendedNextStep ?? "unknown").replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="outline">
                      {(priorityContext.topBinding.status ?? "unknown").replaceAll("_", " ")}
                    </Badge>
                    {priorityContext.topBinding.blockers?.some((blocker) => blocker.type === "approval") ? (
                      <Badge variant="destructive">Approval required</Badge>
                    ) : null}
                  </div>
                  {priorityContext.topBinding.route ? (
                    <a href={priorityContext.topBinding.route} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                      Review in workspace
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="text-sm font-medium mb-2">Stage health</p>
                <div className="space-y-2">
                  {selected.plan.stages.map((stage) => {
                    const runtimeStage = selected.runtime?.stageStates[stage.id]
                    const durationMs = computeObjectiveStageDurationMs(runtimeStage)
                    return (
                      <div key={stage.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span>{stage.label}</span>
                          <Badge variant="secondary">
                            {runtimeStage?.state ?? stage.status}
                          </Badge>
                        </div>
                        {durationMs != null ? (
                          <p className="text-xs text-muted-foreground mt-1">Stage duration: {formatDuration(durationMs)}</p>
                        ) : null}
                        {runtimeStage?.blockers?.length ? (
                          <p className="text-xs text-amber-700 mt-1">
                            Blockers: {runtimeStage.blockers.join("; ")}
                          </p>
                        ) : null}
                        {(stage.recommendations?.length ?? 0) > 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {stage.recommendations?.[0]}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              {selected.executionContext ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Execution health</p>
                    {(() => {
                      const summary = summarizeObjectiveExecutionContext(selected.executionContext)
                      return (
                        <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground rounded-md border px-3 py-2">
                          <span>Launch runs: {summary.launchRuns}</span>
                          <span>Active campaigns: {summary.activeCampaigns}</span>
                          <span>Enrollments: {summary.enrollments}</span>
                          <span>Videos generated: {summary.videosGenerated}</span>
                          <span>Sequences generated: {summary.sequencesCreated}</span>
                          <span>Pages: {summary.pagesCreated}</span>
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Runtime recovery</p>
                    <div className="text-xs text-muted-foreground rounded-md border px-3 py-2 space-y-1">
                      <p>Recovered at: {formatDate(selected.executionContext.recoveredAt)}</p>
                      <p>Subscriptions: {selected.eventSubscriptions?.items?.length ?? 0}</p>
                      <p>Runtime running: {selected.runtime?.running ? "yes" : "no"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Materialization health</p>
                    {(() => {
                      const health = summarizeObjectiveMaterializationHealth(selected.executionContext)
                      return (
                        <div className="grid gap-2 sm:grid-cols-4 text-xs text-muted-foreground rounded-md border px-3 py-2">
                          <span>Complete: {health.complete}</span>
                          <span>Partial: {health.partial}</span>
                          <span>Failed: {health.failed}</span>
                          <span>Retrying: {health.retrying}</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ) : null}

              {(selected.recommendations?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Adaptive recommendations</p>
                  <ul className="space-y-2 text-sm">
                    {selected.recommendations.slice(0, 5).map((entry) => (
                      <li key={entry.id} className="rounded-md border px-3 py-2">
                        {entry.recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(selected.recentSignals?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Recent signals</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {selected.recentSignals.slice(0, 5).map((signal) => (
                      <li key={signal.id}>
                        {signal.type} — {signal.receivedAt}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(selected.executionHistory?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Execution history</p>
                  <ul className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    {selected.executionHistory.slice(0, 8).map((entry) => (
                      <li key={entry.id}>
                        {entry.stageId}: {entry.action} → {entry.outcome}
                        {entry.policyGated ? " (policy-gated)" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "tick")}>
                  Tick runtime
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "pause")}>
                  Pause
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "resume")}>
                  Resume
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "stop")}>
                  Stop
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "retry_stage")}>
                  Retry stage
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "replan")}>
                  Replan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void runAction(selected.id, "rebuild_context")}
                >
                  Rebuild context
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void runAction(selected.id, "adapt")}>
                  Simulate signals
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void runAction(selected.id, "emergency_stop")}
                >
                  Emergency stop
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h ${minutes % 60}m`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return "—"
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
