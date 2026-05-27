"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Loader2, Send, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE,
  GROWTH_AI_REPLY_DRAFTING_QA_MARKER,
  type GrowthReplyDraftEvent,
  type GrowthReplyDraftView,
  replyDraftStatusLabel,
} from "@/lib/growth/replies/reply-draft-types"

const RISK_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  low: "healthy",
  medium: "attention",
  high: "critical",
  blocked: "blocked",
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  discarded: "neutral",
  sent: "healthy",
  blocked: "blocked",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DraftDetailPayload = {
  ok?: boolean
  draft?: GrowthReplyDraftView
  events?: GrowthReplyDraftEvent[]
  message?: string
}

type DraftListPayload = {
  ok?: boolean
  drafts?: GrowthReplyDraftView[]
  message?: string
}

type Props = {
  threadId: string | null
  disabled?: boolean
}

export function GrowthReplyDraftingPanel({ threadId, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<GrowthReplyDraftView | null>(null)
  const [events, setEvents] = useState<GrowthReplyDraftEvent[]>([])
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [tone, setTone] = useState("professional")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const playbookInfluence = useMemo(() => {
    const raw = draft?.metadata?.playbook_influence
    return Array.isArray(raw) ? raw.map((entry) => String(entry)) : []
  }, [draft?.metadata?.playbook_influence])

  const complianceFlags = useMemo(() => {
    const raw = draft?.metadata?.compliance_flags
    return Array.isArray(raw) ? raw.map((entry) => String(entry)) : []
  }, [draft?.metadata?.compliance_flags])

  const loadDraft = useCallback(async (selectedThreadId: string) => {
    setLoading(true)
    setError(null)
    try {
      const listResponse = await fetch(`/api/platform/growth/replies/drafts?threadId=${selectedThreadId}&limit=5`)
      const listPayload = (await listResponse.json()) as DraftListPayload
      if (!listResponse.ok) throw new Error(listPayload.message ?? "Could not load reply drafts.")

      const latest = (listPayload.drafts ?? []).find((entry) => entry.status !== "discarded") ?? listPayload.drafts?.[0] ?? null
      if (!latest) {
        setDraft(null)
        setEvents([])
        setDraftSubject("")
        setDraftBody("")
        setTone("professional")
        return
      }

      const detailResponse = await fetch(`/api/platform/growth/replies/drafts/${latest.id}`)
      const detailPayload = (await detailResponse.json()) as DraftDetailPayload
      if (!detailResponse.ok) throw new Error(detailPayload.message ?? "Could not load reply draft detail.")

      const nextDraft = detailPayload.draft ?? latest
      setDraft(nextDraft)
      setEvents(detailPayload.events ?? [])
      setDraftSubject(nextDraft.draftSubject ?? "")
      setDraftBody(nextDraft.draftBody ?? "")
      setTone(nextDraft.tone ?? "professional")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reply drafting panel.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!threadId) {
      setDraft(null)
      setEvents([])
      return
    }
    void loadDraft(threadId)
  }, [loadDraft, threadId])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      if (threadId) await loadDraft(threadId)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Reply draft action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function generateDraft() {
    if (!threadId) throw new Error("Select a thread first.")
    const response = await fetch("/api/platform/growth/replies/drafts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inboxThreadId: threadId }),
    })
    const payload = (await response.json()) as DraftDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not generate reply draft.")
  }

  async function saveDraftEdits() {
    if (!draft) throw new Error("No draft to update.")
    const response = await fetch(`/api/platform/growth/replies/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftSubject, draftBody, tone }),
    })
    const payload = (await response.json()) as DraftDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not save draft edits.")
  }

  async function approveDraft() {
    if (!draft) throw new Error("No draft to approve.")
    const response = await fetch(`/api/platform/growth/replies/drafts/${draft.id}/approve`, { method: "POST" })
    const payload = (await response.json()) as DraftDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not approve draft.")
  }

  async function discardDraft() {
    if (!draft) throw new Error("No draft to discard.")
    const response = await fetch(`/api/platform/growth/replies/drafts/${draft.id}/discard`, { method: "POST" })
    const payload = (await response.json()) as DraftDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not discard draft.")
  }

  async function sendDraft() {
    if (!draft) throw new Error("No draft to send.")
    const response = await fetch(`/api/platform/growth/replies/drafts/${draft.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanApproved: true, humanApprovalConfirmed: true }),
    })
    const payload = (await response.json()) as DraftDetailPayload & { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not send approved reply.")
  }

  const canEdit = draft?.status === "draft" || draft?.status === "approved"
  const canApprove = draft?.status === "draft" && draft.riskLevel !== "blocked"
  const canSend = draft?.status === "approved"
  const canDiscard = draft && ["draft", "approved"].includes(draft.status)

  if (!threadId) {
    return (
      <GrowthEngineCard title="Reply Drafting">
        <p className="text-sm text-muted-foreground">Select a thread to generate AI reply drafts.</p>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Reply Drafting">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_AI_REPLY_DRAFTING_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE}</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading reply drafts…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled || Boolean(actionLoading)}
            onClick={() => void runAction("generate", generateDraft)}
          >
            <Sparkles className="mr-1.5 size-3.5" />
            Generate Reply Draft
          </Button>
          {draft && canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || Boolean(actionLoading)}
              onClick={() => void runAction("save", saveDraftEdits)}
            >
              Save Edits
            </Button>
          ) : null}
          {canApprove ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || Boolean(actionLoading)}
              onClick={() => void runAction("approve", approveDraft)}
            >
              <Check className="mr-1.5 size-3.5" />
              Approve Draft
            </Button>
          ) : null}
          {canDiscard ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || Boolean(actionLoading)}
              onClick={() => void runAction("discard", discardDraft)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Discard Draft
            </Button>
          ) : null}
          {canSend ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled || Boolean(actionLoading)}
              onClick={() => void runAction("send", sendDraft)}
            >
              <Send className="mr-1.5 size-3.5" />
              Send Approved Reply
            </Button>
          ) : null}
        </div>

        {draft ? (
          <>
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={replyDraftStatusLabel(draft.status)} tone={STATUS_TONE[draft.status] ?? "neutral"} />
              <GrowthBadge label={`Risk: ${draft.riskLevel}`} tone={RISK_TONE[draft.riskLevel] ?? "neutral"} />
              {draft.classification ? <GrowthBadge label={draft.classification} tone="neutral" /> : null}
              <GrowthBadge label={`Confidence ${draft.confidence}%`} tone="neutral" />
            </div>

            {complianceFlags.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Compliance warning: {complianceFlags.join(", ")}
              </div>
            ) : null}

            {playbookInfluence.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <p className="font-medium">Playbook influence</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                  {playbookInfluence.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="reply-draft-subject">Subject</Label>
              <Input
                id="reply-draft-subject"
                value={draftSubject}
                onChange={(event) => setDraftSubject(event.target.value)}
                disabled={!canEdit || disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-draft-tone">Tone</Label>
              <Input
                id="reply-draft-tone"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                disabled={!canEdit || disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-draft-body">Draft body</Label>
              <Textarea
                id="reply-draft-body"
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={8}
                disabled={!canEdit || disabled}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Timeline events</p>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No draft events yet.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={event.eventType.replace(/_/g, " ")} tone="neutral" />
                      <span className="font-medium">{event.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                    </div>
                    {event.description ? <p className="mt-1 text-xs text-muted-foreground">{event.description}</p> : null}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No reply draft on this thread yet. Generate a draft for human review — approval does not send automatically.
          </p>
        )}
      </div>
    </GrowthEngineCard>
  )
}
