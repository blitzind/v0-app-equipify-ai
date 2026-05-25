"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Headphones, Loader2, Phone, RefreshCw } from "lucide-react"
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
    <div className="space-y-6" data-qa-marker={GROWTH_NATIVE_DIALER_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Unified Call Workspace</h2>
          <p className="text-sm text-muted-foreground">Native in-app dialer — operator controlled, no autonomous outbound.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label={GROWTH_NATIVE_DIALER_QA_MARKER} tone="healthy" />
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

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-4">
          <GrowthEngineCard title="Dialer" icon={<Phone className="size-4" />}>
            <GrowthNativeDialer
              phone={phone}
              onPhoneChange={setPhone}
              onDial={() => void startCall()}
              disabled={workspacePhase !== "idle"}
              loading={starting}
            />
          </GrowthEngineCard>

          <GrowthEngineCard title="Call queue" subtitle="Human controlled">
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
              <ul className="space-y-2 text-sm">
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
            <GrowthEngineCard title="Active tasks" subtitle="Operator queue preview">
              <ul className="space-y-2 text-sm">
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

        <main className="space-y-4">
          {workspacePhase === "idle" ? (
            <GrowthEngineCard title="Ready to call" icon={<Headphones className="size-4" />}>
              <p className="text-sm text-muted-foreground">
                Enter a number or pick a queue item. During calls, live coaching and realtime intelligence appear here.
                After the call, complete operator wrap-up before moving on.
              </p>
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

        <aside className="space-y-4">
          <GrowthEngineCard title="Prospect intelligence" subtitle="Recommendations only">
            {!leadContext ? (
              <p className="text-sm text-muted-foreground">Select a lead to load deal, execution, and meeting outcome context.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">{leadContext.companyName}</p>
                  <p className="text-muted-foreground">{leadContext.contactName ?? "Contact"}</p>
                </div>
                <div className="grid gap-2">
                  <StatTile label="Deal close %" value={leadContext.dealCloseProbability != null ? `${leadContext.dealCloseProbability}%` : "—"} />
                  <StatTile label="Execution readiness" value={leadContext.executionReadinessScore != null ? String(leadContext.executionReadinessScore) : "—"} />
                  <StatTile label="Meeting outcome" value={leadContext.meetingOutcomeScore != null ? String(leadContext.meetingOutcomeScore) : "—"} />
                  <StatTile label="Open tasks" value={String(leadContext.openTaskCount)} />
                </div>
                {leadContext.recommendedNextAction ? (
                  <p className="text-muted-foreground">Next action: {leadContext.recommendedNextAction}</p>
                ) : null}
                <Button asChild size="sm" variant="outline">
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
