"use client"

import { GrowthAutomationApprovalActions } from "@/components/growth/automation/growth-automation-approval-actions"
import { GrowthAutomationApprovalStatusBadge } from "@/components/growth/automation/growth-automation-approval-status-badge"
import type { GrowthAutomationApprovalRecord } from "@/lib/growth/automation/growth-automation-approval-types"
import {
  buildAutomationApprovalRecord,
  buildApprovalPreview,
  resolveApprovalActionType,
} from "@/lib/growth/automation/growth-automation-approval-utils"
import type { GrowthAutomationRuntimePendingJob } from "@/lib/growth/automation/growth-automation-runtime-execution-types"

type Props = {
  job: GrowthAutomationRuntimePendingJob
  flowId: string
  versionId?: string | null
  leadId?: string | null
  leadLabel?: string | null
  onChanged?: () => void
}

export function GrowthAutomationRuntimePendingJobCard({
  job,
  flowId,
  versionId,
  leadId,
  leadLabel,
  onChanged,
}: Props) {
  const actionType = resolveApprovalActionType({ job })
  const approval = buildAutomationApprovalRecord({
    approvalId: job.jobId,
    flowId,
    versionId: versionId ?? "",
    enrollmentId: job.enrollmentId,
    leadId: leadId ?? "",
    stepId: job.enrollmentStepId,
    jobId: job.jobId,
    actionType,
    status: job.status === "pending_approval"
      ? "pending"
      : (job.status as GrowthAutomationApprovalRecord["status"]),
    previewPayload: buildApprovalPreview({
      actionType,
      stepOrder: job.stepOrder,
      stepKind: "action",
      channel: job.channel,
      leadLabel: leadLabel ?? null,
      entryReason: "Pending action job awaiting operator approval.",
    }),
    createdAt: job.createdAt,
  })

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">Pending action job</p>
        <GrowthAutomationApprovalStatusBadge status={approval.status} />
      </div>
      <p className="mt-1 text-muted-foreground">
        {job.channel} · step {job.stepOrder} · {job.status}
      </p>
      <p className="mt-2 font-mono text-[10px] break-all">{job.jobId}</p>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        execution disabled · no send · no provider
      </p>
      <div className="mt-3 border-t border-border/60 pt-3">
        <GrowthAutomationApprovalActions approval={approval} onCompleted={() => onChanged?.()} compact />
      </div>
    </div>
  )
}
