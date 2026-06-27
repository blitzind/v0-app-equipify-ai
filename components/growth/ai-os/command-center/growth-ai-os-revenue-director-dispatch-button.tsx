"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { GrowthRevenueDirectorWorkflowRequest } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

type Props = {
  request: GrowthRevenueDirectorWorkflowRequest
}

export function GrowthAiOsRevenueDirectorDispatchButton({ request }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const eligibility = request.dispatchEligibility
  const canDispatch =
    request.ledgerStatus === "accepted" &&
    eligibility?.eligible === true &&
    Boolean(request.ledgerRequestId)

  const blockReason =
    eligibility?.blockReason ??
    (request.ledgerStatus !== "accepted" ? "Accept the request before dispatch." : null)

  async function handleDispatch() {
    if (!request.ledgerRequestId) return
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/platform/growth/ai-os/revenue-director/workflow-requests/${request.ledgerRequestId}/dispatch`,
        { method: "POST" },
      )
      const payload = (await response.json()) as { ok?: boolean; message?: string; result?: { summary?: string } }
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Dispatch blocked.")
        return
      }
      setMessage(payload.result?.summary ?? "Dispatch recorded.")
      setOpen(false)
    } catch {
      setMessage("Dispatch failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <Button
        type="button"
        size="sm"
        variant={canDispatch ? "default" : "outline"}
        disabled={!canDispatch || loading}
        onClick={() => setOpen(true)}
        data-qa-action="revenue-director-dispatch"
      >
        Dispatch
      </Button>
      {!canDispatch && blockReason ? (
        <p className="text-xs text-muted-foreground">{blockReason}</p>
      ) : null}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm workflow dispatch</DialogTitle>
            <DialogDescription>
              Dispatches to an existing Workflow Agent. Does not send outbound directly.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Target agent</dt>
              <dd>{eligibility?.targetAgent ?? request.targetWorkflowAgent}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Request type</dt>
              <dd>{request.requestType.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Subject</dt>
              <dd>{request.leadId ?? request.objectiveId ?? request.missionId ?? "System"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Policy</dt>
              <dd>Growth Autonomy + Human Approval gates apply. No transport execution.</dd>
            </div>
          </dl>
          {request.evidence.length > 0 ? (
            <ul className="text-xs text-muted-foreground">
              {request.evidence.slice(0, 3).map((row) => (
                <li key={`${row.source}-${row.label}`}>
                  {row.label}: {String(row.value ?? "—")}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={loading} onClick={() => void handleDispatch()}>
              {loading ? "Dispatching…" : "Confirm dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
