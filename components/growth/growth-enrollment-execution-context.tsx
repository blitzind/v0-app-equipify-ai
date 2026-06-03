"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, CheckCircle2, GitBranch, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { PatternEnrollmentDetailView } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import { dispatchSequenceExecutionJobFocus } from "@/lib/growth/sequence-enrollment/sequence-execution-job-focus"
import type { GrowthSequenceSchedulerRunResult } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"

type GrowthEnrollmentExecutionContextProps = {
  enrollmentId?: string | null
  leadId?: string | null
  sequencePatternId?: string | null
  onSchedulerComplete?: (result: GrowthSequenceSchedulerRunResult) => void
}

export function GrowthEnrollmentExecutionContext({
  enrollmentId,
  leadId,
  sequencePatternId,
  onSchedulerComplete,
}: GrowthEnrollmentExecutionContextProps) {
  const [detail, setDetail] = useState<PatternEnrollmentDetailView | null>(null)
  const [loading, setLoading] = useState(false)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [schedulerResult, setSchedulerResult] = useState<GrowthSequenceSchedulerRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const navigateToExecutionJob = useCallback(
    (jobId: string) => {
      const href = growthSequenceExecutionHref({
        enrollmentId: detail?.enrollment.id ?? enrollmentId ?? undefined,
        leadId: detail?.leadId ?? leadId ?? undefined,
        sequencePatternId: sequencePatternId ?? undefined,
        highlightJobId: jobId,
      })

      if (pathname === "/admin/growth/sequences/execution") {
        router.push(href, { scroll: false })
        dispatchSequenceExecutionJobFocus(jobId)
        return
      }

      router.push(href)
    },
    [detail, enrollmentId, leadId, pathname, router, sequencePatternId],
  )

  const load = useCallback(async () => {
    if (!enrollmentId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/sequences/enrollments/${enrollmentId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: PatternEnrollmentDetailView
        message?: string
      }
      if (!res.ok || !data.ok || !data.detail) throw new Error(data.message ?? "Could not load enrollment context.")
      setDetail(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load enrollment context.")
      setDetail(null)
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
      onSchedulerComplete?.(data.result)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduler run failed.")
    } finally {
      setSchedulerLoading(false)
    }
  }

  if (!enrollmentId && !leadId && !sequencePatternId) return null

  if (loading && enrollmentId && !detail) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading enrollment context…
      </div>
    )
  }

  const pendingJobs = detail?.executionJobs.filter((job) =>
    ["draft", "pending_approval"].includes(job.status),
  )
  const approvedJobs = detail?.executionJobs.filter((job) => job.status === "approved")

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-4 text-sm text-indigo-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <GitBranch className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Pattern enrollment context</p>
            {detail ? (
              <p className="text-indigo-900/90">
                {detail.leadLabel} · {detail.patternLabel} · status{" "}
                <span className="font-medium">{detail.enrollment.status}</span>
              </p>
            ) : enrollmentId ? (
              <p className="text-indigo-900/90">Enrollment {enrollmentId.slice(0, 8)}…</p>
            ) : (
              <p className="text-indigo-900/90">Deep-linked execution view</p>
            )}
            {detail ? <p className="mt-1 text-indigo-900/80">{detail.workflow.nextActionLabel}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {enrollmentId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={growthPatternEnrollmentDetailHref(enrollmentId)}>View Enrollment</Link>
            </Button>
          ) : null}
          <Button size="sm" onClick={() => void runScheduler()} disabled={schedulerLoading}>
            {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Run Scheduler Now
          </Button>
        </div>
      </div>

      {!detail?.hasPlannedJobs && detail?.enrollment.status === "active" ? (
        <div className="rounded-lg border border-indigo-200 bg-white/70 px-3 py-2">
          <p className="font-medium">Enrollment exists — no execution job planned yet.</p>
          <p className="text-indigo-900/80">
            Run the scheduler when the step is due to create a pending approval job.
          </p>
        </div>
      ) : null}

      {pendingJobs && pendingJobs.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-4" />
            Job created · pending approval
          </p>
          {pendingJobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label="Pending approval" tone="attention" />
                <span>Step {job.stepOrder ?? "—"}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigateToExecutionJob(job.id)}>
                Ready for approval
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {approvedJobs && approvedJobs.length > 0 ? (
        <div className="space-y-2">
          <p className="font-medium">Approved · queued for safe-execute cron</p>
          {approvedJobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2">
              <GrowthBadge label="Approved" tone="healthy" />
              <Button size="sm" variant="outline" onClick={() => navigateToExecutionJob(job.id)}>
                View approved job
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {schedulerResult ? (
        <p className="text-xs text-indigo-900/70">
          Scheduler queued {schedulerResult.queued} step(s)
          {schedulerResult.executionJobsPlanned != null
            ? ` · ${schedulerResult.executionJobsPlanned} execution job(s) planned`
            : ""}
        </p>
      ) : null}

      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  )
}
