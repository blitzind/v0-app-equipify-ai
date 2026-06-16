"use client"

import { useState } from "react"
import { Ban, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { GrowthAutomationApprovalRecord } from "@/lib/growth/automation/growth-automation-approval-types"

type Props = {
  approval: GrowthAutomationApprovalRecord
  onCompleted?: (approval: GrowthAutomationApprovalRecord) => void
  compact?: boolean
}

export function GrowthAutomationApprovalActions({ approval, onCompleted, compact }: Props) {
  const [reviewNote, setReviewNote] = useState("")
  const [busy, setBusy] = useState<"approve" | "reject" | "cancel" | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const runAction = async (action: "approve" | "reject" | "cancel") => {
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/platform/growth/automation/approvals/${encodeURIComponent(approval.approvalId)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewNote: reviewNote.trim() || null }),
        },
      )
      const data = (await res.json()) as { approval?: GrowthAutomationApprovalRecord; ok?: boolean }
      if (data.approval) {
        setMessage(`${action} recorded — no send executed.`)
        onCompleted?.(data.approval)
      } else {
        setMessage(`${action} failed.`)
      }
    } finally {
      setBusy(null)
    }
  }

  if (approval.status !== "pending") {
    return (
      <p className="text-xs text-muted-foreground">
        Reviewed · approved jobs still do not send in this phase.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {!compact ? (
        <Textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder="Optional review note"
          rows={2}
          className="text-xs"
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => void runAction("approve")}
        >
          {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void runAction("reject")}>
          {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          Reject
        </Button>
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void runAction("cancel")}>
          {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
          Cancel
        </Button>
      </div>

      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Human review required · no sends · no provider · no notifications
      </p>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
