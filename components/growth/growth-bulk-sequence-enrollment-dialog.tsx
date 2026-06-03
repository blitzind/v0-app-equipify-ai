"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  BulkSequenceEnrollmentLeadOutcome,
  BulkSequenceEnrollmentResult,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import { GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import {
  growthLeadsCrmHref,
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import type { GrowthSequenceSchedulerRunResult } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import type { PatternEnrollmentDetailView } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

type GrowthBulkSequenceEnrollmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadIds: string[]
  onCompleted?: (result: BulkSequenceEnrollmentResult) => void
}

function pickPrimaryEnrollmentId(result: BulkSequenceEnrollmentResult): string | null {
  return (
    result.enrolled.find((entry) => entry.enrollmentId)?.enrollmentId ??
    result.skippedAlreadyEnrolled.find((entry) => entry.enrollmentId)?.enrollmentId ??
    null
  )
}

function pickPrimaryLeadId(result: BulkSequenceEnrollmentResult, fallbackLeadIds: string[]): string | null {
  return (
    result.enrolled[0]?.leadId ??
    result.skippedAlreadyEnrolled[0]?.leadId ??
    fallbackLeadIds[0] ??
    null
  )
}

export function GrowthBulkSequenceEnrollmentDialog({
  open,
  onOpenChange,
  leadIds,
  onCompleted,
}: GrowthBulkSequenceEnrollmentDialogProps) {
  const router = useRouter()
  const [patterns, setPatterns] = useState<GrowthSequencePattern[]>([])
  const [patternId, setPatternId] = useState("")
  const [startImmediately, setStartImmediately] = useState(true)
  const [scheduledStartAt, setScheduledStartAt] = useState("")
  const [loadingPatterns, setLoadingPatterns] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkSequenceEnrollmentResult | null>(null)
  const [schedulerResult, setSchedulerResult] = useState<GrowthSequenceSchedulerRunResult | null>(null)
  const [enrollmentDetail, setEnrollmentDetail] = useState<PatternEnrollmentDetailView | null>(null)

  const uniqueLeadIds = useMemo(() => [...new Set(leadIds)], [leadIds])
  const overLimit = uniqueLeadIds.length > GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS
  const selectedPattern = patterns.find((entry) => entry.id === patternId)
  const showSuccess = Boolean(result && !result.dryRun)
  const primaryEnrollmentId = result ? pickPrimaryEnrollmentId(result) : null
  const primaryLeadId = result ? pickPrimaryLeadId(result, uniqueLeadIds) : null

  const loadPatterns = useCallback(async () => {
    setLoadingPatterns(true)
    try {
      const res = await fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { patterns?: GrowthSequencePattern[] }
      const next = data.patterns ?? []
      setPatterns(next)
      setPatternId((current) => current || next[0]?.id || "")
    } catch {
      setPatterns([])
    } finally {
      setLoadingPatterns(false)
    }
  }, [])

  const loadEnrollmentDetail = useCallback(async (enrollmentId: string) => {
    const res = await fetch(`/api/platform/growth/sequences/enrollments/${enrollmentId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: PatternEnrollmentDetailView }
    if (res.ok && data.ok && data.detail) setEnrollmentDetail(data.detail)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setResult(null)
    setSchedulerResult(null)
    setEnrollmentDetail(null)
    void loadPatterns()
  }, [open, loadPatterns])

  useEffect(() => {
    if (!primaryEnrollmentId || !showSuccess) return
    void loadEnrollmentDetail(primaryEnrollmentId)
  }, [primaryEnrollmentId, showSuccess, loadEnrollmentDetail])

  async function submit(dryRun: boolean) {
    if (!patternId || uniqueLeadIds.length === 0 || overLimit) return
    if (dryRun) setPreviewing(true)
    else setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/enroll/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: uniqueLeadIds,
          sequencePatternId: patternId,
          startImmediately,
          scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
          dryRun,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        result?: BulkSequenceEnrollmentResult
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? "Bulk enrollment failed.")
      }
      setResult(data.result)
      if (!dryRun) onCompleted?.(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk enrollment failed.")
    } finally {
      setSubmitting(false)
      setPreviewing(false)
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
      setSchedulerResult(data.result)
      if (primaryEnrollmentId) await loadEnrollmentDetail(primaryEnrollmentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduler run failed.")
    } finally {
      setSchedulerLoading(false)
    }
  }

  function renderOutcomeRow(entry: BulkSequenceEnrollmentLeadOutcome, label: string) {
    return (
      <li key={`${label}-${entry.leadId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-2 py-1.5">
        <span className="text-muted-foreground">{label}</span>
        {entry.enrollmentId ? (
          <Button size="sm" variant="link" className="h-auto px-0" asChild>
            <Link href={growthPatternEnrollmentDetailHref(entry.enrollmentId)}>View enrollment</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{entry.reason ?? entry.code}</span>
        )}
      </li>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            {showSuccess ? "Enrollment complete" : "Bulk enroll in sequence"}
          </DialogTitle>
          <DialogDescription>
            {showSuccess
              ? "Pattern enrollment succeeded. Review results below and continue in the enrollment detail or execution console."
              : `Enroll ${uniqueLeadIds.length} lead(s) into a Growth sequence pattern. Human approval is still required before send.`}
          </DialogDescription>
        </DialogHeader>

        {showSuccess && result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Enrollment processed for {selectedPattern?.label ?? "sequence pattern"}</p>
                  <p className="mt-1 text-emerald-900/90">
                    Pattern enrollments live in the outbound execution plane — not the legacy template table on the
                    foundation dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Enrolled</p>
                <p className="text-lg font-semibold">{result.enrolled.length}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Already enrolled</p>
                <p className="text-lg font-semibold">{result.skippedAlreadyEnrolled.length}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Blocked</p>
                <p className="text-lg font-semibold">{result.skippedBlocked.length}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Failed</p>
                <p className="text-lg font-semibold">{result.failed.length}</p>
              </div>
            </div>

            {result.skippedAlreadyEnrolled.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Already enrolled in this sequence</p>
                <ul className="space-y-1 text-sm">
                  {result.skippedAlreadyEnrolled.map((entry) =>
                    renderOutcomeRow(entry, "Lead already enrolled — safe to continue."),
                  )}
                </ul>
              </div>
            ) : null}

            {enrollmentDetail?.executionJobs.some((job) => ["draft", "pending_approval"].includes(job.status)) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm">
                <p className="font-medium">Jobs ready for approval</p>
                <ul className="mt-2 space-y-1">
                  {enrollmentDetail.executionJobs
                    .filter((job) => ["draft", "pending_approval"].includes(job.status))
                    .map((job) => (
                      <li key={job.id}>
                        <Link
                          href={growthSequenceExecutionHref({
                            enrollmentId: enrollmentDetail.enrollment.id,
                            leadId: enrollmentDetail.leadId,
                            highlightJobId: job.id,
                          })}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          Step {job.stepOrder ?? "—"} · pending approval
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {schedulerResult ? (
              <p className="text-xs text-muted-foreground">
                Scheduler queued {schedulerResult.queued} step(s)
                {schedulerResult.executionJobsPlanned != null
                  ? ` · ${schedulerResult.executionJobsPlanned} execution job(s) planned`
                  : ""}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {primaryEnrollmentId ? (
                <Button asChild>
                  <Link href={growthPatternEnrollmentDetailHref(primaryEnrollmentId)}>
                    View Enrollment
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void runScheduler()} disabled={schedulerLoading}>
                {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Run Scheduler Now
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false)
                  router.push(growthLeadsCrmHref())
                }}
              >
                Back to Leads
              </Button>
              {primaryEnrollmentId ? (
                <Button variant="secondary" asChild>
                  <Link
                    href={growthSequenceExecutionHref({
                      enrollmentId: primaryEnrollmentId,
                      leadId: primaryLeadId ?? undefined,
                      sequencePatternId: result.sequencePatternId,
                    })}
                  >
                    Open Execution Console
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={`${uniqueLeadIds.length} selected`} tone="medium" />
              {overLimit ? (
                <GrowthBadge label={`Max ${GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS} per batch`} tone="critical" />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-sequence-pattern">Sequence pattern</Label>
              <Select value={patternId} onValueChange={setPatternId} disabled={loadingPatterns}>
                <SelectTrigger id="bulk-sequence-pattern">
                  <SelectValue placeholder={loadingPatterns ? "Loading patterns…" : "Choose sequence"} />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map((pattern) => (
                    <SelectItem key={pattern.id} value={pattern.id}>
                      {pattern.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPattern ? (
                <p className="text-xs text-muted-foreground">
                  {selectedPattern.steps.length} steps · {selectedPattern.key}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Start immediately</p>
                <p className="text-xs text-muted-foreground">Activate enrollments so the scheduler can plan due steps.</p>
              </div>
              <Switch checked={startImmediately} onCheckedChange={setStartImmediately} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-sequence-start-at">Scheduled start (optional)</Label>
              <Input
                id="bulk-sequence-start-at"
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(event) => setScheduledStartAt(event.target.value)}
              />
            </div>

            {result?.dryRun ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">Preview</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>Would enroll: {result.enrolled.length}</li>
                  <li>Already enrolled: {result.skippedAlreadyEnrolled.length}</li>
                  <li>Blocked: {result.skippedBlocked.length}</li>
                  <li>Failed: {result.failed.length}</li>
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!showSuccess ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={previewing || submitting || overLimit || !patternId}
                onClick={() => void submit(true)}
              >
                {previewing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Preview
              </Button>
              <Button
                type="button"
                disabled={previewing || submitting || overLimit || !patternId}
                onClick={() => void submit(false)}
              >
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Enroll {uniqueLeadIds.length} leads
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
