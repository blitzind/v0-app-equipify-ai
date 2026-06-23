"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GeV15PreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

type GeV15AutomationRuntimeApprovalPanelProps = {
  leadId: string
}

export function GeV15AutomationRuntimeApprovalPanel({
  leadId,
}: GeV15AutomationRuntimeApprovalPanelProps) {
  const [pending, setPending] = useState<GeV15PreparedAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/automation-runtime/approvals?leadId=${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      )
      const body = (await response.json()) as { ok?: boolean; pending?: GeV15PreparedAction[]; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Could not load prepared actions.")
      }
      setPending(body.pending ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load prepared actions.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(actionId: string, decision: "approve" | "reject") {
    setActionLoading(actionId)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/automation-runtime/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, actionId, decision }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Could not update approval.")
      }
      await load()
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Could not update approval.")
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
          Review drafts prepared by Growth Engine. Approve, reject, or edit before any send.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending autonomy-prepared actions.</p>
        ) : (
          pending.map((action) => (
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
              {action.draftContent ? (
                <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{action.draftContent}</pre>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={Boolean(actionLoading)}
                  onClick={() => void decide(action.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(actionLoading)}
                  onClick={() => void decide(action.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
