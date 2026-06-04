"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { HandHelping, Loader2, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE,
  GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER,
  type GrowthInboxOwnerSuggestion,
  type GrowthInboxTeamDashboard,
  type GrowthInboxTeamQueueView,
  type GrowthInboxThreadOwnerHistoryEntry,
  type GrowthInboxThreadQueueItem,
  inboxOwnerActionLabel,
  inboxTeamQueueViewLabel,
} from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"
import { formatInboxThreadAgeLabel } from "@/lib/growth/inbox-team-ownership/inbox-sla-tracker"
import { displayInboxSubject } from "@/lib/growth/inbox/inbox-display-text"

const SLA_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral"> = {
  ok: "healthy",
  at_risk: "attention",
  overdue: "critical",
}

type TeamDashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxTeamDashboard
  message?: string
}

type ThreadDetailPayload = {
  ownerHistory?: GrowthInboxThreadOwnerHistoryEntry[]
  ownerSuggestion?: GrowthInboxOwnerSuggestion | null
  message?: string
}

type RepOption = { userId: string; label: string }

type Props = {
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
  disabled?: boolean
}

function QueueTable({
  items,
  selectedThreadId,
  onSelectThread,
}: {
  items: GrowthInboxThreadQueueItem[]
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No threads in this queue.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-2 py-2 font-medium">Lead</th>
            <th className="px-2 py-2 font-medium">Subject</th>
            <th className="px-2 py-2 font-medium">Owner</th>
            <th className="px-2 py-2 font-medium">Priority</th>
            <th className="px-2 py-2 font-medium">SLA</th>
            <th className="px-2 py-2 font-medium">Age</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 25).map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-b hover:bg-muted/40 ${selectedThreadId === item.id ? "bg-muted/60" : ""}`}
              onClick={() => onSelectThread(item.id)}
            >
              <td className="px-2 py-2">{item.leadLabel}</td>
              <td className="max-w-[160px] truncate px-2 py-2">{displayInboxSubject(item.subject)}</td>
              <td className="px-2 py-2">{item.ownerLabel ?? "Unassigned"}</td>
              <td className="px-2 py-2">
                <GrowthBadge label={item.priorityTier} tone={item.priorityTier === "critical" ? "critical" : "neutral"} />
              </td>
              <td className="px-2 py-2">
                <GrowthBadge label={item.slaStatus} tone={SLA_TONE[item.slaStatus] ?? "neutral"} />
              </td>
              <td className="px-2 py-2">{formatInboxThreadAgeLabel(item.lastMessageAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GrowthInboxTeamQueuePanel({ selectedThreadId, onSelectThread, disabled }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthInboxTeamDashboard | null>(null)
  const [view, setView] = useState<GrowthInboxTeamQueueView>("unassigned")
  const [ownerHistory, setOwnerHistory] = useState<GrowthInboxThreadOwnerHistoryEntry[]>([])
  const [ownerSuggestion, setOwnerSuggestion] = useState<GrowthInboxOwnerSuggestion | null>(null)
  const [handoffTargetUserId, setHandoffTargetUserId] = useState("")
  const [handoffNote, setHandoffNote] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const repOptions = useMemo<RepOption[]>(() => {
    const seen = new Set<string>()
    const options: RepOption[] = []
    for (const rep of dashboard?.reps ?? []) {
      if (!seen.has(rep.userId)) {
        seen.add(rep.userId)
        options.push(rep)
      }
    }
    if (ownerSuggestion && !seen.has(ownerSuggestion.suggestedUserId)) {
      options.unshift({ userId: ownerSuggestion.suggestedUserId, label: ownerSuggestion.suggestedUserLabel })
    }
    return options
  }, [dashboard?.reps, ownerSuggestion])

  const queueItems = useMemo(() => {
    if (!dashboard) return []
    switch (view) {
      case "my_threads":
        return dashboard.myThreads
      case "sla_risk":
        return dashboard.slaRisk
      case "aging_replies":
        return dashboard.agingReplies
      case "unassigned":
        return dashboard.unassigned
      default:
        return [...dashboard.myThreads, ...dashboard.unassigned]
    }
  }, [dashboard, view])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/inbox/team-dashboard")
      const payload = (await response.json()) as TeamDashboardPayload
      if (!response.ok) throw new Error(payload.message ?? "Could not load team queue.")
      setDashboard(payload.dashboard ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load team queue.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadThreadOwnership = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/platform/growth/inbox/thread/${threadId}`)
    const payload = (await response.json()) as ThreadDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not load thread ownership detail.")
    setOwnerHistory(payload.ownerHistory ?? [])
    setOwnerSuggestion(payload.ownerSuggestion ?? null)
    if (payload.ownerSuggestion && !handoffTargetUserId) {
      setHandoffTargetUserId(payload.ownerSuggestion.suggestedUserId)
    }
  }, [handoffTargetUserId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!selectedThreadId) {
      setOwnerHistory([])
      setOwnerSuggestion(null)
      return
    }
    void loadThreadOwnership(selectedThreadId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load owner history.")
    })
  }, [loadThreadOwnership, selectedThreadId])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      await loadDashboard()
      if (selectedThreadId) await loadThreadOwnership(selectedThreadId)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Team queue action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function claimThread() {
    if (!selectedThreadId) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThreadId}/claim`, { method: "POST" })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not claim thread.")
  }

  async function unassignThread() {
    if (!selectedThreadId) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThreadId}/unassign`, { method: "POST" })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not unassign thread.")
  }

  async function handoffThread() {
    if (!selectedThreadId) throw new Error("Select a thread first.")
    if (!handoffTargetUserId) throw new Error("Select a handoff target.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThreadId}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: handoffTargetUserId, handoffNote: handoffNote.trim() || undefined }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not hand off thread.")
    setHandoffNote("")
  }

  async function assignSuggestedOwner() {
    if (!selectedThreadId || !ownerSuggestion) throw new Error("No owner suggestion available.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThreadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId: ownerSuggestion.suggestedUserId }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not assign suggested owner.")
  }

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Team Queue">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER} tone="neutral" />
            <p className="text-xs text-muted-foreground">{GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE}</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading team queue…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="My Threads" value={String(dashboard?.counts.myThreads ?? 0)} />
            <StatTile label="Unassigned" value={String(dashboard?.counts.unassigned ?? 0)} />
            <StatTile label="SLA Risk" value={String(dashboard?.counts.slaRisk ?? 0)} />
            <StatTile label="Aging Replies" value={String(dashboard?.counts.agingReplies ?? 0)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["my_threads", "unassigned", "sla_risk", "aging_replies"] as const).map((queueView) => (
              <Button
                key={queueView}
                type="button"
                size="sm"
                variant={view === queueView ? "default" : "outline"}
                onClick={() => setView(queueView)}
              >
                {inboxTeamQueueViewLabel(queueView)}
              </Button>
            ))}
          </div>

          <QueueTable items={queueItems} selectedThreadId={selectedThreadId} onSelectThread={onSelectThread} />

          {dashboard?.settings.autoAssignEnabled ? (
            <p className="text-xs text-amber-800">Auto-assignment is enabled — human review recommended for edge cases.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Auto-assignment is off. Suggestions require explicit human action.</p>
          )}
        </div>
      </GrowthEngineCard>

      {selectedThreadId ? (
        <GrowthEngineCard title="Ownership Actions">
          <div className="space-y-4">
            {ownerSuggestion ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">Suggested owner: {ownerSuggestion.suggestedUserLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confidence {ownerSuggestion.confidence}% · {ownerSuggestion.reasons.join(", ")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={disabled || Boolean(actionLoading)}
                  onClick={() => void runAction("assign-suggested", assignSuggestedOwner)}
                >
                  <UserPlus className="mr-1.5 size-3.5" />
                  Assign Suggested Owner
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={disabled || Boolean(actionLoading)} onClick={() => void runAction("claim", claimThread)}>
                <UserPlus className="mr-1.5 size-3.5" />
                Claim Thread
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(actionLoading)} onClick={() => void runAction("unassign", unassignThread)}>
                <UserMinus className="mr-1.5 size-3.5" />
                Unassign
              </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="handoff-target">Handoff target</Label>
              <Select value={handoffTargetUserId} onValueChange={setHandoffTargetUserId}>
                <SelectTrigger id="handoff-target">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {repOptions.map((rep) => (
                    <SelectItem key={rep.userId} value={rep.userId}>
                      {rep.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handoff-note">Handoff notes</Label>
              <Textarea
                id="handoff-note"
                value={handoffNote}
                onChange={(event) => setHandoffNote(event.target.value)}
                placeholder="Context for the next owner…"
                rows={3}
              />
            </div>
            <Button type="button" variant="outline" disabled={disabled || Boolean(actionLoading) || !handoffTargetUserId} onClick={() => void runAction("handoff", handoffThread)}>
              <HandHelping className="mr-1.5 size-3.5" />
              Handoff Thread
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {selectedThreadId ? (
        <GrowthEngineCard title="Owner History">
          <div className="space-y-2">
            {ownerHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ownership history yet.</p>
            ) : (
              ownerHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={inboxOwnerActionLabel(entry.action)} tone="neutral" />
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">
                    {entry.fromUserLabel ?? "Unassigned"} → {entry.toUserLabel ?? "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">By {entry.actorLabel}</p>
                  {entry.handoffNote ? <p className="mt-1 text-xs">{entry.handoffNote}</p> : null}
                </div>
              ))
            )}
          </div>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
