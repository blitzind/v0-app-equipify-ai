"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthCallIntelligenceScorecardCard } from "@/components/growth/growth-call-intelligence-scorecard-card"
import { GrowthNativeDialerLaunchButton } from "@/components/growth/growth-native-dialer-launch-button"
import { GrowthOpportunityNextBestActionCard } from "@/components/growth/growth-opportunity-next-best-action-card"
import { GrowthPredictiveDealIntelligenceCard } from "@/components/growth/growth-predictive-deal-intelligence-card"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"
import {
  buildGrowthLeadHref,
  buildGrowthActivityHref,
  growthWorkspaceConversationsHref,
  growthWorkspaceMeetingsHref,
  resolveGrowthLeadIdFromSearchParams,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import {
  buildGrowthOpportunityPipelineHref,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  resolveGrowthOpportunityIdFromSearchParams,
  selectNewestGrowthOpportunityForLead,
} from "@/lib/growth/navigation/growth-workspace-url-state-7a1"
import type {
  GrowthOpportunity,
  GrowthOpportunityDetail,
  GrowthOpportunityPipelineDashboard,
  GrowthOpportunityPipelineView,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"
import {
  GROWTH_OPPORTUNITIES_AVA_RECOMMENDS_TITLE,
  GROWTH_OPPORTUNITIES_DEALS_NEEDING_ATTENTION_TITLE,
  GROWTH_OPPORTUNITIES_IMPORT_PROSPECTS_CTA,
  GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_MESSAGE,
  GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_TITLE,
  GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE,
  GROWTH_OPPORTUNITIES_PIPELINE_VALUE_TITLE,
  GROWTH_OPPORTUNITIES_QUALIFY_LEADS_CTA,
  GROWTH_OPPORTUNITIES_RECENTLY_CHANGED_TITLE,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-operator-simplification-1e"
import { GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER } from "@/lib/growth/workspace/growth-workspace-action-first-1f"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { cn } from "@/lib/utils"

const VIEW_LABELS: Record<GrowthOpportunityPipelineView, string> = {
  my_pipeline: "My Pipeline",
  all_pipeline: "All Pipeline",
  at_risk: "At Risk",
  needs_action: "Needs Action",
  forecast: "Forecast",
  owner_board: "Owner Board",
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function riskTone(score: number): "critical" | "high" | "medium" | "low" | "neutral" {
  if (score >= 70) return "critical"
  if (score >= 50) return "high"
  if (score >= 30) return "medium"
  if (score > 0) return "low"
  return "neutral"
}

function OpportunityRow({
  item,
  selected,
  onSelect,
}: {
  item: GrowthOpportunity
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        selected ? "border-indigo-300 bg-indigo-50/50" : "border-border bg-background hover:bg-muted/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.companyName}</p>
        <p className="text-sm text-muted-foreground">{item.title}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <GrowthBadge label={item.stageLabel} tone="neutral" />
          <GrowthBadge label={item.forecastCategory.replace(/_/g, " ")} tone="medium" />
          {item.isStale ? <GrowthBadge label="Stale" tone="attention" /> : null}
          <GrowthBadge label={`Risk ${item.riskScore}`} tone={riskTone(item.riskScore)} />
        </div>
      </div>
      <div className="text-right text-sm">
        <p className="font-semibold tabular-nums">{formatCurrency(item.amount)}</p>
        <p className="text-muted-foreground tabular-nums">{formatCurrency(item.weightedAmount)} weighted</p>
        <p className="text-xs text-muted-foreground">{item.probability}%</p>
      </div>
    </button>
  )
}

function OpportunityDetailPanel({
  detail,
  loading,
  onStageChange,
}: {
  detail: GrowthOpportunityDetail | null
  loading: boolean
  onStageChange: (stageKey: string) => Promise<void>
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading opportunity…
      </div>
    )
  }
  if (!detail) {
    return <p className="text-sm text-muted-foreground">Select an opportunity to view deal details.</p>
  }

  const openStages = [
    "discovery",
    "qualified",
    "proposal",
    "negotiation",
    "verbal_commit",
    "closed_won",
    "closed_lost",
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{detail.companyName}</h3>
        <p className="text-sm text-muted-foreground">{detail.title}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Amount" value={formatCurrency(detail.amount)} />
        <StatTile label="Weighted" value={formatCurrency(detail.weightedAmount)} />
        <StatTile label="Probability" value={`${detail.probability}%`} />
        <StatTile label="Age" value={`${detail.ageDays}d`} />
      </div>

      {detail.riskSignals.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-medium">Risk indicators</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {detail.riskSignals.map((signal) => (
              <li key={signal.key}>• {signal.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <GrowthOpportunityNextBestActionCard leadId={detail.leadId} companyName={detail.companyName} />

      <GrowthPredictiveDealIntelligenceCard
        opportunityId={detail.id}
        leadId={detail.leadId}
        companyName={detail.companyName}
      />

      <GrowthCallIntelligenceScorecardCard
        leadId={detail.leadId}
        companyName={detail.companyName}
      />

      <div>
        <p className="mb-2 text-sm font-medium">Move stage (human-controlled)</p>
        <div className="flex flex-wrap gap-2">
          {openStages.map((stageKey) => (
            <Button
              key={stageKey}
              size="sm"
              variant={detail.stageKey === stageKey ? "default" : "outline"}
              disabled={detail.stageKey === stageKey}
              onClick={() => void onStageChange(stageKey)}
            >
              {stageKey.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Stage history</p>
        <div className="space-y-2">
          {detail.stageHistory.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded border border-border px-3 py-2 text-sm">
              <p>
                {(entry.fromStageKey ?? "start").replace(/_/g, " ")} → {entry.toStageKey.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={buildGrowthLeadHref(detail.leadId)}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          Open linked lead
          <ChevronRight className="size-4" />
        </Link>
        <Link
          href={growthWorkspaceConversationsHref({ leadId: detail.leadId })}
          className="text-sm text-muted-foreground hover:underline"
        >
          Conversations
        </Link>
        <Link href={buildGrowthActivityHref({ leadId: detail.leadId })} className="text-sm text-muted-foreground hover:underline">
          Activity
        </Link>
        <Link
          href={growthWorkspaceMeetingsHref(detail.leadId)}
          className="text-sm text-muted-foreground hover:underline"
        >
          Meetings
        </Link>
        <GrowthNativeDialerLaunchButton leadId={detail.leadId} label="Call workspace" size="sm" variant="outline" />
        <Link href={nativeCallWorkspaceHref({ leadId: detail.leadId })} className="text-sm text-muted-foreground hover:underline">
          Open in unified workspace
        </Link>
      </div>
    </div>
  )
}

export function GrowthOpportunityPipelineDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const syncingFromUrlRef = useRef(false)
  const lastPushedOpportunityIdRef = useRef<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthOpportunityPipelineDashboard | null>(null)
  const [items, setItems] = useState<GrowthOpportunity[]>([])
  const [view, setView] = useState<GrowthOpportunityPipelineView>("all_pipeline")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GrowthOpportunityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthOpportunityPipelineView, refresh = false) => {
    setLoading(true)
    setError(null)
    setSetupMessage(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50", ownerUserId: "me" })
      if (activeView === "all_pipeline" || activeView === "owner_board" || activeView === "forecast") {
        params.delete("ownerUserId")
      }
      if (refresh) params.set("refresh", "true")
      const res = await fetch(`/api/platform/growth/opportunities/pipeline?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        feed?: { items?: GrowthOpportunity[] }
        dashboard?: GrowthOpportunityPipelineDashboard | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load pipeline.")
      if (data.meta?.schemaReady === false) {
        setSetupMessage(data.meta.setupMessage ?? "Opportunity pipeline setup is required before this view can load.")
        setItems([])
        setDashboard(null)
        return
      }
      setItems(data.feed?.items ?? [])
      setDashboard(data.dashboard ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pipeline.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (opportunityId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/opportunities/pipeline/${opportunityId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        opportunity?: GrowthOpportunityDetail
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load opportunity detail.")
      setDetail(data.opportunity ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load opportunity detail.")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(view)
  }, [load, view])

  useEffect(() => {
    const opportunityId = resolveGrowthOpportunityIdFromSearchParams(searchParams)
    const leadId = resolveGrowthLeadIdFromSearchParams(searchParams)
    syncingFromUrlRef.current = true
    if (opportunityId) {
      setSelectedId(opportunityId)
      syncingFromUrlRef.current = false
      return
    }
    if (!leadId || items.length === 0) {
      syncingFromUrlRef.current = false
      return
    }
    const match = selectNewestGrowthOpportunityForLead(items, leadId)
    if (match) setSelectedId(match.id)
    syncingFromUrlRef.current = false
  }, [items, searchParams])

  const selectOpportunity = useCallback(
    (opportunityId: string) => {
      setSelectedId(opportunityId)
    },
    [],
  )

  useEffect(() => {
    if (syncingFromUrlRef.current) return
    if (!selectedId) return
    if (lastPushedOpportunityIdRef.current === selectedId) return
    if (resolveGrowthOpportunityIdFromSearchParams(searchParams) === selectedId) {
      lastPushedOpportunityIdRef.current = selectedId
      return
    }

    const item = items.find((entry) => entry.id === selectedId)
    const href = buildGrowthOpportunityPipelineHref({
      opportunityId: selectedId,
      leadId: item?.leadId ?? resolveGrowthLeadIdFromSearchParams(searchParams),
      preserve: searchParams,
    })
    lastPushedOpportunityIdRef.current = selectedId
    router.replace(href, { scroll: false })
  }, [items, router, searchParams, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [loadDetail, selectedId])

  async function handleStageChange(stageKey: string) {
    if (!selectedId) return
    const lossReason = stageKey === "closed_lost" ? window.prompt("Loss reason?") : null
    if (stageKey === "closed_lost" && !lossReason?.trim()) return
    const res = await fetch(`/api/platform/growth/opportunities/pipeline/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stage", stageKey, lossReason }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      setError(data.message ?? "Could not update stage.")
      return
    }
    await Promise.all([load(view, true), loadDetail(selectedId)])
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading opportunity pipeline…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-growth-ops-url-state={GROWTH_OPS_URL_STATE_7A1_QA_MARKER} data-qa-marker={GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER} data-growth-action-first-order="actions-before-metrics" data-qa-marker-action-first={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}>
      <GrowthEngineCard title={GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            What needs your attention first — then review full pipeline analytics below.
          </p>
          <Button size="sm" variant="outline" onClick={() => void load(view, true)}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={GROWTH_OPPORTUNITIES_DEALS_NEEDING_ATTENTION_TITLE}
            value={dashboard?.dealsNeedingAction ?? 0}
          />
          <StatTile label={GROWTH_OPPORTUNITIES_PIPELINE_VALUE_TITLE} value={formatCurrency(dashboard?.openPipeline ?? 0)} />
          <StatTile label="Weighted pipeline" value={formatCurrency(dashboard?.weightedPipeline ?? 0)} />
          <StatTile label={GROWTH_OPPORTUNITIES_RECENTLY_CHANGED_TITLE} value={dashboard?.staleOpportunityCount ?? 0} />
        </div>

        {(dashboard?.dealsNeedingAction ?? 0) > 0 ? (
          <div className="mt-4 rounded-lg border border-indigo-200/60 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <p className="text-sm font-medium">{GROWTH_OPPORTUNITIES_AVA_RECOMMENDS_TITLE}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review deals needing action in the pipeline list below — Ava surfaces risk and stale follow-ups for you to decide.
            </p>
          </div>
        ) : null}
      </GrowthEngineCard>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as GrowthOpportunityPipelineView[]).map((key) => (
          <Button key={key} size="sm" variant={view === key ? "default" : "outline"} onClick={() => setView(key)}>
            {VIEW_LABELS[key]}
          </Button>
        ))}
      </div>

      {setupMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Pipeline setup required</p>
          <p className="mt-1">Your pipeline is not ready yet. Ask Platform Admin to finish workspace setup.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Pipeline">
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm font-medium">{GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_TITLE}</p>
                <p className="mt-1 text-sm text-muted-foreground">{GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_MESSAGE}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" asChild>
                    <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/prospect-search`}>
                      {GROWTH_OPPORTUNITIES_IMPORT_PROSPECTS_CTA}
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/leads`}>{GROWTH_OPPORTUNITIES_QUALIFY_LEADS_CTA}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              items.map((item) => (
                <OpportunityRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => selectOpportunity(item.id)}
                />
              ))
            )}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Opportunity detail">
          <OpportunityDetailPanel detail={detail} loading={detailLoading} onStageChange={handleStageChange} />
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Pipeline analytics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatTile label="Open pipeline" value={formatCurrency(dashboard?.openPipeline ?? 0)} />
          <StatTile label="Weighted pipeline" value={formatCurrency(dashboard?.weightedPipeline ?? 0)} />
          <StatTile label="Won revenue" value={formatCurrency(dashboard?.wonRevenue ?? 0)} />
          <StatTile label="Lost revenue" value={formatCurrency(dashboard?.lostRevenue ?? 0)} />
          <StatTile label="Deals needing action" value={dashboard?.dealsNeedingAction ?? 0} />
          <StatTile label="Stale opportunities" value={dashboard?.staleOpportunityCount ?? 0} />
        </div>

        {dashboard?.pipelineByStage?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {dashboard.pipelineByStage.map((stage) => (
              <div key={stage.stageKey} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stage.stageLabel}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{stage.count}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(stage.weightedAmount)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </GrowthEngineCard>
    </div>
  )
}
