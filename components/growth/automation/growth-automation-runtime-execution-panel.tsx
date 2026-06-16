"use client"

import { useCallback, useEffect, useState } from "react"
import { FastForward, Loader2, StepForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationApprovalQueue } from "@/components/growth/automation/growth-automation-approval-queue"
import { GrowthAutomationRuntimeApprovalGateCard } from "@/components/growth/automation/growth-automation-runtime-approval-gate-card"
import { GrowthAutomationRuntimeExecutionStatusBadge } from "@/components/growth/automation/growth-automation-runtime-execution-status-badge"
import { GrowthAutomationRuntimePendingJobCard } from "@/components/growth/automation/growth-automation-runtime-pending-job-card"
import { GrowthAutomationRuntimeStepTimeline } from "@/components/growth/automation/growth-automation-runtime-step-timeline"
import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
  type GrowthAutomationRuntimeExecutionRun,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"

type Props = {
  flowId: string
  enrollmentId: string | null
  leadId?: string | null
  onChanged?: () => void
}

type ExecutionResponse = {
  execution?: GrowthAutomationRuntimeExecutionRun
}

export function GrowthAutomationRuntimeExecutionPanel({
  flowId,
  enrollmentId,
  leadId,
  onChanged,
}: Props) {
  const [execution, setExecution] = useState<GrowthAutomationRuntimeExecutionRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!enrollmentId) {
      setExecution(null)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/growth/automation/${flowId}/runtime/enrollments/${encodeURIComponent(enrollmentId)}`,
      )
      const data = (await res.json()) as ExecutionResponse
      if (data.execution) setExecution(data.execution)
    } finally {
      setLoading(false)
    }
  }, [enrollmentId, flowId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const advance = useCallback(
    async (untilBlocked: boolean) => {
      if (!enrollmentId) return
      setBusy(true)
      setMessage(null)
      try {
        const path = untilBlocked ? "advance-until-blocked" : "advance"
        const res = await fetch(`/api/platform/growth/automation/${flowId}/runtime/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId, leadId }),
        })
        const data = (await res.json()) as ExecutionResponse
        if (data.execution) {
          setExecution(data.execution)
          setMessage(`Runtime status: ${data.execution.status}`)
        } else {
          setMessage("Advance request failed.")
        }
        onChanged?.()
      } finally {
        setBusy(false)
      }
    },
    [enrollmentId, flowId, leadId, onChanged],
  )

  if (!enrollmentId) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        Select an enrollment to inspect runtime execution.
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-qa-marker={GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Runtime execution</h3>
          <p className="text-xs text-muted-foreground">SR-3 progression · no sends · no auto-approval</p>
        </div>
        {execution ? <GrowthAutomationRuntimeExecutionStatusBadge status={execution.status} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.runtime_execution_enabled ? (
          <span>execution enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.message_send_execution_enabled === false ? (
          <span>no sends</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.autonomous_approval_enabled === false ? (
          <span>no auto-approval</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void advance(false)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <StepForward className="size-4" />}
          Advance step
        </Button>
        <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void advance(true)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FastForward className="size-4" />}
          Advance until blocked
        </Button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading execution status…</p>
      ) : (
        <>
          <div className="mt-4">
            <GrowthAutomationRuntimeStepTimeline execution={execution} />
          </div>

          {execution?.approvalGates.map((gate) => (
            <div key={gate.gateId} className="mt-3">
              <GrowthAutomationRuntimeApprovalGateCard
                gate={gate}
                flowId={flowId}
                versionId={execution.versionId}
                leadId={execution.leadId}
                onChanged={() => {
                  void loadStatus()
                  onChanged?.()
                }}
              />
            </div>
          ))}

          {execution?.pendingJobs.map((job) => (
            <div key={job.jobId} className="mt-3">
              <GrowthAutomationRuntimePendingJobCard
                job={job}
                flowId={flowId}
                versionId={execution.versionId}
                leadId={execution.leadId}
                onChanged={() => {
                  void loadStatus()
                  onChanged?.()
                }}
              />
            </div>
          ))}

          <div className="mt-4">
            <GrowthAutomationApprovalQueue
              flowId={flowId}
              enrollmentId={enrollmentId}
              leadId={leadId}
              onChanged={() => {
                void loadStatus()
                onChanged?.()
              }}
            />
          </div>
        </>
      )}

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
