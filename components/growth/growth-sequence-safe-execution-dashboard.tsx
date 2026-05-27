"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, RefreshCw, ShieldCheck, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE,
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  type GrowthSequenceExecutionJobView,
  type GrowthSequenceSafeExecutionDashboard,
  sequenceExecutionStatusLabel,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
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

export function GrowthSequenceSafeExecutionDashboard() {
  const [dashboard, setDashboard] = useState<GrowthSequenceSafeExecutionDashboard | null>(null)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

  async function jobAction(jobId: string, action: "approve" | "run" | "skip") {
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
              <p className="font-medium">Autonomous sequence sending is off.</p>
              <p className="text-amber-900/90">All sends require human approval.</p>
            </div>
          </div>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER} tone="neutral" />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-1 size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void planJobs()} disabled={actionJobId === "plan"}>
            {actionJobId === "plan" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Clock className="mr-1 size-3.5" />}
            Plan due steps
          </Button>
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Due Jobs" value={dashboard?.dueJobs ?? 0} />
          <StatTile label="Pending Approval" value={dashboard?.pendingApproval ?? 0} />
          <StatTile label="Blocked" value={dashboard?.blocked ?? 0} />
          <StatTile label="Sent 24h" value={dashboard?.sent24h ?? 0} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Job queue">
        {!dashboard?.jobs.length ? (
          <p className="text-sm text-muted-foreground">No execution jobs yet. Plan due steps to create pending jobs.</p>
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
                    onApprove={() => void jobAction(job.id, "approve")}
                    onRun={() => void jobAction(job.id, "run")}
                    onSkip={() => void jobAction(job.id, "skip")}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}

function JobRow({
  job,
  busy,
  onApprove,
  onRun,
  onSkip,
}: {
  job: GrowthSequenceExecutionJobView
  busy: boolean
  onApprove: () => void
  onRun: () => void
  onSkip: () => void
}) {
  const canApprove = ["draft", "pending_approval", "blocked", "failed"].includes(job.status)
  const canRun = job.status === "approved" && Boolean(job.humanApprovedAt)
  const canSkip = !["sent", "skipped"].includes(job.status)

  return (
    <tr className="border-b border-border/70 align-top">
      <td className="px-2 py-3 font-medium">{job.leadLabel}</td>
      <td className="px-2 py-3 text-muted-foreground">{job.sequenceLabel}</td>
      <td className="px-2 py-3 text-muted-foreground">{job.stepLabel}</td>
      <td className="px-2 py-3">
        <GrowthBadge label={sequenceExecutionStatusLabel(job.status)} tone={STATUS_TONE[job.status] ?? "neutral"} />
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
      <td className="max-w-[180px] truncate px-2 py-3 text-destructive" title={job.lastError ?? undefined}>
        {job.lastError ?? "—"}
      </td>
      <td className="px-2 py-3">
        <div className="flex flex-wrap gap-1">
          {canApprove ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={onApprove}>
              Approve
            </Button>
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
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/growth/leads/${job.leadId}`}>View Lead</Link>
          </Button>
        </div>
      </td>
    </tr>
  )
}
