"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Clock, FastForward, GitBranch, Loader2, Play, RefreshCw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { PatternEnrollmentDetailView } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  formatEnrollmentStepStatusLabel,
  formatExecutionJobStatusLabel,
} from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthLeadsCrmHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import type { GrowthQaAccelerationSchedulerRunResult } from "@/lib/growth/sequence-enrollment/qa-acceleration-types"
import { GROWTH_QA_DELIVERABILITY_BYPASS_BANNER } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
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
  const router = useRouter()
  const [detail, setDetail] = useState<PatternEnrollmentDetailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [qaActionLoading, setQaActionLoading] = useState<string | null>(null)
  const [qaSchedulerResult, setQaSchedulerResult] = useState<GrowthQaAccelerationSchedulerRunResult | null>(null)
  const [legacySchedulerResult, setLegacySchedulerResult] = useState<GrowthSequenceSchedulerRunResult | null>(null)
  const [schedulerReasons, setSchedulerReasons] = useState<string[]>([])
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

  async function runQaScheduler() {
    setQaActionLoading("run-scheduler")
    setError(null)
    setSchedulerReasons([])
    try {
      const res = await fetch(
        `/api/platform/growth/sequences/enrollments/${enrollmentId}/qa/run-scheduler`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthQaAccelerationSchedulerRunResult
        reasons?: string[]
        message?: string
      }
      if (!res.ok || !data.ok || !data.result) throw new Error(data.message ?? "Scheduler run failed.")
      setQaSchedulerResult(data.result)
      setSchedulerReasons(data.reasons ?? [])
      await load()
      if (data.result.executionHref) {
        router.push(data.result.executionHref)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduler run failed.")
    } finally {
      setQaActionLoading(null)
    }
  }

  async function runQaAction(action: "schedule-step-now" | "force-due-now") {
    setQaActionLoading(action)
    setError(null)
    try {
      const path =
        action === "schedule-step-now"
          ? `/api/platform/growth/sequences/enrollments/${enrollmentId}/qa/schedule-step-now`
          : `/api/platform/growth/sequences/enrollments/${enrollmentId}/qa/force-due-now`
      const res = await fetch(path, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "QA action failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "QA action failed.")
    } finally {
      setQaActionLoading(null)
    }
  }

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
      setLegacySchedulerResult(data.result)
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
            {!detail.qaAccelerationEnabled ? (
              <Button size="sm" onClick={() => void runScheduler()} disabled={schedulerLoading}>
                {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                Run Scheduler Now
              </Button>
            ) : null}
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

        {legacySchedulerResult && !detail.qaAccelerationEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Scheduler run · queued {legacySchedulerResult.queued}
            {legacySchedulerResult.executionJobsPlanned != null
              ? ` · execution jobs planned ${legacySchedulerResult.executionJobsPlanned}`
              : ""}
          </p>
        ) : null}
      </GrowthEngineCard>

      {detail.qaAccelerationEnabled ? (
        <GrowthEngineCard title="QA Tools" icon={<Zap className="size-4" />}>
          <div
            className={cn(
              "mb-4 rounded-lg border px-4 py-3 text-sm",
              detail.transportReadiness.ready
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                : "border-amber-200 bg-amber-50/80 text-amber-950",
            )}
          >
            {detail.transportReadiness.ready ? (
              <p className="font-medium">Transport Ready ✓</p>
            ) : (
              <>
                <p className="font-medium">Transport Blocked</p>
                <p className="mt-1">{detail.transportReadiness.message}</p>
              </>
            )}
          </div>
          {detail.qaDeliverabilityBypass?.active ? (
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
              <p className="font-medium">{GROWTH_QA_DELIVERABILITY_BYPASS_BANNER}</p>
            </div>
          ) : null}
          <p className="mb-4 text-sm text-muted-foreground">
            Operator-only controls to accelerate scheduling for dogfooding. Does not auto-approve, auto-send, or bypass
            suppression.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runQaAction("schedule-step-now")}
              disabled={qaActionLoading !== null || detail.enrollment.status !== "active"}
            >
              {qaActionLoading === "schedule-step-now" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Clock className="mr-2 size-4" />
              )}
              Schedule Step Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runQaAction("force-due-now")}
              disabled={qaActionLoading !== null || detail.enrollment.status !== "active"}
            >
              {qaActionLoading === "force-due-now" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FastForward className="mr-2 size-4" />
              )}
              Make Step Due Now
            </Button>
            <Button
              size="sm"
              onClick={() => void runQaScheduler()}
              disabled={qaActionLoading !== null || !detail.transportReadiness.ready}
            >
              {qaActionLoading === "run-scheduler" ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              Run Scheduler Now
            </Button>
          </div>
          {qaSchedulerResult ? (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {qaSchedulerResult.jobCreated ? (
                <p>
                  Execution job created
                  {qaSchedulerResult.createdJobId ? ` · ${qaSchedulerResult.createdJobId.slice(0, 8)}` : ""}.
                  {qaSchedulerResult.executionHref ? " Opening Execution Console…" : ""}
                </p>
              ) : (
                <>
                  <p className="font-medium text-foreground">No execution job created</p>
                  {(schedulerReasons.length > 0
                    ? schedulerReasons
                    : qaSchedulerResult.blockReasonLabel
                      ? [qaSchedulerResult.blockReasonLabel]
                      : ["Scheduler completed without creating an execution job."]
                  ).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </>
              )}
            </div>
          ) : null}
        </GrowthEngineCard>
      ) : null}

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

      <GrowthEngineCard title="Enrollment History">
        {detail.historyEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrollment timeline events yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.historyEvents.map((event) => (
              <li key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{event.title}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(event.occurredAt)}</span>
                </div>
                {event.summary ? <p className="mt-1 text-muted-foreground">{event.summary}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.eventType.replace(/_/g, " ")}
                  {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                </p>
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
