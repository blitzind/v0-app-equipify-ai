"use client"

import { useState } from "react"
import { Brain, Check, Clock3, History, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceConversationMemoryDraftPublicView } from "@/lib/voice/intelligence/types"
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceRelationshipMemoryPanel({
  relationshipMemory,
  pendingDrafts = [],
  sessionPhone,
  contactName,
  leadId,
  onRefresh,
}: {
  relationshipMemory: VoiceRelationshipMemoryWorkspaceSnapshot | null
  pendingDrafts?: VoiceConversationMemoryDraftPublicView[]
  sessionPhone?: string | null
  contactName?: string | null
  leadId?: string | null
  onRefresh?: () => Promise<void>
}) {
  const [actingDraftId, setActingDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timelineFilter, setTimelineFilter] = useState<"all" | "objections" | "calls">("all")

  if (!relationshipMemory?.profile) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground"
        data-voice-relationship-memory-qa-marker={VOICE_RELATIONSHIP_MEMORY_QA_MARKER}
      >
        <History className="mx-auto mb-2 size-4" />
        Cross-call relationship memory appears once a phone number is linked to prior interactions.
      </div>
    )
  }

  const profile = relationshipMemory.profile
  const filteredTimeline = relationshipMemory.timeline.filter((item) => {
    if (timelineFilter === "all") return true
    if (timelineFilter === "objections") return item.kind === "objection"
    if (timelineFilter === "calls") return item.kind === "call"
    return true
  })

  async function reviewDraft(draftId: string, action: "accept" | "reject" | "merge") {
    setActingDraftId(draftId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/memory-drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          primaryPhoneNumber: sessionPhone,
          primaryContactName: contactName,
          leadId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Review failed.")
      await onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.")
    } finally {
      setActingDraftId(null)
    }
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3 dark:border-white/5"
      data-voice-relationship-memory-qa-marker={VOICE_RELATIONSHIP_MEMORY_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Relationship Memory</h4>
        </div>
        <GrowthBadge label={profile.relationshipStatus.replace(/_/g, " ")} tone="healthy" />
      </div>

      <p className="text-xs text-muted-foreground">{relationshipMemory.teamVisibilityMessage}</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Calls</p>
          <p className="text-sm font-semibold tabular-nums">{profile.totalCallCount}</p>
        </div>
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Objections</p>
          <p className="text-sm font-semibold tabular-nums">{profile.objectionCount}</p>
        </div>
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Sentiment</p>
          <p className="text-xs font-semibold capitalize">{profile.sentimentTrend}</p>
        </div>
      </div>

      {relationshipMemory.priorObjections.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous objections</p>
          <ul className="space-y-1">
            {relationshipMemory.priorObjections.slice(0, 3).map((event) => (
              <li key={event.id} className="rounded-md bg-muted/30 px-2 py-1 text-xs">
                {event.evidenceText.slice(0, 100)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {relationshipMemory.prioritizedInsights.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unresolved priorities</p>
          <ul className="space-y-1">
            {relationshipMemory.prioritizedInsights
              .filter((item) => item.unresolved)
              .slice(0, 2)
              .map((item) => (
                <li key={item.id} className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
                  {item.summary}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {pendingDrafts.length > 0 ? (
        <div className="space-y-2 border-t border-border/50 pt-2 dark:border-white/5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Memory drafts — review required
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {pendingDrafts.slice(0, 3).map((draft) => (
            <div key={draft.id} className="rounded-lg border border-border/50 px-2 py-2 dark:border-white/5">
              <p className="text-xs font-medium">{draft.draftLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{draft.evidenceText.slice(0, 120)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={actingDraftId === draft.id}
                  onClick={() => void reviewDraft(draft.id, "accept")}
                >
                  {actingDraftId === draft.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="mr-1 size-3" />}
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={actingDraftId === draft.id}
                  onClick={() => void reviewDraft(draft.id, "reject")}
                >
                  <X className="mr-1 size-3" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Clock3 className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship timeline</p>
          <div className="flex gap-1">
            {(["all", "objections", "calls"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] capitalize",
                  timelineFilter === filter ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
                onClick={() => setTimelineFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        {filteredTimeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timeline events in current window.</p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-y-auto overscroll-contain">
            {filteredTimeline.slice(0, relationshipMemory.timelineLimit).map((item) => (
              <li key={item.id} className="rounded-md bg-muted/20 px-2 py-1 text-xs">
                <span className="text-muted-foreground">{new Date(item.occurredAt).toLocaleDateString()} · </span>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground"> — {item.evidenceText.slice(0, 80)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
