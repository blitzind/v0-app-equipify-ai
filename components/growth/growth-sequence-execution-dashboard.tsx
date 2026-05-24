"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2, Play, RefreshCw, TestTube2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthSequenceDriftSignal,
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment-types"
import type {
  GrowthSequenceSchedulerRunResult,
  GrowthSequenceSchedulerStatus,
} from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { GROWTH_SEQUENCE_SCHEDULER_QA_MARKER } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { cn } from "@/lib/utils"

type DashboardPayload = {
  averageHealth: number
  activeEnrollments: Array<GrowthSequenceEnrollment & { companyName: string }>
  pausedEnrollments: Array<GrowthSequenceEnrollment & { companyName: string }>
  executionStalled: Array<GrowthSequenceEnrollment & { companyName: string }>
  awaitingApproval: Array<GrowthSequenceEnrollmentStep & { companyName: string }>
  failedSteps: Array<GrowthSequenceEnrollmentStep & { companyName: string }>
  completedRecently: Array<GrowthSequenceEnrollment & { companyName: string }>
  sequenceDriftWatch: GrowthSequenceDriftSignal[]
  sequenceExecutionHealth: {
    activeCount: number
    stalledCount: number
    awaitingApprovalCount: number
    failedCount: number
    driftCount: number
  }
}

function EnrollmentList({
  title,
  rows,
  highlightEnrollmentId,
}: {
  title: string
  rows: Array<GrowthSequenceEnrollment & { companyName: string }>
  highlightEnrollmentId?: string | null
}) {
  return (
    <GrowthEngineCard title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              id={`sequence-enrollment-${row.id}`}
              className={cn(
                "rounded-lg border border-border px-3 py-2 text-sm",
                highlightEnrollmentId === row.id ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-200" : "",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{row.companyName}</p>
                <span className="tabular-nums font-semibold">{row.enrollmentHealthScore}</span>
              </div>
              <p className="text-muted-foreground">
                {row.status} · step {row.currentStepOrder}
                {row.enrollmentStalled ? " · stalled" : ""}
                {row.pauseReason ? ` · ${row.pauseReason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthSequenceExecutionDashboard({
  highlightEnrollmentId,
}: {
  highlightEnrollmentId?: string | null
}) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [schedulerStatus, setSchedulerStatus] = useState<GrowthSequenceSchedulerStatus | null>(null)
  const [schedulerResult, setSchedulerResult] = useState<GrowthSequenceSchedulerRunResult | null>(null)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSchedulerStatus = useCallback(async () => {
    const res = await fetch("/api/platform/growth/sequences/scheduler/run", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: GrowthSequenceSchedulerStatus }
    if (res.ok && data.status) setSchedulerStatus(data.status)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes] = await Promise.all([
        fetch("/api/platform/growth/sequences/execution/dashboard", { cache: "no-store" }),
        loadSchedulerStatus(),
      ])
      const data = (await dashboardRes.json().catch(() => ({}))) as { ok?: boolean; dashboard?: DashboardPayload; message?: string }
      if (!dashboardRes.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Load failed.")
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [loadSchedulerStatus])

  async function runScheduler(dryRun: boolean) {
    setSchedulerLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 25 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthSequenceSchedulerRunResult
        message?: string
      }
      if (!res.ok || !data.ok || !data.result) throw new Error(data.message ?? "Scheduler run failed.")
      setSchedulerResult(data.result)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduler run failed.")
    } finally {
      setSchedulerLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!highlightEnrollmentId || !dashboard) return
    requestAnimationFrame(() => {
      document
        .getElementById(`sequence-enrollment-${highlightEnrollmentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [highlightEnrollmentId, dashboard])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sequence execution…
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Sequence Scheduler" icon={<GitBranch className="size-4" />}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_SEQUENCE_SCHEDULER_QA_MARKER} tone="neutral" />
          {schedulerStatus?.providerConfigured ? (
            <GrowthBadge label="Provider configured" tone="healthy" />
          ) : (
            <GrowthBadge label="No live email provider" tone="attention" />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Due steps" value={schedulerStatus?.dueStepsCount ?? 0} />
          <StatTile label="Last queued" value={schedulerStatus?.lastRun?.queued ?? 0} />
          <StatTile label="Last skipped" value={
            (schedulerStatus?.lastRun?.skippedSuppressed ?? 0) +
            (schedulerStatus?.lastRun?.skippedAlreadyQueued ?? 0) +
            (schedulerStatus?.lastRun?.skippedMissingDraft ?? 0)
          } />
          <StatTile label="Last failed" value={schedulerStatus?.lastRun?.failed ?? 0} />
        </div>

        {schedulerStatus?.lastRun ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last run {new Date(schedulerStatus.lastRun.startedAt).toLocaleString()} · scanned{" "}
            {schedulerStatus.lastRun.scanned} · due {schedulerStatus.lastRun.due}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No scheduler runs yet.</p>
        )}

        {schedulerResult ? (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            {schedulerResult.dryRun ? "Dry run" : "Live run"} · scanned {schedulerResult.scanned} · due{" "}
            {schedulerResult.due} · queued {schedulerResult.queued} · suppressed{" "}
            {schedulerResult.skippedSuppressed} · already queued {schedulerResult.skippedAlreadyQueued} · failed{" "}
            {schedulerResult.failed}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void runScheduler(false)} disabled={schedulerLoading}>
            {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Run Scheduler
          </Button>
          <Button variant="outline" onClick={() => void runScheduler(true)} disabled={schedulerLoading}>
            <TestTube2 className="mr-2 size-4" />
            Dry Run
          </Button>
        </div>
      </GrowthEngineCard>

      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Avg health" value={dashboard.averageHealth} />
          <StatTile label="Active" value={dashboard.sequenceExecutionHealth.activeCount} />
          <StatTile label="Stalled" value={dashboard.sequenceExecutionHealth.stalledCount} />
          <StatTile label="Awaiting approval" value={dashboard.sequenceExecutionHealth.awaitingApprovalCount} />
          <StatTile label="Drift signals" value={dashboard.sequenceExecutionHealth.driftCount} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Execution Stalled">
        {dashboard.executionStalled.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stalled enrollments.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.executionStalled.map((row) => (
              <li
                key={row.id}
                id={`sequence-enrollment-${row.id}`}
                className={cn(
                  "flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm",
                  highlightEnrollmentId === row.id ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-200" : "",
                )}
              >
                <span>{row.companyName}</span>
                <GrowthBadge label={`health ${row.enrollmentHealthScore}`} tone="warning" />
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Sequence Drift Watch">
        {dashboard.sequenceDriftWatch.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drift detected.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.sequenceDriftWatch.map((signal) => (
              <li key={`${signal.enrollmentId}-${signal.driftKind}-${signal.summary}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="font-medium">{signal.companyName}</p>
                <p className="text-muted-foreground">{signal.driftKind.replace(/_/g, " ")} · {signal.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <EnrollmentList title="Active enrollments" rows={dashboard.activeEnrollments} highlightEnrollmentId={highlightEnrollmentId} />
        <EnrollmentList title="Paused enrollments" rows={dashboard.pausedEnrollments} highlightEnrollmentId={highlightEnrollmentId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Steps awaiting approval">
          {dashboard.awaitingApproval.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.awaitingApproval.map((step) => (
                <li key={step.id} className="rounded-lg border border-border px-3 py-2">
                  {step.companyName} · step {step.stepOrder} · {step.status} · confidence {step.stepExecutionConfidence}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
        <GrowthEngineCard title="Failed steps">
          {dashboard.failedSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.failedSteps.map((step) => (
                <li key={step.id} className="rounded-lg border border-border px-3 py-2">
                  {step.companyName} · {step.failureReason ?? "failed"}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <EnrollmentList title="Completed recently" rows={dashboard.completedRecently} highlightEnrollmentId={highlightEnrollmentId} />
    </div>
  )
}
