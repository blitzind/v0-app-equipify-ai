"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, GitBranch, Loader2, TriangleAlert } from "lucide-react"
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
  buildBulkEnrollmentSchedulerExecutionHref,
  classifyBulkEnrollmentResult,
  explainSchedulerNoJobsPlanned,
  formatBulkEnrollmentOutcomeDetail,
  formatBulkEnrollmentOutcomeLeadLabel,
  pickBulkEnrollmentPrimaryEnrollmentId,
  pickBulkEnrollmentPrimaryLeadId,
  resolveBulkEnrollmentViewId,
} from "@/lib/growth/sequence-enrollment/bulk-enrollment-result-ui"
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
  /** Fires when the user leaves the post-enrollment success view (close, back, or navigation). */
  onDismissAfterSuccess?: () => void
}

function resultBannerClass(variant: "success" | "warning" | "failure"): string {
  if (variant === "success") return "border-emerald-200 bg-emerald-50/80 text-emerald-950"
  if (variant === "warning") return "border-amber-200 bg-amber-50/80 text-amber-950"
  return "border-destructive/30 bg-destructive/5 text-destructive"
}

export function GrowthBulkSequenceEnrollmentDialog({
  open,
  onOpenChange,
  leadIds,
  onDismissAfterSuccess,
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
  const [schedulerNoJobsExplanation, setSchedulerNoJobsExplanation] = useState<string[] | null>(null)
  const [enrollmentDetail, setEnrollmentDetail] = useState<PatternEnrollmentDetailView | null>(null)
  const [enrollmentActionKey, setEnrollmentActionKey] = useState<string | null>(null)

  const uniqueLeadIds = useMemo(() => [...new Set(leadIds)], [leadIds])
  const overLimit = uniqueLeadIds.length > GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS
  const selectedPattern = patterns.find((entry) => entry.id === patternId)
  const showResult = Boolean(result && !result.dryRun)
  const resultUi = result && !result.dryRun ? classifyBulkEnrollmentResult(result) : null
  const primaryEnrollmentId = result ? pickBulkEnrollmentPrimaryEnrollmentId(result) : null
  const primaryLeadId = result ? pickBulkEnrollmentPrimaryLeadId(result, uniqueLeadIds) : null

  const notifySuccessDismissal = useCallback(() => {
    if (result && !result.dryRun) onDismissAfterSuccess?.()
  }, [onDismissAfterSuccess, result])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && result && !result.dryRun) onDismissAfterSuccess?.()
      onOpenChange(nextOpen)
    },
    [onDismissAfterSuccess, onOpenChange, result],
  )

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
    if (res.ok && data.ok && data.detail) {
      setEnrollmentDetail(data.detail)
      return data.detail
    }
    return null
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setResult(null)
    setSchedulerNoJobsExplanation(null)
    setEnrollmentDetail(null)
    void loadPatterns()
  }, [open, loadPatterns])

  useEffect(() => {
    if (!primaryEnrollmentId || !showResult) return
    void loadEnrollmentDetail(primaryEnrollmentId)
  }, [primaryEnrollmentId, showResult, loadEnrollmentDetail])

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk enrollment failed.")
    } finally {
      setSubmitting(false)
      setPreviewing(false)
    }
  }

  async function rerunEnrollment() {
    await submit(false)
  }

  async function resumeEnrollment(entry: BulkSequenceEnrollmentLeadOutcome) {
    const enrollmentId = resolveBulkEnrollmentViewId(entry)
    if (!enrollmentId) return
    setEnrollmentActionKey(`${entry.leadId}:resume`)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${entry.leadId}/sequence-enrollments/${enrollmentId}/resume`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not resume enrollment.")
      await rerunEnrollment()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume enrollment.")
    } finally {
      setEnrollmentActionKey(null)
    }
  }

  async function cancelDraftEnrollment(entry: BulkSequenceEnrollmentLeadOutcome) {
    const enrollmentId = resolveBulkEnrollmentViewId(entry)
    if (!enrollmentId) return
    setEnrollmentActionKey(`${entry.leadId}:cancel`)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${entry.leadId}/sequence-enrollments/${enrollmentId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled from bulk enrollment dialog to retry." }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not cancel draft enrollment.")
      await rerunEnrollment()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel draft enrollment.")
    } finally {
      setEnrollmentActionKey(null)
    }
  }

  async function runScheduler() {
    if (!resultUi?.showSchedulerCta || !result) return
    setSchedulerLoading(true)
    setError(null)
    setSchedulerNoJobsExplanation(null)
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

      let detail = enrollmentDetail
      if (primaryEnrollmentId) {
        detail = (await loadEnrollmentDetail(primaryEnrollmentId)) ?? detail
      }

      const executionHref = buildBulkEnrollmentSchedulerExecutionHref({
        schedulerResult: data.result,
        enrollmentDetail: detail,
        enrollmentId: primaryEnrollmentId,
        leadId: primaryLeadId,
        sequencePatternId: result.sequencePatternId,
      })

      if (executionHref) {
        notifySuccessDismissal()
        router.push(executionHref)
        return
      }

      setSchedulerNoJobsExplanation(
        explainSchedulerNoJobsPlanned({
          schedulerResult: data.result,
          enrollmentDetail: detail,
          bulkResult: result,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduler run failed.")
    } finally {
      setSchedulerLoading(false)
    }
  }

  function renderEnrollmentActions(entry: BulkSequenceEnrollmentLeadOutcome) {
    const viewEnrollmentId = resolveBulkEnrollmentViewId(entry)
    const actionKeyPrefix = entry.leadId

    return (
      <div className="flex flex-wrap items-center gap-2">
        {viewEnrollmentId ? (
          <Button size="sm" variant="link" className="h-auto px-0" asChild>
            <Link href={growthPatternEnrollmentDetailHref(viewEnrollmentId)} onClick={notifySuccessDismissal}>
              View enrollment
            </Link>
          </Button>
        ) : null}
        {entry.suggestedAction === "resume_enrollment" && viewEnrollmentId ? (
          <Button
            size="sm"
            variant="outline"
            disabled={enrollmentActionKey !== null}
            onClick={() => void resumeEnrollment(entry)}
          >
            {enrollmentActionKey === `${actionKeyPrefix}:resume` ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Resume enrollment
          </Button>
        ) : null}
        {entry.suggestedAction === "cancel_draft" && viewEnrollmentId ? (
          <Button
            size="sm"
            variant="outline"
            disabled={enrollmentActionKey !== null}
            onClick={() => void cancelDraftEnrollment(entry)}
          >
            {enrollmentActionKey === `${actionKeyPrefix}:cancel` ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Cancel draft
          </Button>
        ) : null}
      </div>
    )
  }

  function renderOutcomeRow(entry: BulkSequenceEnrollmentLeadOutcome, label: string) {
    return (
      <li key={`${label}-${entry.leadId}`} className="rounded-md border border-border/70 px-2 py-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{formatBulkEnrollmentOutcomeLeadLabel(entry)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatBulkEnrollmentOutcomeDetail(entry)}</p>
            {entry.enrollmentStatus ? (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {entry.enrollmentStatus.replace(/_/g, " ")}
                {entry.schedulerEligible ? " · scheduler ready" : ""}
              </p>
            ) : null}
          </div>
          {renderEnrollmentActions(entry)}
        </div>
      </li>
    )
  }

  function renderContinuableBlockedRow(entry: BulkSequenceEnrollmentLeadOutcome) {
    return (
      <li key={entry.leadId} className="rounded-md border border-border/70 px-2 py-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{formatBulkEnrollmentOutcomeLeadLabel(entry)}</p>
            <p className="text-xs text-muted-foreground">{formatBulkEnrollmentOutcomeDetail(entry)}</p>
            {entry.code ? <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.code}</p> : null}
          </div>
          {renderEnrollmentActions(entry)}
        </div>
      </li>
    )
  }

  function renderIssueRow(entry: BulkSequenceEnrollmentLeadOutcome) {
    return (
      <li key={entry.leadId} className="rounded-md border border-border/70 px-2 py-1.5">
        <p className="font-medium">{formatBulkEnrollmentOutcomeLeadLabel(entry)}</p>
        <p className="text-xs text-muted-foreground">{formatBulkEnrollmentOutcomeDetail(entry)}</p>
        {entry.code ? <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.code}</p> : null}
      </li>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            {resultUi ? resultUi.title : "Bulk enroll in sequence"}
          </DialogTitle>
          <DialogDescription>
            {resultUi
              ? resultUi.description
              : `Enroll ${uniqueLeadIds.length} lead(s) into a Growth sequence pattern. Human approval is still required before send.`}
          </DialogDescription>
        </DialogHeader>

        {showResult && result && resultUi ? (
          <div className="space-y-4">
            <div className={`rounded-lg border px-4 py-3 text-sm ${resultBannerClass(resultUi.variant)}`}>
              <div className="flex items-start gap-2">
                {resultUi.variant === "success" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <p className="font-medium">
                    {resultUi.variant === "failure"
                      ? `No leads enrolled in ${selectedPattern?.label ?? "sequence pattern"}`
                      : `Enrollment processed for ${selectedPattern?.label ?? "sequence pattern"}`}
                  </p>
                  {resultUi.variant === "success" ? (
                    <p className="mt-1 opacity-90">
                      Pattern enrollments live in the outbound execution plane — not the legacy template table on the
                      foundation dashboard.
                    </p>
                  ) : null}
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

            {result.skippedBlocked.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Blocked</p>
                <ul className="space-y-1 text-sm">
                  {result.skippedBlocked.map((entry) =>
                    resolveBulkEnrollmentViewId(entry) ? renderContinuableBlockedRow(entry) : renderIssueRow(entry),
                  )}
                </ul>
              </div>
            ) : null}

            {result.failed.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Failed to enroll</p>
                <ul className="space-y-1 text-sm">{result.failed.map((entry) => renderIssueRow(entry))}</ul>
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
                          onClick={notifySuccessDismissal}
                        >
                          Step {job.stepOrder ?? "—"} · pending approval
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {schedulerNoJobsExplanation && schedulerNoJobsExplanation.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                <p className="font-medium">No execution jobs planned</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {schedulerNoJobsExplanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {resultUi.showViewEnrollment && primaryEnrollmentId ? (
                <Button asChild>
                  <Link href={growthPatternEnrollmentDetailHref(primaryEnrollmentId)} onClick={notifySuccessDismissal}>
                    View Enrollment
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              ) : null}
              {resultUi.showSchedulerCta ? (
                <Button variant="outline" onClick={() => void runScheduler()} disabled={schedulerLoading}>
                  {schedulerLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Run Scheduler Now
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  handleOpenChange(false)
                  router.push(growthLeadsCrmHref())
                }}
              >
                Back to Leads
              </Button>
              {resultUi.showViewEnrollment && primaryEnrollmentId ? (
                <Button variant="secondary" asChild>
                  <Link
                    href={growthSequenceExecutionHref({
                      enrollmentId: primaryEnrollmentId,
                      leadId: primaryLeadId ?? undefined,
                      sequencePatternId: result.sequencePatternId,
                    })}
                    onClick={notifySuccessDismissal}
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

        {!showResult ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
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
