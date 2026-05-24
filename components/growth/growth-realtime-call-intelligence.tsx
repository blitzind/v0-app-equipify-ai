"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, Copy, Loader2, Mic, Pause, Play, Square, StopCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type {
  GrowthLiveCoachingState,
  GrowthLiveGuidanceEvent,
  GrowthLiveGuidanceSeverity,
} from "@/lib/growth/live-guidance/live-guidance-types"
import { GROWTH_LIVE_EXECUTION_BADGE_LABELS } from "@/lib/growth/live-guidance/live-guidance-types"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeCallSpeaker,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

type GrowthRealtimeCallIntelligenceProps = {
  lead: GrowthLead
}

export function GrowthRealtimeCallIntelligence({ lead }: GrowthRealtimeCallIntelligenceProps) {
  const [sessions, setSessions] = useState<GrowthRealtimeCallSession[]>([])
  const [events, setEvents] = useState<GrowthRealtimeTranscriptEvent[]>([])
  const [coachingState, setCoachingState] = useState<GrowthLiveCoachingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speaker, setSpeaker] = useState<GrowthRealtimeCallSpeaker>("rep")
  const [draft, setDraft] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => ["preparing", "active", "paused"].includes(session.status)) ?? null,
    [sessions],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sessions?: GrowthRealtimeCallSession[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load realtime sessions.")

      const nextSessions = data.sessions ?? []
      setSessions(nextSessions)
      const current = nextSessions.find((session) => ["preparing", "active", "paused"].includes(session.status))
      if (current) {
        const detailRes = await fetch(
          `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${current.id}`,
          { cache: "no-store" },
        )
        const detail = (await detailRes.json().catch(() => ({}))) as {
          ok?: boolean
          events?: GrowthRealtimeTranscriptEvent[]
          session?: GrowthRealtimeCallSession
          coachingState?: GrowthLiveCoachingState | null
        }
        if (detailRes.ok && detail.ok) {
          setEvents(detail.events ?? [])
          setCoachingState(detail.coachingState ?? null)
          if (detail.session) {
            setSessions((prev) => prev.map((item) => (item.id === detail.session!.id ? detail.session! : item)))
          }
        }
      } else {
        setEvents([])
        setCoachingState(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function createSession() {
    setActing("create")
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create session.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActing(null)
    }
  }

  async function sessionAction(action: "start" | "pause" | "complete" | "discard") {
    if (!activeSession) return
    setActing(action)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Action failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  async function appendTranscript() {
    if (!activeSession || !draft.trim()) return
    setActing("transcript")
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}/transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            speaker,
            content: draft.trim(),
            sequenceNumber: events.length,
            timestampMs: Date.now(),
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        session?: GrowthRealtimeCallSession
        event?: GrowthRealtimeTranscriptEvent
        coachingState?: GrowthLiveCoachingState | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not append transcript.")
      if (data.session) {
        setSessions((prev) => prev.map((item) => (item.id === data.session!.id ? data.session! : item)))
      }
      if (data.event) setEvents((prev) => [...prev, data.event!])
      if (data.coachingState) setCoachingState(data.coachingState)
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcript append failed.")
    } finally {
      setActing(null)
    }
  }

  async function guidanceAction(eventId: string, action: "dismiss" | "accept") {
    if (!activeSession) return
    setActing(`${action}:${eventId}`)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}/guidance/${eventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Guidance action failed.")
      setCoachingState((prev) =>
        prev
          ? {
              ...prev,
              activeGuidance: prev.activeGuidance.filter((event) => event.id !== eventId),
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Guidance action failed.")
    } finally {
      setActing(null)
    }
  }

  async function copyRecommendation(event: GrowthLiveGuidanceEvent) {
    try {
      await navigator.clipboard.writeText(event.recommendation)
      setCopiedId(event.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError("Could not copy to clipboard.")
    }
  }

  const snapshot = activeSession?.liveSnapshot

  return (
    <GrowthCollapsibleEngineCard
      id="growth-realtime-call"
      title="Realtime Call Intelligence"
      icon={<Mic className="size-4" />}
      headerAside={
        activeSession
          ? `${activeSession.status.replace(/_/g, " ")} · ${activeSession.transcriptStatus}`
          : "Live guidance"
      }
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.realtimeCall}
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading realtime intelligence…
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!activeSession ? (
            <Button size="sm" disabled={acting !== null} onClick={() => void createSession()}>
              {acting === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              Start Live Session
            </Button>
          ) : (
            <>
              {activeSession.status === "preparing" || activeSession.status === "paused" ? (
                <Button size="sm" disabled={acting !== null} onClick={() => void sessionAction("start")}>
                  <Play className="mr-2 size-4" />
                  Go Live
                </Button>
              ) : null}
              {activeSession.status === "active" ? (
                <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void sessionAction("pause")}>
                  <Pause className="mr-2 size-4" />
                  Pause
                </Button>
              ) : null}
              <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void sessionAction("complete")}>
                <Square className="mr-2 size-4" />
                Complete
              </Button>
              <Button size="sm" variant="ghost" disabled={acting !== null} onClick={() => void sessionAction("discard")}>
                <StopCircle className="mr-2 size-4" />
                Discard
              </Button>
            </>
          )}
        </div>

        {activeSession && activeSession.status !== "completed" ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual transcript (stub provider)</p>
            <div className="flex gap-2">
              {(["rep", "prospect"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={speaker === value ? "default" : "outline"}
                  onClick={() => setSpeaker(value)}
                >
                  {value === "rep" ? "Rep" : "Prospect"}
                </Button>
              ))}
            </div>
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder="Type utterance…" />
            <Button size="sm" disabled={acting !== null || !draft.trim()} onClick={() => void appendTranscript()}>
              Add Transcript Line
            </Button>
          </div>
        ) : null}

        {snapshot && coachingState ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4 min-w-0">
              <ExecutionScoreBanner coachingState={coachingState} snapshot={snapshot} />

              {coachingState.suggestedNextQuestion ? (
                <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Suggested Next Question</p>
                  <p className="mt-2 text-base font-medium leading-relaxed">{coachingState.suggestedNextQuestion}</p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Rep talk" value={`${snapshot.talkRatio.repTalkPercent}%`} />
                <MetricCard
                  label="Prospect talk"
                  value={`${snapshot.talkRatio.prospectTalkPercent}%`}
                  hint={snapshot.talkRatio.inGoalRange ? "In 45–60% goal" : "Outside goal range"}
                />
              </div>

              <Section title="Detected objections">
                {snapshot.objections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.objections.map((entry) => (
                      <li key={entry.key} className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-muted-foreground">{entry.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Buying signals">
                {snapshot.buyingSignals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.buyingSignals.map((entry) => (
                      <li key={entry.key} className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-muted-foreground">{entry.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Missing discovery">
                {snapshot.discovery.missing.length === 0 ? (
                  <GrowthBadge label="Discovery complete" tone="healthy" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {snapshot.discovery.missing.map((area) => (
                      <GrowthBadge key={area} label={area.replace(/_/g, " ")} tone="neutral" />
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Live transcript">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transcript lines yet.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          event.speaker === "rep" ? "bg-muted/40" : "bg-background border border-border",
                        )}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {event.speaker}
                        </p>
                        <p>{event.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Guidance</p>
              {coachingState.activeGuidance.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Coaching cards appear here as the call progresses.
                </p>
              ) : (
                coachingState.activeGuidance.map((event) => (
                  <LiveGuidanceCard
                    key={event.id}
                    event={event}
                    acting={acting}
                    copied={copiedId === event.id}
                    onCopy={() => void copyRecommendation(event)}
                    onDismiss={() => void guidanceAction(event.id, "dismiss")}
                    onAccept={() => void guidanceAction(event.id, "accept")}
                  />
                ))
              )}
            </aside>
          </div>
        ) : snapshot ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Rep talk" value={`${snapshot.talkRatio.repTalkPercent}%`} />
              <MetricCard
                label="Prospect talk"
                value={`${snapshot.talkRatio.prospectTalkPercent}%`}
                hint={snapshot.talkRatio.inGoalRange ? "In 45–60% goal" : "Outside goal range"}
              />
            </div>
            <Section title="Live transcript">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transcript lines yet.</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {events.map((event) => (
                    <li key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{event.speaker}</p>
                      <p>{event.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}

function ExecutionScoreBanner({
  coachingState,
  snapshot,
}: {
  coachingState: GrowthLiveCoachingState
  snapshot: NonNullable<GrowthRealtimeCallSession["liveSnapshot"]>
}) {
  const score = coachingState.executionScore
  const discoveryPct = Math.round((snapshot.discovery.covered.length / 5) * 100)

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Call Execution Score</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{score.score}</p>
          <p className="text-sm text-emerald-300">{GROWTH_LIVE_EXECUTION_BADGE_LABELS[score.badge]}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <StatPill label="Talk ratio" value={`${snapshot.talkRatio.repTalkPercent}% rep`} />
          <StatPill label="Buying signals" value={String(snapshot.buyingSignals.length)} />
          <StatPill label="Discovery" value={`${discoveryPct}%`} />
          <StatPill label="Risk" value={coachingState.riskLevel} />
          <StatPill label="Momentum" value={coachingState.momentum.replace(/_/g, " ")} />
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="font-semibold capitalize">{value}</p>
    </div>
  )
}

function severityStyles(severity: GrowthLiveGuidanceSeverity, eventType: string) {
  if (eventType === "buying_signal_detected") {
    return "border-emerald-300 bg-emerald-50/80"
  }
  switch (severity) {
    case "high":
      return "border-rose-300 bg-rose-50/80"
    case "medium":
      return "border-amber-300 bg-amber-50/80"
    default:
      return "border-sky-300 bg-sky-50/80"
  }
}

function LiveGuidanceCard({
  event,
  acting,
  copied,
  onCopy,
  onDismiss,
  onAccept,
}: {
  event: GrowthLiveGuidanceEvent
  acting: string | null
  copied: boolean
  onCopy: () => void
  onDismiss: () => void
  onAccept: () => void
}) {
  const busy = acting?.startsWith("dismiss:") || acting?.startsWith("accept:")
  return (
    <div className={cn("rounded-xl border p-3 shadow-sm", severityStyles(event.severity, event.eventType))}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{event.title}</p>
        <GrowthBadge label={`${event.confidenceScore}%`} tone="neutral" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{event.supportingReason}</p>
      <p className="mt-2 text-sm font-medium">{event.operatorPrompt}</p>
      <p className="mt-2 rounded-lg bg-background/70 px-2 py-1.5 text-sm italic">&ldquo;{event.recommendation}&rdquo;</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={onCopy}>
          {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={acting === `dismiss:${event.id}`} onClick={onDismiss}>
          <X className="mr-1 size-3.5" />
          Dismiss
        </Button>
        <Button type="button" size="sm" disabled={acting === `accept:${event.id}`} onClick={onAccept}>
          <Check className="mr-1 size-3.5" />
          Accept
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
