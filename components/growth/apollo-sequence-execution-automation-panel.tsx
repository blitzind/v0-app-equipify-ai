"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Filter,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  ApolloSequenceExecutionCandidateStatus,
  ApolloSequenceExecutionFunnelMetrics,
  ApolloSequenceExecutionQueueSnapshot,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { classifyApolloSequenceDraftReadiness } from "@/lib/growth/apollo/apollo-sequence-draft-readiness"
import type { ApolloQueueSortKey } from "@/lib/growth/apollo/apollo-queue-pagination"
import {
  ApolloDraftReadinessBadges,
  ApolloPipelineAttributionPanel,
} from "@/components/growth/apollo-pipeline-attribution-panel"
import { ApolloQueueControls } from "@/components/growth/apollo-queue-controls"
import { cn } from "@/lib/utils"

type QueueFilter = "all" | ApolloSequenceExecutionCandidateStatus

function statusTone(
  status: ApolloSequenceExecutionCandidateStatus,
): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "execution_ready") return "healthy"
  if (status === "draft_rejected") return "attention"
  if (status === "draft_regenerated") return "neutral"
  return "medium"
}

function statusLabel(status: ApolloSequenceExecutionCandidateStatus): string {
  return status.replace(/_/g, " ")
}

export function ApolloSequenceExecutionFunnelDashboard({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState<ApolloSequenceExecutionFunnelMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-sequence-execution-automation/funnel-metrics", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        metrics?: ApolloSequenceExecutionFunnelMetrics
        message?: string
      }
      if (!res.ok || !json.ok || !json.metrics) {
        throw new Error(json.message ?? "Could not load Execution Funnel metrics.")
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
      { label: "Approved sequences", value: metrics.approved_sequences },
      { label: "Generated sequences", value: metrics.generated_sequences },
      { label: "Generated drafts", value: metrics.generated_drafts },
      { label: "Approved drafts", value: metrics.approved_drafts },
      { label: "Rejected drafts", value: metrics.rejected_drafts },
      { label: "Execution-ready", value: metrics.execution_ready_sequences },
      ...Object.entries(metrics.channel_mix).map(([key, value]) => ({
        label: `Draft: ${key.replace(/_/g, " ")}`,
        value,
      })),
    ]
  }, [metrics])

  return (
    <GrowthEngineCard title="Execution Funnel" icon={<Sparkles size={16} />} className={cn("mb-6", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Multi-channel-approved sequences materialized into native enrollments, drafts, and pending-approval jobs — no send.
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

export function ApolloSequenceExecutionAutomationQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloSequenceExecutionQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>("pending_draft_approval")
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
        `/api/platform/growth/apollo-sequence-execution-automation/execution-queue?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloSequenceExecutionQueueSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Sequence Execution Queue.")
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
      action: "approve_draft" | "reject_draft" | "regenerate_draft",
    ) => {
      setActionKey(`${action}:${candidateId}`)
      setMessage(null)
      setError(null)
      try {
        const res = await fetch(
          "/api/platform/growth/apollo-sequence-execution-automation/execution-queue/actions",
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
      title={snapshot?.queue_label ?? "Sequence Execution Queue"}
      icon={<PlayCircle size={16} />}
      className={cn("mb-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Materialized sequences with draft placeholders and pending-approval execution jobs — no email, SMS, voice drop, or calls.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            QA marker: {APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {snapshot ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <StatTile label="Pending drafts" value={String(snapshot.summary.pending_drafts)} />
          <StatTile label="Execution-ready" value={String(snapshot.summary.execution_ready)} />
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
            "pending_draft_approval",
            "execution_ready",
            "draft_rejected",
            "draft_regenerated",
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
            No sequence execution candidates in this filter.
          </div>
        ) : (
          filteredItems.map((row) => (
            <div key={row.candidate_id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.full_name}</p>
                    <GrowthBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</GrowthBadge>
                    <ApolloDraftReadinessBadges
                      labels={
                        row.draft_readiness_label
                          ? [row.draft_readiness_label]
                          : ["Draft Placeholder"]
                      }
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.company_name}
                    {row.title ? ` · ${row.title}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sequence: {row.materialization.sequence_label}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Qualification {row.qualification_score}</p>
                  <p>{row.materialization.total_steps} steps</p>
                  <p>{row.execution_jobs.filter((j) => j.execution_job_id).length} jobs</p>
                </div>
              </div>

              <ApolloPipelineAttributionPanel
                attribution={row.attribution_display}
                className="mt-3"
              />

              <p className="mt-2 text-xs text-amber-700">
                {row.status === "execution_ready"
                  ? "Drafts approved — execution jobs may now be approved in Safe Execution below."
                  : "Approve drafts here first — execution jobs remain blocked until draft status is execution-ready."}
              </p>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Steps:</span> {row.operator_summary.step_summary}
                </p>
                <p>
                  <span className="font-medium text-foreground">Drafts:</span> {row.operator_summary.draft_summary}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {row.materialization.drafts.map((draft) => {
                  const readiness = classifyApolloSequenceDraftReadiness(draft)
                  return (
                  <div key={draft.draft_id} className="rounded-lg border bg-background/60 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        Step {draft.step_number} · {draft.draft_type} · {draft.approval_status.replace(/_/g, " ")}
                      </p>
                      <ApolloDraftReadinessBadges labels={[readiness.readiness_label]} />
                    </div>
                    <p className="mt-1 text-muted-foreground">{draft.content_summary}</p>
                    <p className="mt-1 text-muted-foreground">{readiness.readiness_detail}</p>
                    {draft.body_placeholder ? (
                      <p className="mt-2 whitespace-pre-wrap rounded border border-dashed p-2 text-[11px]">
                        {draft.body_placeholder}
                      </p>
                    ) : null}
                  </div>
                  )
                })}
              </div>

              {row.status === "pending_draft_approval" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runAction(row.candidate_id, "approve_draft")}
                    disabled={actionKey != null}
                  >
                    {actionKey === `approve_draft:${row.candidate_id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Approve Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction(row.candidate_id, "reject_draft")}
                    disabled={actionKey != null}
                  >
                    <XCircle className="size-4" />
                    Reject Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runAction(row.candidate_id, "regenerate_draft")}
                    disabled={actionKey != null}
                  >
                    Regenerate Draft
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
