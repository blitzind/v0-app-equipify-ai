"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GrowthAutomationApprovalActions } from "@/components/growth/automation/growth-automation-approval-actions"
import { GrowthAutomationApprovalStatusBadge } from "@/components/growth/automation/growth-automation-approval-status-badge"
import {
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  type GrowthAutomationApprovalRecord,
} from "@/lib/growth/automation/growth-automation-approval-types"

type Props = {
  approval: GrowthAutomationApprovalRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted?: (approval: GrowthAutomationApprovalRecord) => void
}

export function GrowthAutomationApprovalDetailDrawer({
  approval,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  if (!approval) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Approval detail
            <GrowthAutomationApprovalStatusBadge status={approval.status} />
          </SheetTitle>
          <SheetDescription>{approval.previewPayload.summary}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-xs" data-qa-marker={GROWTH_AUTOMATION_APPROVAL_QA_MARKER}>
          <dl className="grid gap-2">
            <div>
              <dt className="text-muted-foreground">Action</dt>
              <dd>{approval.actionType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lead</dt>
              <dd>{approval.previewPayload.leadLabel ?? approval.leadId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Step</dt>
              <dd>
                {approval.previewPayload.stepOrder} · {approval.previewPayload.stepKind}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Risk level</dt>
              <dd className="uppercase">{approval.riskLevel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approval ID</dt>
              <dd className="font-mono break-all">{approval.approvalId}</dd>
            </div>
            {approval.jobId ? (
              <div>
                <dt className="text-muted-foreground">Job ID</dt>
                <dd className="font-mono break-all">{approval.jobId}</dd>
              </div>
            ) : null}
          </dl>

          <div className="rounded-md border border-dashed border-border p-3">
            <p className="font-medium">Safety disclosure</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Approval execution enabled: {String(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.approval_execution_enabled)}</li>
              <li>Message sends: disabled</li>
              <li>Provider execution: disabled</li>
              <li>Notifications: disabled</li>
              <li>Approved job execution: disabled</li>
            </ul>
          </div>

          <GrowthAutomationApprovalActions
            approval={approval}
            onCompleted={(next) => {
              onCompleted?.(next)
              if (next.status !== "pending") onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
