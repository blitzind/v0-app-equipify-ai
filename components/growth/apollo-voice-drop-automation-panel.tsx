"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Filter,
  Loader2,
  Mic,
  Phone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  ApolloVoiceDropCandidateQueueSnapshot,
  ApolloVoiceDropCandidateStatus,
  ApolloVoiceDropFunnelMetrics,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { cn } from "@/lib/utils"

type QueueFilter = "all" | ApolloVoiceDropCandidateStatus | "voice_ready"

function statusTone(
  status: ApolloVoiceDropCandidateStatus,
): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "voice_drop_approved") return "healthy"
  if (status === "voice_drop_rejected") return "attention"
  if (status === "intelligence_rerun_requested") return "neutral"
  return "medium"
}

function statusLabel(status: ApolloVoiceDropCandidateStatus): string {
  return status.replace(/_/g, " ")
}

export function ApolloVoiceDropFunnelDashboard({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState<ApolloVoiceDropFunnelMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-voice-drop-automation/funnel-metrics", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        metrics?: ApolloVoiceDropFunnelMetrics
        message?: string
      }
      if (!res.ok || !json.ok || !json.metrics) {
        throw new Error(json.message ?? "Could not load Voice Funnel metrics.")
      }
      setMetrics(json.metrics)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tiles = useMemo(() => {
    if (!metrics) return []
    return [
      { label: "Enrollment candidates", value: metrics.enrollment_candidates },
      { label: "Enrollment approvals", value: metrics.enrollment_approvals },
      { label: "Voice drop candidates", value: metrics.voice_drop_candidates },
      { label: "Approved voice drops", value: metrics.approved_voice_drops },
      { label: "Rejected voice drops", value: metrics.rejected_voice_drops },
      { label: "Voice-ready contacts", value: metrics.voice_ready_contacts },
      ...Object.entries(metrics.recommended_channel_mix).map(([key, value]) => ({
        label: `Mix: ${key.replace(/_/g, " ")}`,
        value,
      })),
    ]
  }, [metrics])

  return (
    <GrowthEngineCard title="Voice Funnel" icon={<Sparkles size={16} />} className={cn("mb-6", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Enrollment-approved contacts through voice drop intelligence and operator approval — no live send.
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={String(tile.value)} />
        ))}
      </div>
    </GrowthEngineCard>
  )
}

export function ApolloVoiceDropAutomationQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloVoiceDropCandidateQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>("pending_voice_drop_approval")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (companyCandidateId) params.set("companyCandidateId", companyCandidateId)
      params.set("status", "all")
      const res = await fetch(
        `/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloVoiceDropCandidateQueueSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Voice Drops Ready queue.")
      }
      setSnapshot(json.snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [companyCandidateId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const items = snapshot?.items ?? []
    if (filter === "all") return items
    if (filter === "voice_ready") {
      return items.filter((row) => row.channel_availability.voice_drop_capable)
    }
    return items.filter((row) => row.status === filter)
  }, [snapshot?.items, filter])

  const runAction = useCallback(
    async (
      candidateId: string,
      action: "approve_voice_drop" | "reject_voice_drop" | "rerun_intelligence",
    ) => {
      setActionKey(`${action}:${candidateId}`)
      setMessage(null)
      setError(null)
      try {
        const res = await fetch(
          "/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue/actions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, candidateId }),
          },
        )
        const json = (await res.json()) as { ok?: boolean; result?: { error?: string }; message?: string }
        if (!res.ok || !json.ok) {
          throw new Error(json.result?.error ?? json.message ?? "Action failed.")
        }
        setMessage(`Action ${action.replace(/_/g, " ")} completed.`)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setActionKey(null)
      }
    },
    [load],
  )

  return (
    <GrowthEngineCard
      title={snapshot?.queue_label ?? "Voice Drops Ready"}
      icon={<Mic size={16} />}
      className={cn("mb-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Generated scripts and channel recommendations await explicit voice drop approval — no voicemail sent.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            QA marker: {APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {snapshot ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <StatTile label="Pending" value={String(snapshot.summary.pending)} />
          <StatTile label="Approved" value={String(snapshot.summary.approved)} />
          <StatTile label="Rejected" value={String(snapshot.summary.rejected)} />
          <StatTile label="Voice-ready" value={String(snapshot.summary.voice_ready)} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        {(
          [
            "all",
            "pending_voice_drop_approval",
            "voice_drop_approved",
            "voice_drop_rejected",
            "intelligence_rerun_requested",
            "voice_ready",
          ] as const
        ).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {message ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-2 size-5 opacity-60" />
            No voice drop candidates in this filter.
          </div>
        ) : (
          filteredItems.map((row) => (
            <div key={row.candidate_id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.full_name}</p>
                    <GrowthBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</GrowthBadge>
                    {row.channel_availability.voice_drop_capable ? (
                      <GrowthBadge tone="healthy">voice-ready</GrowthBadge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.company_name}
                    {row.title ? ` · ${row.title}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3.5" />
                    {row.phone ?? "No phone"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Qualification {row.qualification_score}</p>
                  <p>Voice drop {row.voice_drop_score}</p>
                  <p>Confidence {row.recommendation_confidence}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>
                  First channel: {row.channel_recommendations.recommended_first_channel}
                  {row.channel_recommendations.recommended_second_channel
                    ? ` → ${row.channel_recommendations.recommended_second_channel}`
                    : ""}
                </p>
                <p>{row.multichannel_strategy.strategy_label}</p>
                <p>Script: {row.voice_drop_intelligence.recommended_script_type.replace(/_/g, " ")}</p>
                <p>{row.voice_drop_intelligence.voicemail_objective}</p>
              </div>

              <div className="mt-3 rounded-lg border bg-background/60 p-3 text-xs">
                <p className="font-medium text-foreground">Recommended script</p>
                <p className="mt-1 text-muted-foreground">{row.voice_drop_script.full_script}</p>
              </div>

              {row.status === "pending_voice_drop_approval" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runAction(row.candidate_id, "approve_voice_drop")}
                    disabled={actionKey != null}
                  >
                    {actionKey === `approve_voice_drop:${row.candidate_id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Approve Voice Drop
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction(row.candidate_id, "reject_voice_drop")}
                    disabled={actionKey != null}
                  >
                    <XCircle className="size-4" />
                    Reject Voice Drop
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runAction(row.candidate_id, "rerun_intelligence")}
                    disabled={actionKey != null}
                  >
                    Re-run Intelligence
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </GrowthEngineCard>
  )
}
