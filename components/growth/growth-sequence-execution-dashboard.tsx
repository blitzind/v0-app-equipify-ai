"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthSequenceDriftSignal,
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment-types"
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/execution/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: DashboardPayload; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Load failed.")
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

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
