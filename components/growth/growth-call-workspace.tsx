"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BarChart3, Brain, CalendarCheck, Loader2, Phone, PhoneCall, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthActiveCallPanel } from "@/components/growth/growth-active-call-panel"
import { GrowthIncomingCallPanel } from "@/components/growth/growth-incoming-call-panel"
import { GrowthNativeDialer } from "@/components/growth/growth-native-dialer"
import { GrowthPostCallWrapup } from "@/components/growth/growth-post-call-wrapup"
import { GrowthPowerDialQueue } from "@/components/growth/growth-power-dial-queue"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceDashboard,
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
  NativeDialerQueueItemPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER,
  GROWTH_NATIVE_DIALER_QA_MARKER,
  NATIVE_DIALER_PROVIDER_LABELS,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"

export function GrowthCallWorkspace() {
  const searchParams = useSearchParams()
  const initialLeadId = searchParams.get("leadId")
  const initialPhone = searchParams.get("phone")
  const initialQueueItemId = searchParams.get("queueItemId")

  const [dashboard, setDashboard] = useState<NativeCallWorkspaceDashboard | null>(null)
  const [queue, setQueue] = useState<NativeDialerQueueItemPublicView[]>([])
  const [activeSession, setActiveSession] = useState<NativeCallWorkspaceSessionPublicView | null>(null)
  const [leadContext, setLeadContext] = useState<NativeDialerLeadContext | null>(null)
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [loading, setLoading] = useState(true)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [setupWarning, setSetupWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [submittingWrapup, setSubmittingWrapup] = useState(false)
  const [dialingQueueId, setDialingQueueId] = useState<string | null>(null)
  const [answering, setAnswering] = useState(false)
  const [declining, setDeclining] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, queueRes] = await Promise.all([
        fetch("/api/platform/growth/calls/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/queue", { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        workspaceDashboard?: NativeCallWorkspaceDashboard | null
        meta?: {
          schemaReady?: boolean
          probeUncertain?: boolean
          setupMessage?: string
        }
      }
      const queueData = (await queueRes.json().catch(() => ({}))) as { queue?: NativeDialerQueueItemPublicView[] }

      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setSetupWarning(null)
        setDashboard(null)
      } else {
        setSetupMessage(null)
        setSetupWarning(
          dashData.meta?.probeUncertain ? dashData.meta.setupMessage ?? null : null,
        )
        setDashboard(dashData.workspaceDashboard ?? null)
        setActiveSession(dashData.workspaceDashboard?.activeSession ?? null)
      }
      setQueue(queueData.queue ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call workspace.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeadContext = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/calls/workspace/lead/${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { leadContext?: NativeDialerLeadContext | null }
    setLeadContext(data.leadContext ?? null)
    if (data.leadContext?.contactPhone && !phone) setPhone(data.leadContext.contactPhone)
  }, [phone])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (initialLeadId) void loadLeadContext(initialLeadId)
  }, [initialLeadId, loadLeadContext])

  const workspacePhase = useMemo(() => {
    if (activeSession?.status === "wrapping") return "wrapup"
    if (activeSession?.status === "ringing") return "incoming"
    if (activeSession && ["active", "on_hold"].includes(activeSession.status)) return "active"
    return "idle"
  }, [activeSession])

  async function startCall(input?: { phoneNumber?: string; leadId?: string | null; queueItemId?: string | null }) {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: input?.phoneNumber ?? phone,
          leadId: input?.leadId ?? initialLeadId,
          queueItemId: input?.queueItemId ?? initialQueueItemId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        session?: NativeCallWorkspaceSessionPublicView
        message?: string
      }
      if (!res.ok || !data.session) throw new Error(data.message ?? "Could not start call.")
      setActiveSession(data.session)
      if (data.session.leadId) void loadLeadContext(data.session.leadId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed.")
    } finally {
      setStarting(false)
      setDialingQueueId(null)
    }
  }

  async function endCall() {
    if (!activeSession) return
    setEnding(true)
    try {
      const res = await fetch("/api/platform/growth/calls/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView }
      if (!res.ok || !data.session) throw new Error("Could not end call.")
      setActiveSession(data.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : "End failed.")
    } finally {
      setEnding(false)
    }
  }

  async function answerCall() {
    if (!activeSession) return
    setAnswering(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView; message?: string }
      if (!res.ok || !data.session) throw new Error(data.message ?? "Could not answer call.")
      setActiveSession(data.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer failed.")
    } finally {
      setAnswering(false)
    }
  }

  async function declineCall() {
    if (!activeSession) return
    setDeclining(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView; message?: string }
      if (!res.ok || !data.session) throw new Error(data.message ?? "Could not decline call.")
      setActiveSession(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decline failed.")
    } finally {
      setDeclining(false)
    }
  }

  async function submitWrapup(input: {
    outcome: NativeCallWrapupOutcome
    objectionCategory?: string | null
    buyingSignals?: string[]
    competitorMentioned?: boolean
    timelineDetected?: boolean
    budgetDetected?: boolean
    championIdentified?: boolean
    decisionMakerPresent?: boolean
    notes?: string
  }): Promise<NativeCallWrapupPublicView | null> {
    if (!activeSession) return null
    setSubmittingWrapup(true)
    try {
      const res = await fetch("/api/platform/growth/calls/wrapup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          companyName: activeSession.companyName,
          ...input,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { wrapup?: NativeCallWrapupPublicView; message?: string }
      if (!res.ok || !data.wrapup) throw new Error(data.message ?? "Wrap-up failed.")
      setActiveSession(null)
      await load()
      return data.wrapup
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrap-up failed.")
      return null
    } finally {
      setSubmittingWrapup(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading call workspace…
      </div>
    )
  }

  if (setupMessage) {
    return <p className="text-sm text-muted-foreground">{setupMessage}</p>
  }

  return (
    <div
      className="mx-auto w-full max-w-[1600px] space-y-6 px-6 xl:px-8"
      data-qa-marker={GROWTH_NATIVE_DIALER_QA_MARKER}
      data-layout-qa-marker={GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Unified Call Workspace</h2>
          <p className="text-sm text-muted-foreground">Native in-app dialer — operator controlled, no autonomous outbound.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label={GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER} tone="healthy" />
          <GrowthBadge label={GROWTH_NATIVE_DIALER_QA_MARKER} tone="neutral" />
          {dashboard ? (
            <GrowthBadge
              label={`Provider ${NATIVE_DIALER_PROVIDER_LABELS[dashboard.primaryProvider]}`}
              tone="neutral"
            />
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {setupWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{setupWarning}</p>
      ) : null}

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Calls today" value={String(dashboard.metrics.callsToday)} />
          <StatTile label="Connection rate" value={`${dashboard.metrics.connectionRate}%`} />
          <StatTile label="Meeting rate" value={`${dashboard.metrics.meetingRate}%`} />
          <StatTile label="Avg talk time" value={`${Math.round(dashboard.metrics.avgTalkTimeSeconds / 60)}m`} />
          <StatTile label="Queue throughput" value={String(dashboard.metrics.queueThroughput)} />
        </div>
      ) : null}

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Objection trends" value={String(dashboard.metrics.objectionTrendCount)} />
          <StatTile label="Call quality trend" value={String(dashboard.metrics.callQualityTrend)} />
          <StatTile label="Meeting conversion" value={`${dashboard.metrics.meetingConversionRate}%`} />
          <StatTile label="Follow-up completion" value={`${dashboard.metrics.followUpCompletionRate}%`} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="w-full min-w-0 space-y-4 lg:max-w-[360px]">
          <GrowthEngineCard title="Dialer" icon={<Phone className="size-4" />}>
            <GrowthNativeDialer
              phone={phone}
              onPhoneChange={setPhone}
              onDial={() => void startCall()}
              disabled={workspacePhase !== "idle"}
              loading={starting}
            />
          </GrowthEngineCard>

          <GrowthEngineCard title="Call queue">
            <GrowthPowerDialQueue
              items={queue}
              dialingId={dialingQueueId}
              onDialItem={(item) => {
                setDialingQueueId(item.id)
                setPhone(item.phoneNumber ?? "")
                void startCall({
                  phoneNumber: item.phoneNumber ?? phone,
                  leadId: item.leadId,
                  queueItemId: item.id,
                })
              }}
            />
          </GrowthEngineCard>

          {dashboard?.recentSessions.length ? (
            <GrowthEngineCard title="Recent calls">
              <ul className="max-h-[260px] space-y-2 overflow-auto pr-1 text-sm">
                {dashboard.recentSessions.slice(0, 5).map((session) => (
                  <li key={session.id} className="rounded border border-border/80 px-2 py-1.5">
                    <p className="font-medium">{session.companyName ?? session.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground">{session.status} · {session.durationSeconds}s</p>
                  </li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}

          {dashboard?.queuePreview.length ? (
            <GrowthEngineCard title="Active tasks">
              <ul className="max-h-[260px] space-y-2 overflow-auto pr-1 text-sm">
                {dashboard.queuePreview.slice(0, 4).map((item) => (
                  <li key={item.id} className="rounded border border-border/80 px-2 py-1.5">
                    <p className="font-medium">{item.companyName ?? item.contactName ?? "Lead"}</p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}
        </aside>

        <main className="min-w-0 space-y-4">
          {workspacePhase === "idle" ? (
            <GrowthEngineCard className="min-h-[420px]">
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <PhoneCall className="size-8" />
                </span>
                <h3 className="text-2xl font-semibold tracking-tight">Ready to connect</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Search a lead, select a queue item, or dial a number to begin.
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {[
                    { title: "Live Coaching", icon: Sparkles, detail: "Realtime suggestions during active calls" },
                    { title: "Prospect Intelligence", icon: Brain, detail: "Deal and execution context for the lead" },
                    { title: "Call Intelligence", icon: BarChart3, detail: "Scorecards, objections, and call quality" },
                    { title: "Meeting Outcomes", icon: CalendarCheck, detail: "Follow-up recommendations after meetings" },
                  ].map((panel) => (
                    <div
                      key={panel.title}
                      className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-left opacity-50"
                      aria-disabled="true"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <panel.icon className="size-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{panel.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{panel.detail}</p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Available during active call
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </GrowthEngineCard>
          ) : null}

          {workspacePhase === "incoming" && activeSession ? (
            <GrowthIncomingCallPanel
              session={activeSession}
              onAnswer={() => void answerCall()}
              onDecline={() => void declineCall()}
              answering={answering}
              declining={declining}
            />
          ) : null}

          {workspacePhase === "active" && activeSession ? (
            <GrowthActiveCallPanel session={activeSession} onEndCall={() => void endCall()} onNotesChange={() => undefined} ending={ending} />
          ) : null}

          {workspacePhase === "wrapup" && activeSession ? (
            <GrowthPostCallWrapup session={activeSession} submitting={submittingWrapup} onSubmit={submitWrapup} />
          ) : null}
        </main>

        <aside className="w-full min-w-0 max-w-[320px] space-y-4 lg:justify-self-end">
          <GrowthEngineCard title="Prospect intelligence">
            {!leadContext ? (
              <p className="text-sm text-muted-foreground">
                Select a lead to load deal, execution, and meeting outcome context.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/80 p-3">
                  <p className="font-medium">{leadContext.companyName}</p>
                  <p className="text-sm text-muted-foreground">{leadContext.contactName ?? "Contact"}</p>
                </div>

                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal Readiness</p>
                  <p className="mt-1 text-lg font-semibold">
                    {leadContext.dealCloseProbability != null ? `${leadContext.dealCloseProbability}% close` : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution Readiness</p>
                  <p className="mt-1 text-lg font-semibold">
                    {leadContext.executionReadinessScore != null ? leadContext.executionReadinessScore : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open Tasks</p>
                  <p className="mt-1 text-lg font-semibold">{leadContext.openTaskCount}</p>
                </div>

                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended Next Action</p>
                  <p className="mt-1 text-sm text-foreground">
                    {leadContext.recommendedNextAction ?? "No recommendation yet"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meeting Intelligence</p>
                  <p className="mt-1 text-lg font-semibold">
                    {leadContext.meetingOutcomeScore != null ? leadContext.meetingOutcomeScore : "—"}
                  </p>
                </div>

                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href={commandLeadFocusHref(leadContext.leadId, "command")}>Open lead</Link>
                </Button>
              </div>
            )}
          </GrowthEngineCard>
        </aside>
      </div>
    </div>
  )
}
