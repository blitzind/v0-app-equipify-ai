"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, GitBranch, Loader2, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { PatternEnrollmentDetailView } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  formatEnrollmentStepStatusLabel,
  formatExecutionJobStatusLabel,
} from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthLeadsCrmHref,
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import type { GrowthSequenceSchedulerRunResult } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { cn } from "@/lib/utils"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "medium" | "blocked"> = {
  draft: "neutral",
  active: "healthy",
  paused: "attention",
  completed: "medium",
  cancelled: "blocked",
  pending: "neutral",
  draft_created: "attention",
  queued: "medium",
  pending_approval: "attention",
  approved: "healthy",
  sent: "healthy",
  failed: "critical",
}

export function GrowthPatternEnrollmentDetail({ enrollmentId }: { enrollmentId: string }) {
  const [detail, setDetail] = useState<PatternEnrollmentDetailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [schedulerResult, setSchedulerResult] = useState<GrowthSequenceSchedulerRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/sequences/enrollments/${enrollmentId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: PatternEnrollmentDetailView
        message?: string
      }
      if (!res.ok || !data.ok || !data.detail) throw new Error(data.message ?? "Could not load enrollment.")
      setDetail(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load enrollment.")
    } finally {
      setLoading(false)
    }
  }, [enrollmentId])

  useEffect(() => {
    void load()
  }, [load])

  async function runScheduler() {
    setSchedulerLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, limit: 25 }),
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

  if (loading && !detail) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading enrollment…
      </div>
    )
  }

  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Enrollment Overview" icon={<GitBranch className="size-4" />}>
        <div className="mb-4 flex flex-wrap gap-2">
          <GrowthBadge label={detail.qaMarker} tone="neutral" />
          <GrowthBadge label={detail.enrollment.status} tone={STATUS_TONE[detail.enrollment.status] ?? "neutral"} />
          {detail.pendingApprovalJobCount > 0 ? (
            <GrowthBadge label={`${detail.pendingApprovalJobCount} pending approval`} tone="attention" />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Lead" value={detail.leadLabel} />
          <StatTile label="Pattern" value={detail.patternLabel} />
          <StatTile label="Health" value={detail.enrollment.enrollmentHealthScore} />
          <StatTile label="Sent jobs" value={detail.sentJobCount} />
        </div>

        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">{detail.workflow.nextActionLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void runScheduler()} disabled={schedulerLoading}>
              {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              Run Scheduler Now
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={growthSequenceExecutionHref({ enrollmentId: detail.enrollment.id, leadId: detail.leadId })}>
                Open Execution Console
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/admin/growth/leads/${detail.leadId}`}>View Lead</Link>
            </Button>
          </div>
        </div>

        {schedulerResult ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Scheduler run · queued {schedulerResult.queued}
            {schedulerResult.executionJobsPlanned != null
              ? ` · execution jobs planned ${schedulerResult.executionJobsPlanned}`
              : ""}
          </p>
        ) : null}
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Current Step">
          {detail.currentStep ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Step</dt>
                <dd>{detail.currentStep.stepOrder}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{formatEnrollmentStepStatusLabel(detail.currentStep.status)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Scheduled for</dt>
                <dd>{formatWhen(detail.currentStep.scheduledFor)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{detail.currentStep.channel}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No in-progress step.</p>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Next Step">
          {detail.nextStep ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Step</dt>
                <dd>{detail.nextStep.stepOrder}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Scheduled for</dt>
                <dd>{formatWhen(detail.nextStep.scheduledFor)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming step.</p>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Step History">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Step</th>
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {detail.enrollment.steps.map((step) => (
                <tr key={step.id} className="border-b border-border/70">
                  <td className="px-2 py-2">{step.stepOrder}</td>
                  <td className="px-2 py-2">{step.channel}</td>
                  <td className="px-2 py-2">
                    <GrowthBadge
                      label={formatEnrollmentStepStatusLabel(step.status)}
                      tone={STATUS_TONE[step.status] ?? "neutral"}
                    />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{formatWhen(step.scheduledFor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Execution Jobs">
        {detail.executionJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No execution jobs yet. When the step is due, run the scheduler to create a pending approval job.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.executionJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={formatExecutionJobStatusLabel(job.status)} tone={STATUS_TONE[job.status] ?? "neutral"} />
                  <span>Step {job.stepOrder ?? "—"}</span>
                  <span className="text-muted-foreground">{formatWhen(job.scheduledFor)}</span>
                  <span className="text-muted-foreground">{job.approvalLabel}</span>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={growthSequenceExecutionHref({
                      enrollmentId: detail.enrollment.id,
                      leadId: detail.leadId,
                      highlightJobId: job.id,
                    })}
                  >
                    Review Job
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      {detail.schedulerStatus ? (
        <GrowthEngineCard title="Scheduler Health">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Due steps (global)</dt>
              <dd className="font-medium">{detail.schedulerStatus.dueStepsCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Planning cron</dt>
              <dd className="font-medium">{detail.schedulerStatus.planningCronRoute ?? "growth-sequence-scheduler"}</dd>
            </div>
          </dl>
        </GrowthEngineCard>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 size-4", loading && "animate-spin")} />
          Refresh
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={growthLeadsCrmHref()}>Back to Leads</Link>
        </Button>
      </div>
    </div>
  )
}
