"use client"

import { GrowthAutomationApprovalActions } from "@/components/growth/automation/growth-automation-approval-actions"
import { GrowthAutomationApprovalStatusBadge } from "@/components/growth/automation/growth-automation-approval-status-badge"
import {
  buildAutomationApprovalRecord,
  buildApprovalPreview,
  resolveApprovalActionType,
} from "@/lib/growth/automation/growth-automation-approval-utils"
import type { GrowthAutomationApprovalRecord } from "@/lib/growth/automation/growth-automation-approval-types"
import type { GrowthAutomationRuntimeApprovalGate } from "@/lib/growth/automation/growth-automation-runtime-execution-types"

type Props = {
  gate: GrowthAutomationRuntimeApprovalGate
  flowId: string
  versionId?: string | null
  leadId?: string | null
  leadLabel?: string | null
  onChanged?: () => void
}

export function GrowthAutomationRuntimeApprovalGateCard({
  gate,
  flowId,
  versionId,
  leadId,
  leadLabel,
  onChanged,
}: Props) {
  const actionType = resolveApprovalActionType({ gate })
  const approval = buildAutomationApprovalRecord({
    approvalId: gate.gateId,
    flowId,
    versionId: versionId ?? "",
    enrollmentId: gate.enrollmentId,
    leadId: leadId ?? "",
    stepId: gate.enrollmentStepId,
    actionType,
    status: ((gate as { status?: string }).status ?? "pending") === "pending"
      ? "pending"
      : (((gate as { status?: string }).status ?? "pending") as GrowthAutomationApprovalRecord["status"]),
    previewPayload: buildApprovalPreview({
      actionType,
      stepOrder: gate.stepOrder,
      stepKind: "approval",
      channel: null,
      leadLabel: leadLabel ?? null,
      entryReason: gate.entryReason,
    }),
    createdAt: gate.createdAt,
  })

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-amber-900 dark:text-amber-100">Approval required</p>
        <GrowthAutomationApprovalStatusBadge status={approval.status} />
      </div>
      <p className="mt-1 text-muted-foreground">{gate.entryReason}</p>
      <dl className="mt-2 grid gap-1">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Step</dt>
          <dd>{gate.stepOrder}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Gate</dt>
          <dd className="font-mono break-all">{gate.gateId}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-amber-500/20 pt-3">
        <GrowthAutomationApprovalActions approval={approval} onCompleted={() => onChanged?.()} compact />
      </div>
    </div>
  )
}
