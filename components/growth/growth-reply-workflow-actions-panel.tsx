"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, Sparkles, Phone, Target, X, Mail } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthReplyOpportunityDraft,
  GrowthReplyWorkflowActionDashboard,
  GrowthReplyWorkflowActionRecord,
  GrowthSequenceExitCandidateRecord,
} from "@/lib/growth/reply-intelligence/workflow-actions-types"
import { GrowthRevenueWorkflowWorkspacePanel } from "@/components/growth/growth-revenue-workflow-workspace-panel"
import { GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER } from "@/lib/growth/reply-intelligence/workflow-actions-types"

type FilterKey = "all" | "interested" | "call_task" | "follow_up" | "opportunity"

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All pending",
  interested: "Interested",
  call_task: "Call tasks",
  follow_up: "Follow-ups",
  opportunity: "Opportunities",
}

type WorkflowActionType =
  | "mark_interested"
  | "create_call_task"
  | "create_follow_up_task"
  | "create_opportunity"
  | "dismiss"

function OpportunityReviewDialog({
  open,
  onOpenChange,
  draft,
  workflowActionId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: GrowthReplyOpportunityDraft | null
  workflowActionId?: string | null
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("0")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft) return
    setTitle(draft.title)
    setAmount(String(draft.amount))
    setError(null)
  }, [draft])

  async function handleConfirm() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/replies/workflow-actions/create-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: draft.leadId,
          replyId: draft.replyId,
          workflowActionId: workflowActionId ?? undefined,
          title: title.trim(),
          amount: Number.parseFloat(amount) || 0,
          stageKey: draft.stageKey,
          forecastCategory: draft.forecastCategory,
          priority: draft.priority,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Could not create opportunity.")
      onOpenChange(false)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review opportunity</DialogTitle>
          <DialogDescription>
            Pre-filled from reply intelligence. Confirm details before creating — no automatic pipeline changes.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="opp-company">Company</Label>
              <Input id="opp-company" value={draft.companyName} readOnly className="mt-1 bg-muted/40" />
            </div>
            <div>
              <Label htmlFor="opp-title">Title</Label>
              <Input id="opp-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="opp-amount">Amount (USD)</Label>
              <Input id="opp-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Reply context</Label>
              <Textarea value={draft.summary} readOnly className="mt-1 min-h-[80px] bg-muted/40 text-sm" />
            </div>
            {draft.recommendedOperatorAction ? (
              <p className="text-xs text-muted-foreground">Suggested: {draft.recommendedOperatorAction}</p>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Confirm & create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowActionRow({
  item,
  compact,
  onAction,
  acting,
}: {
  item: GrowthReplyWorkflowActionRecord
  compact?: boolean
  onAction: (type: WorkflowActionType) => void
  acting: string | null
}) {
  return (
    <li className="rounded-lg border border-border px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.companyName ?? "Unknown company"}</p>
          <p className="text-muted-foreground">{item.title}</p>
          {!compact ? <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p> : null}
          {item.replyBodyPreview ? (
            <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">"{item.replyBodyPreview}"</p>
          ) : null}
        </div>
        <GrowthBadge label={item.actionType.replace(/_/g, " ")} tone="attention" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(item.category === "interested" || item.actionType === "mark_interested") && (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={acting !== null}
            onClick={() => onAction("mark_interested")}
          >
            {acting === "mark_interested" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
            Mark interested
          </Button>
        )}
        {(item.category === "call_task" || item.replyNextAction === "call_prospect") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting !== null}
            onClick={() => onAction("create_call_task")}
          >
            {acting === "create_call_task" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Phone className="mr-1 size-3.5" />}
            Create call task
          </Button>
        )}
        {(item.category === "follow_up" || item.actionType === "create_follow_up_task") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting !== null}
            onClick={() => onAction("create_follow_up_task")}
          >
            {acting === "create_follow_up_task" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Mail className="mr-1 size-3.5" />}
            Create follow up
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={acting !== null}
          onClick={() => onAction("create_opportunity")}
        >
          {acting === "create_opportunity" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Target className="mr-1 size-3.5" />}
          Create opportunity
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={acting !== null} onClick={() => onAction("dismiss")}>
          <X className="mr-1 size-3.5" />
          Dismiss
        </Button>
        <Link href={`/admin/growth/leads?leadId=${item.leadId}`} className="text-xs font-medium text-indigo-600 hover:underline self-center">
          Open lead
        </Link>
      </div>
    </li>
  )
}

function SequenceExitRow({
  item,
  onResolve,
  acting,
}: {
  item: GrowthSequenceExitCandidateRecord
  onResolve: (resolution: "resume" | "keep_paused" | "exit") => void
  acting: string | null
}) {
  return (
    <li className="rounded-lg border border-border px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.companyName ?? "Unknown company"}</p>
          <p className="text-muted-foreground">{item.sequenceName ?? "Active sequence"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reason: {item.reason.replace(/_/g, " ")}</p>
          {item.replySummary ? <p className="mt-1 text-xs italic">Reply: {item.replySummary}</p> : null}
        </div>
        <GrowthBadge label={item.enrollmentStatus ?? "unknown"} tone="neutral" />
      </div>
      {item.operatorResolution ? (
        <p className="mt-2 text-xs text-muted-foreground">Resolved: {item.operatorResolution.replace(/_/g, " ")}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={acting === item.id} onClick={() => onResolve("resume")}>
            Resume sequence
          </Button>
          <Button type="button" size="sm" variant="default" disabled={acting === item.id} onClick={() => onResolve("keep_paused")}>
            Keep paused
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={acting === item.id} onClick={() => onResolve("exit")}>
            Exit sequence
          </Button>
        </div>
      )}
    </li>
  )
}

export function GrowthReplyWorkflowActionsPanel({
  leadId,
  compact = false,
  showSequenceExit = true,
  title = "Reply workflow actions",
}: {
  leadId?: string
  compact?: boolean
  showSequenceExit?: boolean
  title?: string
}) {
  const [dashboard, setDashboard] = useState<GrowthReplyWorkflowActionDashboard | null>(null)
  const [items, setItems] = useState<GrowthReplyWorkflowActionRecord[]>([])
  const [exitCandidates, setExitCandidates] = useState<GrowthSequenceExitCandidateRecord[]>([])
  const [filter, setFilter] = useState<FilterKey>("all")
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [exitActing, setExitActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [oppDraft, setOppDraft] = useState<GrowthReplyOpportunityDraft | null>(null)
  const [oppOpen, setOppOpen] = useState(false)
  const [opportunityWorkflowActionId, setOpportunityWorkflowActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status: "pending_review", limit: "50" })
      if (leadId) params.set("leadId", leadId)
      const exitParams = new URLSearchParams({ pendingOnly: "true", limit: "20" })
      if (leadId) exitParams.set("leadId", leadId)

      const [dashRes, itemsRes, exitRes] = await Promise.all([
        fetch("/api/platform/growth/replies/workflow-actions/dashboard", { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/workflow-actions?${params.toString()}`, { cache: "no-store" }),
        showSequenceExit
          ? fetch(`/api/platform/growth/replies/sequence-exit-candidates?${exitParams.toString()}`, { cache: "no-store" })
          : Promise.resolve(null),
      ])

      const dashData = (await dashRes.json().catch(() => ({}))) as { dashboard?: GrowthReplyWorkflowActionDashboard }
      const itemsData = (await itemsRes.json().catch(() => ({}))) as { items?: GrowthReplyWorkflowActionRecord[] }
      if (!dashRes.ok || !itemsRes.ok) throw new Error("Could not load workflow actions.")

      setDashboard(dashData.dashboard ?? null)
      setItems(itemsData.items ?? [])

      if (exitRes) {
        const exitData = (await exitRes.json().catch(() => ({}))) as { items?: GrowthSequenceExitCandidateRecord[] }
        if (exitRes.ok) setExitCandidates(exitData.items ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId, showSequenceExit])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = items.filter((item) => {
    if (filter === "all") return true
    return item.category === filter
  })

  async function runAction(item: GrowthReplyWorkflowActionRecord, type: WorkflowActionType) {
    setActing(type)
    setError(null)
    try {
      if (type === "dismiss") {
        const res = await fetch("/api/platform/growth/replies/workflow-actions/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowActionId: item.id }),
        })
        if (!res.ok) throw new Error("Dismiss failed.")
      } else if (type === "mark_interested") {
        const res = await fetch("/api/platform/growth/replies/workflow-actions/mark-interested", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: item.leadId, replyId: item.replyId, workflowActionId: item.id }),
        })
        if (!res.ok) throw new Error("Mark interested failed.")
      } else if (type === "create_call_task") {
        const res = await fetch("/api/platform/growth/replies/workflow-actions/create-call-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: item.leadId, replyId: item.replyId, workflowActionId: item.id }),
        })
        if (!res.ok) throw new Error("Create call task failed.")
      } else if (type === "create_follow_up_task") {
        const res = await fetch("/api/platform/growth/replies/workflow-actions/create-follow-up-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: item.leadId, replyId: item.replyId, workflowActionId: item.id }),
        })
        if (!res.ok) throw new Error("Create follow up failed.")
      } else {
        setOpportunityWorkflowActionId(item.category === "opportunity" ? item.id : null)
        const params = new URLSearchParams({ leadId: item.leadId })
        if (item.replyId) params.set("replyId", item.replyId)
        const res = await fetch(`/api/platform/growth/replies/workflow-actions/opportunity-draft?${params.toString()}`, {
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as { draft?: GrowthReplyOpportunityDraft; error?: string }
        if (!res.ok) throw new Error(data.error ?? "Could not load opportunity draft.")
        if ((data.draft as GrowthReplyOpportunityDraft)?.existingOpportunityId) {
          throw new Error("Opportunity already exists for this lead.")
        }
        setOppDraft(data.draft ?? null)
        setOppOpen(true)
        setActing(null)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  async function resolveExit(eventId: string, resolution: "resume" | "keep_paused" | "exit") {
    setExitActing(eventId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/replies/sequence-exit-candidates/${eventId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      })
      if (!res.ok) throw new Error("Could not resolve sequence exit candidate.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed.")
    } finally {
      setExitActing(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading workflow actions…
      </div>
    )
  }

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER}>
      <GrowthEngineCard
        title={title}
        subtitle="Human-confirmed actions from reply intelligence — no automatic execution."
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
              <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
                {FILTER_LABELS[key]}
              </Button>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
            Refresh
          </Button>
        </div>

        {dashboard && !compact ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <StatTile label="Pending review" value={dashboard.pendingReviewCount} />
            <StatTile label="Interested" value={dashboard.interestedCount} />
            <StatTile label="Call tasks" value={dashboard.callTaskCount} />
            <StatTile label="Follow-ups" value={dashboard.followUpCount} />
            <StatTile label="Opportunities" value={dashboard.opportunityCount} />
            <StatTile label="Sequence exit" value={dashboard.sequenceExitCount} />
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending workflow actions match this filter.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <WorkflowActionRow
                key={item.id}
                item={item}
                compact={compact}
                acting={acting}
                onAction={(type) => void runAction(item, type)}
              />
            ))}
          </ul>
        )}

        {!compact ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href="/admin/growth/replies/workflow" className="font-medium text-indigo-600 hover:underline">
              Open full Workflow Action Center
            </Link>
          </p>
        ) : null}
      </GrowthEngineCard>

      {showSequenceExit && exitCandidates.length > 0 ? (
        <GrowthEngineCard title="Sequence exit review" subtitle="Inbound reply on active sequence — operator decides next step.">
          <ul className="space-y-2">
            {exitCandidates.map((item) => (
              <SequenceExitRow key={item.id} item={item} acting={exitActing} onResolve={(r) => void resolveExit(item.id, r)} />
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {leadId ? <GrowthRevenueWorkflowWorkspacePanel leadId={leadId} compact /> : null}

      <OpportunityReviewDialog
        open={oppOpen}
        onOpenChange={setOppOpen}
        draft={oppDraft}
        workflowActionId={opportunityWorkflowActionId}
        onCreated={() => {
          setOpportunityWorkflowActionId(null)
          void load()
        }}
      />
    </div>
  )
}

export function GrowthReplyWorkflowActionCenter() {
  return <GrowthReplyWorkflowActionsPanel showSequenceExit title="Workflow Action Center" />
}
