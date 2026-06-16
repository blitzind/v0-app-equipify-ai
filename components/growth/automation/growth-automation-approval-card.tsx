"use client"

import { GrowthAutomationApprovalActions } from "@/components/growth/automation/growth-automation-approval-actions"
import { GrowthAutomationApprovalStatusBadge } from "@/components/growth/automation/growth-automation-approval-status-badge"
import {
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  type GrowthAutomationApprovalRecord,
} from "@/lib/growth/automation/growth-automation-approval-types"

type Props = {
  approval: GrowthAutomationApprovalRecord
  onCompleted?: (approval: GrowthAutomationApprovalRecord) => void
  onSelect?: (approval: GrowthAutomationApprovalRecord) => void
}

export function GrowthAutomationApprovalCard({ approval, onCompleted, onSelect }: Props) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{approval.previewPayload.summary}</p>
          <p className="mt-1 text-muted-foreground">
            {approval.actionType} · step {approval.previewPayload.stepOrder}
            {approval.previewPayload.leadLabel ? ` · ${approval.previewPayload.leadLabel}` : ""}
          </p>
        </div>
        <GrowthAutomationApprovalStatusBadge status={approval.status} />
      </div>

      <dl className="mt-3 grid gap-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Risk</dt>
          <dd className="uppercase">{approval.riskLevel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Approval</dt>
          <dd className="font-mono break-all">{approval.approvalId.slice(0, 8)}…</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.message_send_execution_enabled === false ? (
          <span>no sends</span>
        ) : null}
        {GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.approved_job_execution_enabled === false ? (
          <span>approved ≠ send</span>
        ) : null}
      </div>

      {onSelect ? (
        <button
          type="button"
          className="mt-3 text-[11px] text-primary underline-offset-2 hover:underline"
          onClick={() => onSelect(approval)}
        >
          View detail
        </button>
      ) : null}

      <div className="mt-3 border-t border-border/60 pt-3">
        <GrowthAutomationApprovalActions approval={approval} onCompleted={onCompleted} compact />
      </div>
    </div>
  )
}
