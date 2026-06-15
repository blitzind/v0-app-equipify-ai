"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, Square, Pause, RotateCcw } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import type {
  ProspectExecutionProgress,
  ProspectExecutionRun,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import { PROSPECT_DISCOVERY_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-run-types"

const EXECUTION_CONFIRM = "RUN_PROSPECT_DISCOVERY_EXECUTION"

export function ProspectDiscoveryExecutionPanel({
  searchPlan,
  executionPlan,
  searchPlanId,
  executionApproved,
}: {
  searchPlan: ProspectSearchPlan | null
  executionPlan: ProspectExecutionPlan | null
  searchPlanId: string | null
  executionApproved: boolean
}) {
  const [run, setRun] = useState<ProspectExecutionRun | null>(null)
  const [progress, setProgress] = useState<ProspectExecutionProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const refreshStatus = useCallback(async (executionRunId: string) => {
    const res = await fetch(
      `/api/platform/growth/prospect-discovery/execution-status/${encodeURIComponent(executionRunId)}`,
      { cache: "no-store" },
    )
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      run?: ProspectExecutionRun
      progress?: ProspectExecutionProgress
    }
    if (res.ok && data.run) {
      setRun(data.run)
      setProgress(data.progress ?? null)
    }
  }, [])

  useEffect(() => {
    if (!run?.execution_run_id || run.status !== "running") return
    const timer = window.setInterval(() => {
      void refreshStatus(run.execution_run_id)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [refreshStatus, run?.execution_run_id, run?.status])

  const startExecution = useCallback(async () => {
    if (!searchPlan || !executionPlan || !searchPlanId || !executionApproved) {
      setError("Approve the execution plan before confirming execution.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/prospect-discovery/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: EXECUTION_CONFIRM,
          search_plan: searchPlan,
          execution_plan: executionPlan,
          search_plan_id: searchPlanId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: ProspectExecutionRun
        progress?: ProspectExecutionProgress
        error?: string
      }
      if (!res.ok || !data.run) {
        setError(data.error ?? "Execution failed.")
        return
      }
      setRun(data.run)
      setProgress(data.progress ?? null)
      setConfirmOpen(false)
    } catch {
      setError("Execution request failed.")
    } finally {
      setLoading(false)
    }
  }, [executionApproved, executionPlan, searchPlan, searchPlanId])

  const pauseExecution = useCallback(async () => {
    if (!run?.execution_run_id) return
    await fetch("/api/platform/growth/prospect-discovery/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution_run_id: run.execution_run_id, action: "pause" }),
    })
    void refreshStatus(run.execution_run_id)
  }, [refreshStatus, run?.execution_run_id])

  const resumeExecution = useCallback(async () => {
    if (!run?.execution_run_id) return
    await fetch("/api/platform/growth/prospect-discovery/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution_run_id: run.execution_run_id, action: "resume" }),
    })
    void refreshStatus(run.execution_run_id)
  }, [refreshStatus, run?.execution_run_id])

  const cancelExecution = useCallback(async () => {
    if (!run?.execution_run_id) return
    await fetch("/api/platform/growth/prospect-discovery/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution_run_id: run.execution_run_id }),
    })
    void refreshStatus(run.execution_run_id)
  }, [refreshStatus, run?.execution_run_id])

  if (!executionPlan) return null

  return (
    <GrowthEngineCard
      title="Prospect Discovery Execution"
      data-qa-marker={PROSPECT_DISCOVERY_EXECUTION_QA_MARKER}
      className="mt-4"
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Human-gated execution only. Confirm with operator token before any provider run. No enrollment or outreach.
      </p>

      {!run ? (
        <div className="space-y-3">
          {!executionApproved ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Approve the execution plan above before confirming execution.
            </p>
          ) : null}
          {!confirmOpen ? (
            <button
              type="button"
              disabled={!executionApproved || loading}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Play className="size-3.5" />
              Confirm Execution
            </button>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <p className="text-xs font-medium">Confirm human-gated discovery execution?</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                This will run real provider discovery stages. Token: {EXECUTION_CONFIRM}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void startExecution()}
                  disabled={loading}
                  className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Starting…" : "Start Execution"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <GrowthBadge tone={run.status === "completed" ? "high" : run.status === "failed" ? "critical" : "attention"}>
              {run.status}
            </GrowthBadge>
            <GrowthBadge tone="neutral">{progress?.estimated_progress_pct ?? 0}% complete</GrowthBadge>
            <GrowthBadge tone="neutral">{run.companies_discovered} companies</GrowthBadge>
            <GrowthBadge tone="neutral">{run.contacts_discovered} contacts</GrowthBadge>
            <GrowthBadge tone="neutral">{run.credits_consumed} credits</GrowthBadge>
          </div>

          {progress?.current_stage_label ? (
            <p className="text-xs">
              Current stage: <span className="font-medium">{progress.current_stage_label}</span>
              {progress.estimated_seconds_remaining != null ? (
                <span className="text-muted-foreground"> — ~{progress.estimated_seconds_remaining}s remaining</span>
              ) : null}
            </p>
          ) : null}

          <ol className="space-y-1.5">
            {run.stage_states.map((stage) => (
              <li key={stage.stage_id} className="flex items-center gap-2 text-[11px]">
                <span
                  className={
                    stage.status === "completed"
                      ? "text-emerald-600"
                      : stage.status === "running"
                        ? "text-violet-600"
                        : stage.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                  }
                >
                  {stage.status}
                </span>
                <span>{stage.stage_id.replace(/_/g, " ")}</span>
                {stage.message ? <span className="text-muted-foreground">— {stage.message}</span> : null}
              </li>
            ))}
          </ol>

          {run.warnings.length ? (
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {run.warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {run.status === "running" ? (
              <button
                type="button"
                onClick={() => void pauseExecution()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
              >
                <Pause className="size-3" /> Pause
              </button>
            ) : null}
            {run.status === "paused" ? (
              <button
                type="button"
                onClick={() => void resumeExecution()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
              >
                <RotateCcw className="size-3" /> Resume
              </button>
            ) : null}
            {run.status === "running" || run.status === "paused" ? (
              <button
                type="button"
                onClick={() => void cancelExecution()}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
              >
                <Square className="size-3" /> Cancel
              </button>
            ) : null}
            {run.status === "completed" ? (
              <Link
                href={`/platform/growth/prospect-search?discovery_mode=discover_external`}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                View Results
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {loading ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Executing discovery stages…
        </p>
      ) : null}
    </GrowthEngineCard>
  )
}
