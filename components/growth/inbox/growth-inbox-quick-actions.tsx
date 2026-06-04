"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Archive, ClipboardList, Phone, Reply, Target, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import type { GrowthReplyOpportunityDraft } from "@/lib/growth/reply-intelligence/workflow-actions-types"

export function GrowthInboxQuickActions() {
  const { selectedThread, actionLoading, runAction, assignOwner, archiveThread } = useGrowthInboxWorkspace()
  const { leadId, refresh } = useGrowthInboxLeadContext()
  const [taskLoading, setTaskLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [oppDraft, setOppDraft] = useState<GrowthReplyOpportunityDraft | null>(null)
  const [oppOpen, setOppOpen] = useState(false)
  const [oppTitle, setOppTitle] = useState("")
  const [oppAmount, setOppAmount] = useState("0")

  const openOpportunityDialog = useCallback(async () => {
    if (!leadId) return
    setTaskLoading("opportunity")
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/replies/workflow-actions/opportunity-draft?leadId=${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as { draft?: GrowthReplyOpportunityDraft; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Could not load opportunity draft.")
      if (payload.draft?.existingOpportunityId) throw new Error("Opportunity already exists for this lead.")
      setOppDraft(payload.draft ?? null)
      setOppTitle(payload.draft?.title ?? "")
      setOppAmount(String(payload.draft?.amount ?? 0))
      setOppOpen(true)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Opportunity draft failed.")
    } finally {
      setTaskLoading(null)
    }
  }, [leadId])

  useEffect(() => {
    function handleOpenOpportunity(event: Event) {
      const detail = (event as CustomEvent<{ draft?: GrowthReplyOpportunityDraft | null }>).detail
      if (detail?.draft) {
        setOppDraft(detail.draft)
        setOppTitle(detail.draft.title ?? "")
        setOppAmount(String(detail.draft.amount ?? 0))
        setOppOpen(true)
      } else {
        void openOpportunityDialog()
      }
    }
    document.addEventListener("growth-inbox-open-opportunity-dialog", handleOpenOpportunity)
    return () => document.removeEventListener("growth-inbox-open-opportunity-dialog", handleOpenOpportunity)
  }, [openOpportunityDialog])

  async function createTask(type: "call" | "follow_up") {
    if (!leadId) return
    setTaskLoading(type)
    setError(null)
    try {
      const endpoint =
        type === "call"
          ? "/api/platform/growth/replies/workflow-actions/create-call-task"
          : "/api/platform/growth/replies/workflow-actions/create-follow-up-task"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? "Could not create task.")
      await refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Task creation failed.")
    } finally {
      setTaskLoading(null)
    }
  }

  async function confirmOpportunity() {
    if (!oppDraft) return
    setTaskLoading("opportunity-save")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/replies/workflow-actions/create-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: oppDraft.leadId,
          title: oppTitle.trim(),
          amount: Number.parseFloat(oppAmount) || 0,
          stageKey: oppDraft.stageKey,
          forecastCategory: oppDraft.forecastCategory,
          priority: oppDraft.priority,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? "Could not create opportunity.")
      setOppOpen(false)
      await refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Opportunity creation failed.")
    } finally {
      setTaskLoading(null)
    }
  }

  if (!selectedThread || !leadId) return null

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start"
            disabled={Boolean(actionLoading)}
            onClick={() => void runAction("assign", assignOwner)}
          >
            <UserPlus className="mr-1.5 size-3.5" />
            Assign
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
            <Link href={`/admin/growth/calls/workspace?leadId=${encodeURIComponent(leadId)}`}>
              <Phone className="mr-1.5 size-3.5" />
              Call
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
            <a href="#inbox-reply-draft">
              <Reply className="mr-1.5 size-3.5" />
              Reply
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start"
            disabled={Boolean(taskLoading)}
            onClick={() => void createTask("follow_up")}
          >
            <ClipboardList className="mr-1.5 size-3.5" />
            Create Task
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start"
            disabled={Boolean(taskLoading)}
            onClick={() => void openOpportunityDialog()}
          >
            <Target className="mr-1.5 size-3.5" />
            Create Opportunity
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start"
            disabled={Boolean(actionLoading)}
            onClick={() => void runAction("archive", archiveThread)}
          >
            <Archive className="mr-1.5 size-3.5" />
            Archive
          </Button>
        </div>
      </div>

      <Dialog open={oppOpen} onOpenChange={setOppOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review opportunity</DialogTitle>
            <DialogDescription>
              Pre-filled from reply intelligence. Confirm details before creating — no automatic pipeline changes.
            </DialogDescription>
          </DialogHeader>
          {oppDraft ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="inbox-quick-opp-title">Title</Label>
                <Input id="inbox-quick-opp-title" value={oppTitle} onChange={(event) => setOppTitle(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="inbox-quick-opp-amount">Amount (USD)</Label>
                <Input
                  id="inbox-quick-opp-amount"
                  value={oppAmount}
                  onChange={(event) => setOppAmount(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOppOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={taskLoading === "opportunity-save"} onClick={() => void confirmOpportunity()}>
              Create opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
