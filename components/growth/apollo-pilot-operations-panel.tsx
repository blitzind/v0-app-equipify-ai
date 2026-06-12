"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  StopCircle,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  APOLLO_PILOT_COHORT_SIZES,
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotCohortRow,
  type ApolloPilotCohortSize,
  type ApolloPilotDashboardCounts,
  type ApolloPilotFunnelMetrics,
  type ApolloPilotChannelAttributionMetrics,
  type ApolloPilotContentPerformanceMetrics,
  type ApolloPilotOperatorAnalytics,
  type ApolloPilotRoiMetrics,
} from "@/lib/growth/apollo/apollo-pilot-types"
import { ApolloOperationsDashboardSections } from "@/components/growth/apollo-operations-dashboard-sections"
import { cn } from "@/lib/utils"

type PilotTab = "operations" | "overview" | "funnel" | "channels" | "content" | "operators" | "roi"

type CohortAnalytics = {
  cohort: ApolloPilotCohortRow
  dashboard: ApolloPilotDashboardCounts
  funnel: ApolloPilotFunnelMetrics
  channels: ApolloPilotChannelAttributionMetrics
  content: ApolloPilotContentPerformanceMetrics
  operators: ApolloPilotOperatorAnalytics
  roi: ApolloPilotRoiMetrics
  processing_allowed: boolean
}

function statusTone(status: ApolloPilotCohortRow["status"]): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "active") return "healthy"
  if (status === "paused") return "attention"
  if (status === "cancelled") return "attention"
  if (status === "completed") return "neutral"
  return "medium"
}

export function ApolloPilotOperationsPanel({ className }: { className?: string }) {
  const [cohorts, setCohorts] = useState<ApolloPilotCohortRow[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [analytics, setAnalytics] = useState<CohortAnalytics | null>(null)
  const [tab, setTab] = useState<PilotTab>("overview")
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCohortName, setNewCohortName] = useState("Apollo 25-company pilot")
  const [newCohortSize, setNewCohortSize] = useState<ApolloPilotCohortSize>(25)

  const loadCohorts = useCallback(async () => {
    const res = await fetch("/api/platform/growth/apollo-pilot/cohorts", { cache: "no-store" })
    const json = (await res.json()) as { ok?: boolean; cohorts?: ApolloPilotCohortRow[]; message?: string }
    if (!res.ok || !json.ok || !json.cohorts) throw new Error(json.message ?? "Could not load cohorts.")
    setCohorts(json.cohorts)
    if (!selectedId && json.cohorts.length > 0) setSelectedId(json.cohorts[0]!.id)
  }, [selectedId])

  const loadAnalytics = useCallback(async (cohortId: string) => {
    if (!cohortId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/apollo-pilot/cohorts/${cohortId}`, { cache: "no-store" })
      const json = (await res.json()) as { ok?: boolean; message?: string } & Partial<CohortAnalytics>
      if (!res.ok || !json.ok || !json.cohort) throw new Error(json.message ?? "Could not load cohort analytics.")
      setAnalytics(json as CohortAnalytics)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCohorts().catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [loadCohorts])

  useEffect(() => {
    if (selectedId) void loadAnalytics(selectedId)
  }, [selectedId, loadAnalytics])

  const dashboardTiles = useMemo(() => {
    if (!analytics?.dashboard) return []
    const d = analytics.dashboard
    return [
      { label: "Companies processed", value: d.companies_processed },
      { label: "Contacts found", value: d.contacts_found },
      { label: "Qualified", value: d.qualified_contacts },
      { label: "Enrollment candidates", value: d.enrollment_candidates },
      { label: "Voice drop candidates", value: d.voice_drop_candidates },
      { label: "Multi-channel candidates", value: d.multichannel_candidates },
      { label: "Sequence enrollments", value: d.sequence_enrollments },
      { label: "Draft approvals", value: d.draft_approvals },
      { label: "Job approvals", value: d.job_approvals },
      { label: "Emails sent", value: d.emails_sent },
      { label: "SMS sent", value: d.sms_sent },
      { label: "Voice drops sent", value: d.voice_drops_sent },
      { label: "Calls completed", value: d.calls_completed },
      { label: "Replies", value: d.replies_received },
      { label: "Meetings booked", value: d.meetings_booked },
      { label: "Opportunities", value: d.opportunities_created },
      { label: "Revenue attributed", value: d.revenue_attributed },
    ]
  }, [analytics])

  const runAction = async (action: string) => {
    if (!selectedId) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/apollo-pilot/cohorts/${selectedId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !json.ok) throw new Error(json.message ?? `Action ${action} failed.`)
      await loadCohorts()
      await loadAnalytics(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const createCohort = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-pilot/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_name: newCohortName.trim(),
          target_company_count: newCohortSize,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        cohort?: ApolloPilotCohortRow
        message?: string
      }
      if (!res.ok || !json.ok || !json.cohort) throw new Error(json.message ?? "Could not create cohort.")
      setSelectedId(json.cohort.id)
      await loadCohorts()
      await loadAnalytics(json.cohort.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const tabs: { id: PilotTab; label: string }[] = [
    { id: "operations", label: "Operations" },
    { id: "overview", label: "Overview" },
    { id: "funnel", label: "Funnel" },
    { id: "channels", label: "Channels" },
    { id: "content", label: "Content" },
    { id: "operators", label: "Operators" },
    { id: "roi", label: "ROI" },
  ]

  return (
    <GrowthEngineCard
      title="Apollo Pilot Operations"
      icon={<Rocket size={16} />}
      className={cn("mb-6", className)}
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Pilot cohort analytics and controls — no autonomous outreach. QA marker: {APOLLO_PILOT_OPERATIONS_QA_MARKER}.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cohort</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 min-w-[220px] rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Select cohort…</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.cohort_name} ({cohort.status})
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAnalytics(selectedId)} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
        <input
          value={newCohortName}
          onChange={(e) => setNewCohortName(e.target.value)}
          className="h-9 min-w-[200px] rounded-md border bg-background px-2 text-sm"
          placeholder="Cohort name"
        />
        <select
          value={newCohortSize}
          onChange={(e) => setNewCohortSize(Number(e.target.value) as ApolloPilotCohortSize)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {APOLLO_PILOT_COHORT_SIZES.map((size) => (
            <option key={size} value={size}>{size} companies</option>
          ))}
        </select>
        <Button size="sm" onClick={() => void createCohort()} disabled={actionLoading}>
          Create draft cohort
        </Button>
      </div>

      {analytics?.cohort && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge tone={statusTone(analytics.cohort.status)} label={analytics.cohort.status} />
          <GrowthBadge
            tone={analytics.processing_allowed ? "healthy" : "attention"}
            label={analytics.processing_allowed ? "Processing allowed" : "Processing blocked"}
          />
          <span className="text-xs text-muted-foreground">
            Target {analytics.cohort.target_company_count} · {analytics.cohort.company_count} companies enrolled
          </span>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runAction("activate")}>
              <Play className="mr-1 size-3" /> Activate
            </Button>
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runAction("pause")}>
              <Pause className="mr-1 size-3" /> Pause
            </Button>
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runAction("resume")}>
              <ShieldCheck className="mr-1 size-3" /> Resume
            </Button>
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runAction("complete")}>
              <BarChart3 className="mr-1 size-3" /> Complete
            </Button>
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void runAction("cancel")}>
              <StopCircle className="mr-1 size-3" /> Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <Button
            key={entry.id}
            size="sm"
            variant={tab === entry.id ? "default" : "outline"}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {tab === "operations" && (
        <ApolloOperationsDashboardSections cohortId={selectedId || undefined} />
      )}

      {tab === "overview" && dashboardTiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          {dashboardTiles.map((tile) => (
            <StatTile key={tile.label} label={tile.label} value={tile.value} icon={<Users size={14} />} />
          ))}
        </div>
      )}

      {tab === "funnel" && analytics?.funnel && (
        <div className="space-y-2">
          {analytics.funnel.stages.map((stage) => (
            <div key={stage.stage} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
              <span className="font-medium">{stage.label}</span>
              <span>{stage.count}</span>
              <span className="text-xs text-muted-foreground">
                stage {stage.stage_conversion_pct ?? "—"}% · cumulative {stage.cumulative_conversion_pct ?? "—"}% · drop {stage.drop_off_pct ?? "—"}%
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "channels" && analytics?.channels && (
        <div className="space-y-2">
          {analytics.channels.top_meeting_channel && (
            <p className="text-sm">Top meeting channel: <strong>{analytics.channels.top_meeting_channel}</strong></p>
          )}
          {analytics.channels.channels.map((row) => (
            <div key={row.channel} className="rounded border px-3 py-2 text-sm">
              <strong>{row.channel}</strong> — last-touch meetings {row.last_touch_meetings}, replies {row.replies}, opportunities {row.opportunities}
            </div>
          ))}
        </div>
      )}

      {tab === "content" && analytics?.content && (
        <div className="space-y-2">
          {analytics.content.rows.slice(0, 12).map((row) => (
            <div key={`${row.channel}-${row.variant_key}`} className="rounded border px-3 py-2 text-sm">
              <strong>{row.channel}</strong> · {row.variant_key} — sends {row.sends}, reply {row.reply_rate_pct}%, meeting {row.meeting_rate_pct}%
            </div>
          ))}
        </div>
      )}

      {tab === "operators" && analytics?.operators && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Draft approval %" value={analytics.operators.draft_approval_pct} />
          <StatTile label="Draft rejection %" value={analytics.operators.draft_rejection_pct} />
          <StatTile label="Draft regeneration %" value={analytics.operators.draft_regeneration_pct} />
          <StatTile label="Job approval %" value={analytics.operators.job_approval_pct} />
          <StatTile label="Avg review (min)" value={analytics.operators.average_review_time_minutes ?? "—"} />
          <StatTile label="Queue aging (hrs)" value={analytics.operators.queue_aging_hours_max ?? "—"} />
        </div>
      )}

      {tab === "roi" && analytics?.roi && (
        <div className="space-y-2">
          {analytics.roi.estimates.map((estimate) => (
            <div key={estimate.metric_key} className="rounded border px-3 py-2 text-sm">
              {estimate.label}: {estimate.value ?? "—"} <span className="text-xs text-muted-foreground">({estimate.estimate_source}, {estimate.confidence})</span>
            </div>
          ))}
        </div>
      )}
    </GrowthEngineCard>
  )
}
