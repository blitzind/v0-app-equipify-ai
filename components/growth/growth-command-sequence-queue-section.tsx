"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GROWTH_COMMAND_SEQUENCE_QUEUE_QA_MARKER } from "@/lib/growth/command/command-center-sequence-queue"
import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  sequenceExecutionStatusLabel,
  type GrowthSequenceExecutionJobView,
  type GrowthSequenceSafeExecutionDashboard,
} from "@/lib/growth/sequences/execution/sequence-execution-types"

function QueueJobRow({ job }: { job: GrowthSequenceExecutionJobView }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{job.leadLabel}</p>
        <p className="text-xs text-muted-foreground">
          {job.sequenceLabel} · {job.stepLabel}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GrowthBadge label={sequenceExecutionStatusLabel(job.status)} tone={job.status === "blocked" ? "blocked" : "attention"} />
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/growth/sequences/execution?highlightJobId=${job.id}`}>Review</Link>
        </Button>
      </div>
    </li>
  )
}

export function GrowthCommandSequenceQueueSection() {
  const [dashboard, setDashboard] = useState<GrowthSequenceSafeExecutionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
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

  const queueJobs = useMemo(() => {
    if (!dashboard?.jobs.length) return []
    return dashboard.jobs
      .filter((job) => job.status === "pending_approval" || job.status === "blocked" || job.status === "draft")
      .slice(0, 5)
  }, [dashboard])

  if (loading && !dashboard) {
    return (
      <GrowthEngineCard title="Sequence queue" icon={<GitBranch className="size-4" />}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading sequence queue…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard
      title="Sequence queue"
      icon={<GitBranch className="size-4" />}
      data-qa-marker={GROWTH_COMMAND_SEQUENCE_QUEUE_QA_MARKER}
    >
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <GrowthBadge label={GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER} tone="neutral" />
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/growth/sequences/execution">Open sequence execution</Link>
        </Button>
      </div>

      <div
        className="mb-4 grid items-stretch gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        <StatTile label="Pending approvals" value={dashboard?.pendingApproval ?? 0} className="min-h-[120px] justify-center" />
        <StatTile label="Blocked jobs" value={dashboard?.blocked ?? 0} className="min-h-[120px] justify-center" />
        <StatTile label="Sent (24h)" value={dashboard?.sent24h ?? 0} className="min-h-[120px] justify-center" />
      </div>

      {queueJobs.length ? (
        <ul className="space-y-2">
          {queueJobs.map((job) => (
            <QueueJobRow key={job.id} job={job} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No pending approvals or blocked jobs right now.</p>
      )}
    </GrowthEngineCard>
  )
}
