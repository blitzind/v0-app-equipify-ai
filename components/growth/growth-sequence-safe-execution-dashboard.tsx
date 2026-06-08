"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, RefreshCw, RotateCcw, ShieldCheck, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE,
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  type GrowthSequenceExecutionJobView,
  type GrowthSequenceSafeExecutionDashboard,
  sequenceExecutionStatusLabel,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import { growthLeadDetailHref } from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import {
  GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT,
  GROWTH_SEQUENCE_EXECUTION_JOB_HIGHLIGHT_CLASS,
  scheduleSequenceExecutionJobFocus,
  sequenceExecutionJobRowId,
} from "@/lib/growth/sequence-enrollment/sequence-execution-job-focus"
import { channelTypeLabel, taskStatusLabel, type GrowthSequenceChannelTask } from "@/lib/growth/multichannel/multichannel-types"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  draft: "neutral",
  pending_approval: "attention",
  approved: "medium",
  scheduled: "medium",
  running: "attention",
  sent: "healthy",
  blocked: "blocked",
  failed: "critical",
  skipped: "neutral",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthSequenceSafeExecutionDashboard({
  highlightJobId,
  enrollmentId,
}: {
  highlightJobId?: string | null
  enrollmentId?: string | null
} = {}) {
  const [dashboard, setDashboard] = useState<GrowthSequenceSafeExecutionDashboard | null>(null)
  const [meetingIntentReviews, setMeetingIntentReviews] = useState(0)
  const [sequenceStopCandidates, setSequenceStopCandidates] = useState(0)
  const [channelTasks, setChannelTasks] = useState<GrowthSequenceChannelTask[]>([])
  const [objectionMemoryCount, setObjectionMemoryCount] = useState(0)
  const [topObjections, setTopObjections] = useState<Array<{ objectionLabel: string; evidenceSnippet: string }>>([])
  const [loading, setLoading] = useState(true)
  const [actionJobId, setActionJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/execution/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthSequenceSafeExecutionDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Load failed.")
      setDashboard(data.dashboard)

      const bookingRes = await fetch("/api/platform/growth/booking-intelligence/dashboard", { cache: "no-store" })
      const bookingData = (await bookingRes.json().catch(() => ({}))) as {
        dashboard?: { pendingBookingReviews?: unknown[]; sequenceStopCandidates?: unknown[] }
      }
      if (bookingRes.ok && bookingData.dashboard) {
        setMeetingIntentReviews(bookingData.dashboard.pendingBookingReviews?.length ?? 0)
        setSequenceStopCandidates(bookingData.dashboard.sequenceStopCandidates?.length ?? 0)
      }

      const multichannelRes = await fetch("/api/platform/growth/multichannel/tasks", { cache: "no-store" })
      const multichannelData = (await multichannelRes.json().catch(() => ({}))) as {
        tasks?: GrowthSequenceChannelTask[]
      }
      if (multichannelRes.ok) setChannelTasks(multichannelData.tasks ?? [])

      const memoryRes = await fetch("/api/platform/growth/lead-memory/dashboard", { cache: "no-store" })
      const memoryData = (await memoryRes.json().catch(() => ({}))) as {
        dashboard?: { topObjections?: Array<{ objectionLabel: string; evidenceSnippet: string }> }
      }
      if (memoryRes.ok && memoryData.dashboard) {
        setTopObjections(memoryData.dashboard.topObjections?.slice(0, 5) ?? [])
        setObjectionMemoryCount(memoryData.dashboard.topObjections?.length ?? 0)
      }
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
    if (!highlightJobId) return
    scheduleSequenceExecutionJobFocus(highlightJobId)
  }, [highlightJobId, dashboard])

  useEffect(() => {
    function handleFocus(event: Event) {
      const jobId = (event as CustomEvent<{ jobId?: string }>).detail?.jobId
      if (!jobId) return
      scheduleSequenceExecutionJobFocus(jobId)
    }

    window.addEventListener(GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT, handleFocus)
    return () => window.removeEventListener(GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT, handleFocus)
  }, [])

  async function planJobs() {
    setActionJobId("plan")
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/execution/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Plan failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan failed.")
    } finally {
      setActionJobId(null)
    }
  }

  async function jobAction(jobId: string, action: "approve" | "run" | "skip" | "restore") {
    if (action === "skip") {
      const confirmed = window.confirm(
        "Skip this execution job? The enrollment step will advance. Unsent skipped jobs can be restored later.",
      )
      if (!confirmed) return
    }

    if (action === "restore") {
      const confirmed = window.confirm(
        "Restore this skipped job to pending approval? You will still need to Approve & Queue Send before delivery.",
      )
      if (!confirmed) return
    }

    setActionJobId(jobId)
    setError(null)
    try {
      const body =
        action === "run"
          ? JSON.stringify({ humanApproved: true, humanApprovalConfirmed: true })
          : action === "skip"
            ? JSON.stringify({ reason: "Skipped from execution console." })
            : undefined
      const res = await fetch(`/api/platform/growth/sequences/execution/jobs/${jobId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; result?: { message?: string } }
      if (!res.ok) throw new Error(data.message ?? data.result?.message ?? `${action} failed.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed.`)
    } finally {
      setActionJobId(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading execution jobs…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Execution Jobs" icon={<ShieldCheck className="size-4" />}>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              {dashboard?.soloApprovalEnabled ? (
                <>
                  <p className="font-medium">Standalone solo approval is on.</p>
                  <p className="text-amber-900/90">
                    Use Approve &amp; Queue Send once per email — safe-execute cron delivers after
                    compliance checks.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Autonomous sequence sending is off.</p>
                  <p className="text-amber-900/90">All sends require human approval.</p>
                </>
              )}
              {dashboard?.standalonePlanningAutomated ? (
                <p className="mt-2 text-amber-900/90">
                  Due email steps auto-plan into pending jobs via{" "}
                  <span className="font-medium">{dashboard.planningCronRoute ?? "growth-sequence-scheduler"}</span>{" "}
                  cron (every 10 min). No manual plan API required.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE}</p>
        {enrollmentId ? (
          <p className="mb-4 text-xs text-muted-foreground">
            Enrollment context:{" "}
            <Link href={`/admin/growth/sequences/enrollments/${enrollmentId}`} className="font-medium underline-offset-2 hover:underline">
              view pattern enrollment
            </Link>
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER} tone="neutral" />
          {dashboard?.soloApprovalEnabled ? (
            <GrowthBadge label="Solo approve & queue" tone="healthy" />
          ) : null}
          {dashboard?.outboundMode === "standalone" ? (
            <GrowthBadge label="Standalone transport" tone="medium" />
          ) : null}
          {dashboard?.standalonePlanningAutomated ? (
            <GrowthBadge label="Cron auto-plans jobs" tone="healthy" />
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/builder">Sequence Builder</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/governance">Governance</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/content-library">Content Library</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/personalization">AI Personalization</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/intelligence/relationship-memory">Relationship Memory</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-1 size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void planJobs()} disabled={actionJobId === "plan"}>
            {actionJobId === "plan" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Clock className="mr-1 size-3.5" />}
            {dashboard?.standalonePlanningAutomated ? "Run scheduler now" : "Plan due steps"}
          </Button>
        </div>

        {dashboard?.standalonePlanningAutomated && dashboard.lastSchedulerRun ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Last scheduler run {new Date(dashboard.lastSchedulerRun.startedAt).toLocaleString()} · planned{" "}
            {dashboard.lastSchedulerRun.planning?.executionJobsPlanned ?? dashboard.lastSchedulerRun.queued}{" "}
            execution job(s)
            {(dashboard.lastSchedulerRun.planning?.skippedTransportNotConfigured ?? 0) > 0
              ? ` · ${dashboard.lastSchedulerRun.planning?.skippedTransportNotConfigured} skipped (transport not configured)`
              : ""}
          </p>
        ) : null}

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Due Jobs" value={dashboard?.dueJobs ?? 0} />
          <StatTile label="Pending Approval" value={dashboard?.pendingApproval ?? 0} />
          <StatTile label="Blocked" value={dashboard?.blocked ?? 0} />
          <StatTile label="Sent 24h" value={dashboard?.sent24h ?? 0} />
        </div>

        {dashboard?.voiceDropMetrics ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sequence Voice Drop execution metrics</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Voice Drops Queued" value={dashboard.voiceDropMetrics.voiceDropsQueued} />
              <StatTile label="Voice Drops Delivered" value={dashboard.voiceDropMetrics.voiceDropsDelivered} />
              <StatTile label="Voice Drops Failed" value={dashboard.voiceDropMetrics.voiceDropsFailed} />
            </div>
          </div>
        ) : null}

        {(meetingIntentReviews > 0 || sequenceStopCandidates > 0) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {meetingIntentReviews > 0 ? (
              <GrowthBadge label={`${meetingIntentReviews} meeting intent reviews`} tone="attention" />
            ) : null}
            {sequenceStopCandidates > 0 ? (
              <GrowthBadge label={`${sequenceStopCandidates} sequence stop candidates`} tone="critical" />
            ) : null}
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/booking-intelligence">Booking Intelligence</Link>
            </Button>
          </div>
        ) : null}
      </GrowthEngineCard>

      {objectionMemoryCount > 0 ? (
        <GrowthEngineCard title="Objection Memory">
          <p className="mb-3 text-xs text-muted-foreground">
            Evidence-backed objections surfaced from relationship memory — review before sequence execution.
          </p>
          <ul className="space-y-2 text-sm">
            {topObjections.map((objection, index) => (
              <li key={`${objection.objectionLabel}-${index}`} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-medium">{objection.objectionLabel}</p>
                <p className="text-xs text-muted-foreground">{objection.evidenceSnippet}</p>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Job queue">
        {!dashboard?.jobs.length ? (
          <p className="text-sm text-muted-foreground">
            {dashboard?.standalonePlanningAutomated
              ? "No execution jobs yet. Due steps appear here after the sequence scheduler cron runs (or use Run scheduler now)."
              : "No execution jobs yet. Plan due steps to create pending jobs."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Lead</th>
                  <th className="px-2 py-2 font-medium">Sequence</th>
                  <th className="px-2 py-2 font-medium">Step</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Due</th>
                  <th className="px-2 py-2 font-medium">Approval</th>
                  <th className="px-2 py-2 font-medium">Provider</th>
                  <th className="px-2 py-2 font-medium">Sender pool</th>
                  <th className="px-2 py-2 font-medium">Experiment</th>
                  <th className="px-2 py-2 font-medium">Last Error</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    busy={actionJobId === job.id}
                    highlighted={highlightJobId === job.id}
                    soloApprovalEnabled={dashboard.soloApprovalEnabled === true}
                    onApprove={() => void jobAction(job.id, "approve")}
                    onRun={() => void jobAction(job.id, "run")}
                    onSkip={() => void jobAction(job.id, "skip")}
                    onRestore={() => void jobAction(job.id, "restore")}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Multi-Channel Task Timeline">
        {channelTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No multi-channel tasks planned yet.</p>
        ) : (
          <div className="space-y-2">
            {channelTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={channelTypeLabel(task.channel)} tone="attention" />
                  <GrowthBadge label={taskStatusLabel(task.status)} tone="medium" />
                  <span>{task.leadLabel}</span>
                  <span className="text-muted-foreground">{task.title}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.callWorkspaceHref ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={task.callWorkspaceHref}>Calls</Link>
                    </Button>
                  ) : null}
                  {task.bookingIntelligenceHref ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={task.bookingIntelligenceHref}>Booking Intelligence</Link>
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href="/admin/growth/multichannel">Multi-Channel</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}

function JobRow({
  job,
  busy,
  highlighted,
  soloApprovalEnabled,
  onApprove,
  onRun,
  onSkip,
  onRestore,
}: {
  job: GrowthSequenceExecutionJobView
  busy: boolean
  highlighted?: boolean
  soloApprovalEnabled: boolean
  onApprove: () => void
  onRun: () => void
  onSkip: () => void
  onRestore: () => void
}) {
  const canApprove = ["draft", "pending_approval", "blocked", "failed"].includes(job.status)
  const canRun = !soloApprovalEnabled && job.status === "approved" && Boolean(job.humanApprovedAt)
  const canSkip = !["sent", "skipped"].includes(job.status)
  const canRestore = job.status === "skipped" && !job.deliveryAttemptId

  return (
    <tr
      id={sequenceExecutionJobRowId(job.id)}
      className={cn(
        "border-b border-border/70 align-top transition-colors",
        highlighted ? GROWTH_SEQUENCE_EXECUTION_JOB_HIGHLIGHT_CLASS : undefined,
      )}
    >
      <td className="px-2 py-3 font-medium">{job.leadLabel}</td>
      <td className="px-2 py-3 text-muted-foreground">{job.sequenceLabel}</td>
      <td className="px-2 py-3 text-muted-foreground">{job.stepLabel}</td>
      <td className="px-2 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <GrowthBadge label={sequenceExecutionStatusLabel(job.status)} tone={STATUS_TONE[job.status] ?? "neutral"} />
          {job.qaDeliverabilityBypassUsed ? (
            <GrowthBadge label="QA deliverability bypass" tone="attention" />
          ) : null}
        </div>
      </td>
      <td className="px-2 py-3 tabular-nums text-muted-foreground">{formatWhen(job.scheduledFor)}</td>
      <td className="px-2 py-3">
        {job.humanApprovedAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            Approved
          </span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        )}
      </td>
      <td className="px-2 py-3 text-muted-foreground">{job.providerLabel ?? "—"}</td>
      <td className="px-2 py-3 text-muted-foreground">
        {job.senderPoolLabel ? (
          <span>
            {job.senderPoolLabel}
            {job.rotationRiskLevel ? (
              <GrowthBadge label={job.rotationRiskLevel} tone={STATUS_TONE[job.rotationRiskLevel] ?? "neutral"} />
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-3 text-muted-foreground">
        {job.experimentVariantLabel ? (
          <span title={job.experimentName ?? undefined}>
            {job.experimentVariantLabel}
            {job.experimentName ? (
              <span className="block text-xs text-muted-foreground/80">{job.experimentName}</span>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="max-w-[180px] truncate px-2 py-3 text-destructive" title={job.lastError ?? undefined}>
        {job.lastError ?? "—"}
      </td>
      <td className="px-2 py-3">
        <div className="flex flex-wrap gap-1">
          {canApprove ? (
            <Button variant="outline" size="sm" disabled={busy} data-sequence-action="approve" onClick={onApprove}>
              {soloApprovalEnabled ? "Approve & Queue Send" : "Approve"}
            </Button>
          ) : null}
          {soloApprovalEnabled && job.status === "approved" ? (
            <span className="inline-flex items-center gap-1 px-1 text-xs text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Queued for cron
            </span>
          ) : null}
          {canRun ? (
            <Button size="sm" disabled={busy} onClick={onRun}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="mr-1 size-3.5" />}
              Run Now
            </Button>
          ) : null}
          {canSkip ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onSkip}>
              <SkipForward className="mr-1 size-3.5" />
              Skip
            </Button>
          ) : null}
          {canRestore ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
              <RotateCcw className="mr-1 size-3.5" />
              Restore
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link href={growthLeadDetailHref(job.leadId, "growth.leads")}>View Lead</Link>
          </Button>
        </div>
      </td>
    </tr>
  )
}
