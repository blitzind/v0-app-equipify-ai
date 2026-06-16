"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationApprovalCard } from "@/components/growth/automation/growth-automation-approval-card"
import { GrowthAutomationApprovalDetailDrawer } from "@/components/growth/automation/growth-automation-approval-detail-drawer"
import {
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  type GrowthAutomationApprovalRecord,
} from "@/lib/growth/automation/growth-automation-approval-types"

type Props = {
  flowId: string
  enrollmentId?: string | null
  leadId?: string | null
  onChanged?: () => void
}

type ApprovalsResponse = {
  approvals?: GrowthAutomationApprovalRecord[]
}

export function GrowthAutomationApprovalQueue({
  flowId,
  enrollmentId,
  leadId,
  onChanged,
}: Props) {
  const [approvals, setApprovals] = useState<GrowthAutomationApprovalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<GrowthAutomationApprovalRecord | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ flowId })
      if (enrollmentId) params.set("enrollmentId", enrollmentId)
      const res = await fetch(`/api/platform/growth/automation/approvals?${params.toString()}`)
      const data = (await res.json()) as ApprovalsResponse
      setApprovals(data.approvals ?? [])
    } finally {
      setLoading(false)
    }
  }, [enrollmentId, flowId])

  useEffect(() => {
    void loadApprovals()
  }, [loadApprovals])

  const resumeAfterApproval = async () => {
    if (!enrollmentId) return
    setBusy(true)
    try {
      const approved = approvals.find((entry) => entry.status === "approved")
      await fetch(
        `/api/platform/growth/automation/${flowId}/runtime/enrollments/${encodeURIComponent(enrollmentId)}/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approvalId: approved?.approvalId ?? null,
            leadId,
          }),
        },
      )
      onChanged?.()
      await loadApprovals()
    } finally {
      setBusy(false)
    }
  }

  const handleCompleted = async () => {
    onChanged?.()
    await loadApprovals()
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-qa-marker={GROWTH_AUTOMATION_APPROVAL_QA_MARKER}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Operator approval queue</h3>
          <p className="text-xs text-muted-foreground">
            Review pending automation actions · approve does not send yet
          </p>
        </div>
        {enrollmentId && approvals.some((entry) => entry.status === "approved") ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void resumeAfterApproval()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Resume
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.requires_human_review ? <span>human review</span> : null}
        {GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.message_send_execution_enabled === false ? (
          <span>no sends</span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading approvals…</p>
      ) : approvals.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {approvals.map((approval) => (
            <GrowthAutomationApprovalCard
              key={approval.approvalId}
              approval={approval}
              onCompleted={() => void handleCompleted()}
              onSelect={(entry) => {
                setSelected(entry)
                setDrawerOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <GrowthAutomationApprovalDetailDrawer
        approval={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCompleted={() => void handleCompleted()}
      />
    </div>
  )
}
