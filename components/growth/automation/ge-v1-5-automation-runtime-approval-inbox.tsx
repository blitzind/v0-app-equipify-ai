"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ShieldCheck } from "lucide-react"
import { GeV15AutomationRuntimeApprovalPanel } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GeV15PreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

type InboxItem = {
  leadId: string
  leadName: string
  leadEmail: string | null
  companyName: string
  action: GeV15PreparedAction
}

type GeV15AutomationRuntimeApprovalInboxProps = {
  limit?: number
  selectedLeadId?: string | null
}

export function GeV15AutomationRuntimeApprovalInbox({
  limit = 20,
  selectedLeadId = null,
}: GeV15AutomationRuntimeApprovalInboxProps) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(selectedLeadId)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/automation-runtime/approvals/inbox?limit=${limit}`,
        { cache: "no-store" },
      )
      const body = (await response.json()) as { ok?: boolean; items?: InboxItem[]; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Could not load approval inbox.")
      }
      setItems(body.items ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load approval inbox.")
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedLeadId) {
      setActiveLeadId(selectedLeadId)
      return
    }
    if (items[0]?.leadId) {
      setActiveLeadId(items[0].leadId)
    }
  }, [items, selectedLeadId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading autonomy-prepared follow-ups…
      </div>
    )
  }

  return (
    <div className="space-y-4" data-qa-marker={GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Prepared follow-ups awaiting review
          </CardTitle>
          <CardDescription>
            AI OS prepared these channel follow-ups. Review, edit, approve, and execute — no autonomous
            sending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prepared follow-ups awaiting review.</p>
          ) : (
            items.map((item) => (
              <button
                key={`${item.leadId}:${item.action.id}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => setActiveLeadId(item.leadId)}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.leadName}</p>
                    {item.action.channel ? <Badge variant="outline">{item.action.channel}</Badge> : null}
                    <Badge variant="secondary">{item.action.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.action.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.companyName}
                    {item.leadEmail ? ` · ${item.leadEmail}` : ""}
                  </p>
                </div>
                {typeof item.action.confidenceScore === "number" ? (
                  <span className="text-xs text-muted-foreground">{item.action.confidenceScore}/100</span>
                ) : null}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {activeLeadId ? (
        <div className="space-y-2">
          <Link href={`/growth/leads?open=${encodeURIComponent(activeLeadId)}`} className="text-sm text-primary">
            Open lead in CRM
          </Link>
          <GeV15AutomationRuntimeApprovalPanel leadId={activeLeadId} onUpdated={() => void load()} />
        </div>
      ) : null}
    </div>
  )
}
