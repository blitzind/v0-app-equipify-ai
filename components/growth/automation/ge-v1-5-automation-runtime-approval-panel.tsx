"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { GeV15PreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

type GeV15AutomationRuntimeApprovalPanelProps = {
  leadId: string
  onUpdated?: () => void
}

export function GeV15AutomationRuntimeApprovalPanel({
  leadId,
  onUpdated,
}: GeV15AutomationRuntimeApprovalPanelProps) {
  const [pending, setPending] = useState<GeV15PreparedAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [draftEdits, setDraftEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/automation-runtime/approvals?leadId=${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as {
        ok?: boolean
        pending?: GeV15PreparedAction[]
        error?: string
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not load prepared actions.")
      }
      const rows = payload.pending ?? []
      setPending(rows)
      setDraftEdits(
        Object.fromEntries(
          rows.map((action) => [
            action.id,
            {
              subject: action.editedSubject ?? action.title,
              body: action.editedDraftContent ?? action.draftContent ?? "",
            },
          ]),
        ),
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load prepared actions.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function postDecision(
    actionId: string,
    decision: "approve" | "reject" | "execute",
    reason?: string,
  ) {
    setActionLoading(actionId)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/automation-runtime/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, actionId, decision, reason }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Could not update approval.")
      }
      await load()
      onUpdated?.()
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Could not update approval.")
    } finally {
      setActionLoading(null)
    }
  }

  async function saveEdit(actionId: string) {
    setActionLoading(`edit-${actionId}`)
    setError(null)
    try {
      const edit = draftEdits[actionId]
      const response = await fetch("/api/platform/growth/automation-runtime/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          actionId,
          editedSubject: edit?.subject,
          editedDraftContent: edit?.body,
        }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Could not save edits.")
      }
      await load()
      onUpdated?.()
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not save edits.")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading autonomy-prepared actions…
      </div>
    )
  }

  return (
    <Card data-qa-marker={GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Autonomy-prepared approvals
        </CardTitle>
        <CardDescription>
          Review drafts prepared by Growth Engine. Edit, approve, then execute — every send requires operator action.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending autonomy-prepared actions.</p>
        ) : (
          pending.map((action) => {
            const canEdit =
              action.status !== "executed" &&
              action.status !== "rejected" &&
              action.status !== "approved"
            const canDecide =
              action.status !== "executed" && action.status !== "rejected"
            return (
            <div key={action.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{action.title}</p>
                {action.autonomyPrepared ? <Badge variant="secondary">Autonomy prepared</Badge> : null}
                {action.channel ? <Badge variant="outline">{action.channel}</Badge> : null}
                <Badge variant="outline">{action.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{action.summary}</p>
              {action.triggerReason ? (
                <p className="text-xs text-muted-foreground">Trigger: {action.triggerReason}</p>
              ) : null}
              {typeof action.confidenceScore === "number" ? (
                <p className="text-xs text-muted-foreground">Confidence: {action.confidenceScore}/100</p>
              ) : null}
              {action.senderProfileId ? (
                <p className="text-xs text-muted-foreground">Sender profile: {action.senderProfileId}</p>
              ) : null}
              {action.recipientEmail ? (
                <p className="text-xs text-muted-foreground">Recipient: {action.recipientEmail}</p>
              ) : null}
              {action.originalDraftContent && action.originalDraftContent !== action.editedDraftContent ? (
                <details className="text-xs text-muted-foreground">
                  <summary>Original AI draft</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/30 p-2">{action.originalDraftContent}</pre>
                </details>
              ) : null}
              {action.action === "prepare_email" ? (
                <Input
                  value={draftEdits[action.id]?.subject ?? action.title}
                  disabled={Boolean(actionLoading) || !canEdit}
                  onChange={(event) =>
                    setDraftEdits((current) => ({
                      ...current,
                      [action.id]: { ...current[action.id], subject: event.target.value },
                    }))
                  }
                />
              ) : null}
              <Textarea
                value={draftEdits[action.id]?.body ?? action.draftContent ?? ""}
                disabled={Boolean(actionLoading) || !canEdit}
                onChange={(event) =>
                  setDraftEdits((current) => ({
                    ...current,
                    [action.id]: { ...current[action.id], body: event.target.value },
                  }))
                }
              />
              {canDecide ? (
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() => void saveEdit(action.id)}
                    >
                      Save edits
                    </Button>
                  ) : null}
                  {action.status !== "approved" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void postDecision(action.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Input
                        placeholder="Reject reason (optional)"
                        value={rejectReasons[action.id] ?? ""}
                        onChange={(event) =>
                          setRejectReasons((current) => ({ ...current, [action.id]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void postDecision(action.id, "reject", rejectReasons[action.id])}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(actionLoading) || action.status !== "approved"}
                    onClick={() => void postDecision(action.id, "execute")}
                  >
                    Execute send
                  </Button>
                </div>
              ) : null}
              {action.executionError ? (
                <p className="text-xs text-destructive">Execution error: {action.executionError}</p>
              ) : null}
              {action.rejectReason ? (
                <p className="text-xs text-muted-foreground">Rejected: {action.rejectReason}</p>
              ) : null}
            </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
