"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Filter,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  ApolloMultichannelOrchestrationFunnelMetrics,
  ApolloMultichannelSequenceCandidateStatus,
  ApolloMultichannelSequenceQueueSnapshot,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type { ApolloQueueSortKey } from "@/lib/growth/apollo/apollo-queue-pagination"
import { ApolloPipelineAttributionPanel } from "@/components/growth/apollo-pipeline-attribution-panel"
import { ApolloQueueControls } from "@/components/growth/apollo-queue-controls"
import { cn } from "@/lib/utils"

type QueueFilter = "all" | ApolloMultichannelSequenceCandidateStatus

function statusTone(
  status: ApolloMultichannelSequenceCandidateStatus,
): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "sequence_approved") return "healthy"
  if (status === "sequence_rejected") return "attention"
  if (status === "recommendation_regenerated") return "neutral"
  return "medium"
}

function statusLabel(status: ApolloMultichannelSequenceCandidateStatus): string {
  return status.replace(/_/g, " ")
}

function formatChannelAvailability(
  availability: ApolloMultichannelSequenceQueueSnapshot["items"][number]["channel_availability"],
): string {
  return [
    availability.verified_email ? "email" : null,
    availability.voice_drop_capable ? "voice drop" : null,
    availability.sms_capable ? "sms" : null,
    availability.phone ? "calling" : null,
  ]
    .filter(Boolean)
    .join(", ") || "limited"
}

export function ApolloMultichannelOrchestrationFunnelDashboard({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState<ApolloMultichannelOrchestrationFunnelMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-multichannel-orchestration/funnel-metrics", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        metrics?: ApolloMultichannelOrchestrationFunnelMetrics
        message?: string
      }
      if (!res.ok || !json.ok || !json.metrics) {
        throw new Error(json.message ?? "Could not load Multi-Channel Funnel metrics.")
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
      { label: "Voice drop candidates", value: metrics.voice_drop_candidates },
      { label: "Sequence candidates", value: metrics.sequence_candidates },
      { label: "Approved sequences", value: metrics.approved_sequences },
      { label: "Rejected sequences", value: metrics.rejected_sequences },
      { label: "Avg confidence", value: metrics.average_confidence },
      ...Object.entries(metrics.channel_mix).map(([key, value]) => ({
        label: `Channel: ${key.replace(/_/g, " ")}`,
        value,
      })),
      ...Object.entries(metrics.sequence_mix).map(([key, value]) => ({
        label: `Sequence: ${key.replace(/_/g, " ")}`,
        value,
      })),
    ]
  }, [metrics])

  return (
    <GrowthEngineCard title="Multi-Channel Funnel" icon={<Sparkles size={16} />} className={cn("mb-6", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Voice-drop-approved contacts through orchestration plans and operator sequence approval — no live send.
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

export function ApolloMultichannelOrchestrationQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloMultichannelSequenceQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>("pending_sequence_approval")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<ApolloQueueSortKey>("created_at_desc")
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (companyCandidateId) params.set("companyCandidateId", companyCandidateId)
      params.set("status", "all")
      params.set("page", String(page))
      params.set("pageSize", "25")
      if (search.trim()) params.set("search", search.trim())
      params.set("sort", sort)
      const res = await fetch(
        `/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloMultichannelSequenceQueueSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Multi-Channel Ready queue.")
      }
      setSnapshot(json.snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [companyCandidateId, page, search, sort])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const items = snapshot?.items ?? []
    if (filter === "all") return items
    return items.filter((row) => row.status === filter)
  }, [snapshot?.items, filter])

  const runAction = useCallback(
    async (
      candidateId: string,
      action: "approve_sequence" | "reject_sequence" | "regenerate_recommendation",
    ) => {
      setActionKey(`${action}:${candidateId}`)
      setMessage(null)
      setError(null)
      try {
        const res = await fetch(
          "/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue/actions",
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
      title={snapshot?.queue_label ?? "Multi-Channel Ready"}
      icon={<Layers size={16} />}
      className={cn("mb-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Orchestration plans await explicit sequence approval — no email, SMS, voice drop, calls, drafts, or jobs.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            QA marker: {APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER}
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
          <StatTile label="Regenerated" value={String(snapshot.summary.regenerated)} />
        </div>
      ) : null}

      <ApolloQueueControls
        pagination={snapshot?.pagination ?? null}
        search={search}
        sort={sort}
        loading={loading}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        onSortChange={(value) => {
          setSort(value)
          setPage(1)
        }}
        onPageChange={setPage}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        {(
          [
            "all",
            "pending_sequence_approval",
            "sequence_approved",
            "sequence_rejected",
            "recommendation_regenerated",
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
            No multi-channel sequence candidates in this filter.
          </div>
        ) : (
          filteredItems.map((row) => (
            <div key={row.candidate_id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.full_name}</p>
                    <GrowthBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</GrowthBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.company_name}
                    {row.title ? ` · ${row.title}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="size-3.5" />
                    {row.email ?? "No email"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Qualification {row.qualification_score}</p>
                  <p>Confidence {row.orchestration_confidence}</p>
                  <p>{row.sequence_template.sequence_key}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Recommended sequence:</span>{" "}
                  {row.orchestration_result.recommended_sequence}
                </p>
                <p>
                  <span className="font-medium text-foreground">Channel availability:</span>{" "}
                  {formatChannelAvailability(row.channel_availability)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Strongest channel:</span>{" "}
                  {row.channel_intelligence.strongest_channel?.replace(/_/g, " ") ?? "n/a"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Fallback:</span>{" "}
                  {row.channel_intelligence.fallback_strategy}
                </p>
              </div>

              <div className="mt-3 rounded-lg border bg-background/60 p-3 text-xs">
                <p className="font-medium text-foreground">Why selected</p>
                <p className="mt-1 text-muted-foreground">{row.operator_summary.why_selected}</p>
                <p className="mt-2 font-medium text-foreground">Scheduling plan</p>
                <p className="mt-1 text-muted-foreground">{row.operator_summary.scheduling_summary}</p>
              </div>

              <ApolloPipelineAttributionPanel
                attribution={row.attribution_display}
                className="mt-3"
              />

              {row.status === "pending_sequence_approval" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runAction(row.candidate_id, "approve_sequence")}
                    disabled={actionKey != null}
                  >
                    {actionKey === `approve_sequence:${row.candidate_id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Approve Sequence
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction(row.candidate_id, "reject_sequence")}
                    disabled={actionKey != null}
                  >
                    <XCircle className="size-4" />
                    Reject Sequence
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runAction(row.candidate_id, "regenerate_recommendation")}
                    disabled={actionKey != null}
                  >
                    Regenerate Recommendation
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
