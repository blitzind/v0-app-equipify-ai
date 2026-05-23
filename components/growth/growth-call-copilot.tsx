"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Loader2, Phone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthCallCopilotBriefing, GrowthCallCopilotSession } from "@/lib/growth/call-copilot-types"
import {
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS,
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS,
} from "@/lib/growth/call-copilot-types"
import { GROWTH_LEAD_CALL_DISPOSITIONS } from "@/lib/growth/call-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthCallCopilotProps = {
  lead: GrowthLead
}

function statusTone(status: GrowthCallCopilotSession["status"]): "healthy" | "attention" | "neutral" {
  if (status === "in_call") return "attention"
  if (status === "completed") return "healthy"
  return "neutral"
}

function getBriefing(session: GrowthCallCopilotSession | null): GrowthCallCopilotBriefing | null {
  if (!session?.callContextSnapshot?.briefing) return null
  return session.callContextSnapshot.briefing as GrowthCallCopilotBriefing
}

export function GrowthCallCopilot({ lead }: GrowthCallCopilotProps) {
  const [sessions, setSessions] = useState<GrowthCallCopilotSession[]>([])
  const [activeSession, setActiveSession] = useState<GrowthCallCopilotSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [objectionText, setObjectionText] = useState("")
  const [liveNotes, setLiveNotes] = useState("")

  const briefing = useMemo(() => getBriefing(activeSession), [activeSession])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/call-copilot/sessions`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sessions?: GrowthCallCopilotSession[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load call copilot sessions.")
      const list = data.sessions ?? []
      setSessions(list)
      const current =
        list.find((session) => session.status === "pre_call" || session.status === "in_call") ?? list[0] ?? null
      setActiveSession(current)
      setLiveNotes(current?.liveNotes ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function patchSession(body: Record<string, unknown>) {
    if (!activeSession) return
    setActing(String(body.action))
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/call-copilot/sessions/${activeSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: GrowthCallCopilotSession
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) throw new Error(data.message ?? "Action failed.")
      setActiveSession(data.session)
      setSessions((prev) => [data.session!, ...prev.filter((entry) => entry.id !== data.session!.id)])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  async function createPrep() {
    setActing("create")
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/call-copilot/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callGoal: lead.nextBestActionReason ?? null }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: GrowthCallCopilotSession
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) throw new Error(data.message ?? "Could not create briefing.")
      setActiveSession(data.session)
      setSessions((prev) => [data.session!, ...prev])
      setLiveNotes("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActing(null)
    }
  }

  async function submitObjection() {
    if (!activeSession || !objectionText.trim()) return
    setActing("objection")
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/call-copilot/sessions/${activeSession.id}/objection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectionText }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: GrowthCallCopilotSession
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) throw new Error(data.message ?? "Objection response failed.")
      setActiveSession(data.session)
      setObjectionText("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Objection failed.")
    } finally {
      setActing(null)
    }
  }

  async function completeSession() {
    if (!activeSession) return
    setActing("complete")
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/call-copilot/sessions/${activeSession.id}/complete`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: GrowthCallCopilotSession
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) throw new Error(data.message ?? "Complete failed.")
      setActiveSession(data.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete failed.")
    } finally {
      setActing(null)
    }
  }

  async function approveSummary() {
    if (!activeSession) return
    setActing("approve_summary")
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/call-copilot/sessions/${activeSession.id}/approve-summary`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; session?: GrowthCallCopilotSession }
      if (data.session) setActiveSession(data.session)
    } finally {
      setActing(null)
    }
  }

  async function approveDisposition(disposition?: string) {
    if (!activeSession) return
    setActing("approve_disposition")
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/call-copilot/sessions/${activeSession.id}/approve-disposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disposition }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; session?: GrowthCallCopilotSession }
      if (data.session) setActiveSession(data.session)
    } finally {
      setActing(null)
    }
  }

  const collapsedSummary = activeSession
    ? `${activeSession.status.replace(/_/g, " ")} · confidence ${activeSession.callOutcomeConfidence}`
    : "No active session"

  return (
    <GrowthCollapsibleEngineCard
      title="Call Copilot"
      icon={<Phone className="size-4" />}
      headerAside={collapsedSummary}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Pre-call briefing and in-call guidance. Manual signals only — disposition requires human approval.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : null}

        {!loading && !activeSession ? (
          <Button type="button" size="sm" disabled={acting !== null} onClick={() => void createPrep()}>
            {acting === "create" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
            Prepare Call Briefing
          </Button>
        ) : null}

        {activeSession ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label={activeSession.status.replace(/_/g, " ")} tone={statusTone(activeSession.status)} />
              {briefing?.highRiskCall ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  <AlertTriangle className="size-3" />
                  High Risk Call
                </span>
              ) : null}
              <GrowthBadge label={`Outcome ${activeSession.callOutcomeConfidence}`} tone="neutral" />
            </div>

            {briefing ? (
              <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who to call</p>
                  <p className="font-medium">
                    {briefing.whoToCall.contactName ?? "Unknown contact"} · {briefing.whoToCall.companyName}
                  </p>
                  {briefing.whoToCall.phone ? (
                    <p className="text-muted-foreground">{briefing.whoToCall.phone}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why now</p>
                  <p>{briefing.whyNow}</p>
                </div>
                {briefing.likelyObjections.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely objections</p>
                    <ul className="mt-1 list-disc pl-4">
                      {briefing.likelyObjections.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opening line</p>
                  <p>{briefing.openingLine}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended CTA</p>
                  <p>{briefing.recommendedCta}</p>
                </div>
                {briefing.doNotSay.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Do not say</p>
                    <ul className="mt-1 list-disc pl-4 text-rose-700">
                      {briefing.doNotSay.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {briefing.riskWarnings.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Risk warnings</p>
                    <ul className="mt-1 list-disc pl-4 text-amber-900">
                      {briefing.riskWarnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {activeSession.status === "pre_call" ? (
                <Button type="button" size="sm" disabled={acting !== null} onClick={() => void patchSession({ action: "start_call" })}>
                  Start Call
                </Button>
              ) : null}
              {activeSession.status === "pre_call" || activeSession.status === "in_call" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={acting !== null}
                  onClick={() => void patchSession({ action: "discard" })}
                >
                  Discard
                </Button>
              ) : null}
            </div>

            {activeSession.status === "in_call" ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Live notes</p>
                  <Textarea
                    value={liveNotes}
                    onChange={(event) => setLiveNotes(event.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={acting !== null}
                    onClick={() => void patchSession({ action: "update_notes", liveNotes })}
                  >
                    Save Notes
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Buying signals</p>
                  <div className="flex flex-wrap gap-2">
                    {GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS.map((key) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting !== null}
                        onClick={() =>
                          void patchSession({ action: "capture_buying_signal", signalKey: key })
                        }
                      >
                        {GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS[key]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Commitment signals</p>
                  <div className="flex flex-wrap gap-2">
                    {GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS.map((key) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting !== null}
                        onClick={() =>
                          void patchSession({ action: "capture_commitment_signal", signalKey: key })
                        }
                      >
                        {GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS[key]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual objection</p>
                  <Textarea
                    value={objectionText}
                    onChange={(event) => setObjectionText(event.target.value)}
                    placeholder="Prospect said…"
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    disabled={acting !== null || !objectionText.trim()}
                    onClick={() => void submitObjection()}
                  >
                    {acting === "objection" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 size-3.5" />
                    )}
                    Get Response
                  </Button>
                </div>

                {activeSession.detectedObjections.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {activeSession.detectedObjections.map((entry) => (
                      <li key={entry.id} className="rounded-md border p-2">
                        <p className="font-medium">{entry.input}</p>
                        {entry.response ? (
                          <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{entry.response}</pre>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Button type="button" size="sm" disabled={acting !== null} onClick={() => void completeSession()}>
                  Complete Call
                </Button>
              </>
            ) : null}

            {activeSession.status === "completed" ? (
              <div className="space-y-3">
                {activeSession.postCallSummary ? (
                  <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                    {activeSession.postCallSummary}
                  </pre>
                ) : null}
                {activeSession.suggestedDisposition ? (
                  <p className="text-sm">
                    Suggested disposition:{" "}
                    <span className="font-medium capitalize">
                      {activeSession.suggestedDisposition.replace(/_/g, " ")}
                    </span>
                  </p>
                ) : null}
                {!activeSession.summaryApprovedAt ? (
                  <Button type="button" size="sm" variant="outline" disabled={acting !== null} onClick={() => void approveSummary()}>
                    <Check className="mr-1 size-3.5" />
                    Approve Summary
                  </Button>
                ) : (
                  <GrowthBadge label="Summary approved" tone="healthy" />
                )}
                {!activeSession.dispositionApprovedAt ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={acting !== null || !activeSession.summaryApprovedAt}
                      onClick={() => void approveDisposition(activeSession.suggestedDisposition ?? undefined)}
                    >
                      Approve Suggested Disposition
                    </Button>
                    {GROWTH_LEAD_CALL_DISPOSITIONS.map((disposition) => (
                      <Button
                        key={disposition}
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={acting !== null || !activeSession.summaryApprovedAt}
                        onClick={() => void approveDisposition(disposition)}
                      >
                        {disposition.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <GrowthBadge label="Disposition approved" tone="healthy" />
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {sessions.length > 1 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Session history</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {sessions.slice(0, 5).map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="text-left hover:text-foreground"
                    onClick={() => {
                      setActiveSession(session)
                      setLiveNotes(session.liveNotes)
                    }}
                  >
                    {new Date(session.createdAt).toLocaleString()} · {session.status} · {session.callOutcomeConfidence}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
