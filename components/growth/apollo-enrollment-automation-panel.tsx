"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Brain,
  Filter,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  ApolloEnrollmentCandidateQueueSnapshot,
  ApolloEnrollmentCandidateStatus,
  ApolloEnrollmentFunnelMetrics,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { cn } from "@/lib/utils"

type QueueFilter = "all" | ApolloEnrollmentCandidateStatus | "qualified"

function statusTone(
  status: ApolloEnrollmentCandidateStatus,
): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "enrollment_approved") return "healthy"
  if (status === "enrollment_rejected") return "attention"
  if (status === "research_rerun_requested") return "neutral"
  return "medium"
}

function statusLabel(status: ApolloEnrollmentCandidateStatus): string {
  return status.replace(/_/g, " ")
}

export function ApolloEnrollmentFunnelDashboard({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState<ApolloEnrollmentFunnelMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-enrollment-automation/funnel-metrics", {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        metrics?: ApolloEnrollmentFunnelMetrics
        message?: string
      }
      if (!res.ok || !json.ok || !json.metrics) {
        throw new Error(json.message ?? "Could not load Apollo funnel metrics.")
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

  const tiles = useMemo(
    () =>
      metrics
        ? [
            { label: "Companies searched", value: metrics.companies_searched },
            { label: "Contacts found", value: metrics.contacts_found },
            { label: "Contacts mapped", value: metrics.contacts_mapped },
            { label: "Verified emails", value: metrics.verified_emails },
            { label: "Promoted contacts", value: metrics.promoted_contacts },
            { label: "Contactable", value: metrics.contactable_contacts },
            { label: "Sequence-ready", value: metrics.sequence_ready_contacts },
            { label: "Qualified", value: metrics.qualified_contacts },
            { label: "Enrollment candidates", value: metrics.enrollment_candidates },
            { label: "Approvals", value: metrics.enrollment_approvals },
            { label: "Rejections", value: metrics.enrollment_rejections },
          ]
        : [],
    [metrics],
  )

  return (
    <GrowthEngineCard
      title="Apollo Funnel"
      icon={<Sparkles size={16} />}
      className={cn("mb-6", className)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          End-to-end Apollo acquisition → qualification → enrollment candidate funnel.
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

export function ApolloEnrollmentAutomationQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloEnrollmentCandidateQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>("pending_enrollment_approval")
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
        `/api/platform/growth/apollo-enrollment-automation/enrollment-queue?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloEnrollmentCandidateQueueSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Apollo Ready For Enrollment queue.")
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
    if (filter === "qualified") return items.filter((row) => row.qualified_for_enrollment)
    return items.filter((row) => row.status === filter)
  }, [snapshot?.items, filter])

  const runAction = useCallback(
    async (candidateId: string, action: "approve_enrollment" | "reject_enrollment" | "rerun_research") => {
      setActionKey(`${action}:${candidateId}`)
      setMessage(null)
      setError(null)
      try {
        const res = await fetch(
          "/api/platform/growth/apollo-enrollment-automation/enrollment-queue/actions",
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
      title={snapshot?.queue_label ?? "Apollo Ready For Enrollment"}
      icon={<UserRound size={16} />}
      className={cn("mb-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Auto-qualified Apollo contacts await explicit enrollment approval — no draft or outreach.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            QA marker: {APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER}
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
          <StatTile label="Qualified" value={String(snapshot.summary.qualified)} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        {(
          [
            "all",
            "pending_enrollment_approval",
            "enrollment_approved",
            "enrollment_rejected",
            "research_rerun_requested",
            "qualified",
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
            No enrollment candidates in this filter.
          </div>
        ) : (
          filteredItems.map((row) => (
            <div key={row.candidate_id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.full_name}</p>
                    <GrowthBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</GrowthBadge>
                    {row.qualified_for_enrollment ? (
                      <GrowthBadge tone="healthy">qualified</GrowthBadge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.company_name}
                    {row.title ? ` · ${row.title}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.email ?? "No email"}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Qualification {row.qualification_score}</p>
                  {row.fit_score != null ? <p>Fit {row.fit_score}</p> : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>
                  <Brain className="mr-1 inline size-3.5" />
                  {row.operator_intelligence.why_selected}
                </p>
                <p>{row.operator_intelligence.company_summary}</p>
                <p>{row.operator_intelligence.research_summary}</p>
                <p>{row.operator_intelligence.buying_committee_summary}</p>
                <p>{row.operator_intelligence.apollo_evidence_summary}</p>
                <p>
                  Channel: {row.operator_intelligence.recommended_first_channel}
                  {row.operator_intelligence.recommended_sequence
                    ? ` · ${row.operator_intelligence.recommended_sequence}`
                    : ""}
                </p>
              </div>

              {row.status === "pending_enrollment_approval" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runAction(row.candidate_id, "approve_enrollment")}
                    disabled={actionKey != null}
                  >
                    {actionKey === `approve_enrollment:${row.candidate_id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Approve Enrollment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction(row.candidate_id, "reject_enrollment")}
                    disabled={actionKey != null}
                  >
                    <XCircle className="size-4" />
                    Reject Enrollment
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runAction(row.candidate_id, "rerun_research")}
                    disabled={actionKey != null}
                  >
                    Re-run Research
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
