"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Loader2, RefreshCw, Target, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthVoiceRevenueIntelligencePassiveCard } from "@/components/growth/growth-voice-revenue-intelligence-passive-card"
import {
  GROWTH_OPPORTUNITY_WORKSPACE_VIEWS,
  GROWTH_REVENUE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthOpportunityWorkspaceDashboard,
  type GrowthOpportunityWorkspaceView,
  type GrowthRevenueCopilotAssist,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

const VIEW_LABELS: Record<GrowthOpportunityWorkspaceView, string> = {
  active_opportunities: "Active opportunities",
  hottest_accounts: "Hottest accounts",
  stalled_conversations: "Stalled",
  unresolved_objections: "Unresolved objections",
  demo_ready: "Demo-ready",
  pricing_stage: "Pricing stage",
  high_risk: "High risk",
  multi_thread: "Multi-thread",
  buying_committee: "Buying committee",
}

export function GrowthOpportunityWorkspaceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthOpportunityWorkspaceDashboard | null>(null)
  const [view, setView] = useState<GrowthOpportunityWorkspaceView>("active_opportunities")
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [copilot, setCopilot] = useState<GrowthRevenueCopilotAssist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthOpportunityWorkspaceView) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50" })
      const res = await fetch(`/api/platform/growth/revenue-intelligence/workspace?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: GrowthOpportunityWorkspaceDashboard; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Could not load workspace.")
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCopilot = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/revenue-intelligence/copilot?leadId=${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; assist?: GrowthRevenueCopilotAssist }
    if (res.ok && data.ok && data.assist) setCopilot(data.assist)
  }, [])

  useEffect(() => {
    void load(view)
  }, [load, view])

  useEffect(() => {
    if (!selectedLeadId) {
      setCopilot(null)
      return
    }
    void loadCopilot(selectedLeadId)
  }, [selectedLeadId, loadCopilot])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading opportunity workspace…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_REVENUE_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GrowthBadge label={GROWTH_REVENUE_INTELLIGENCE_QA_MARKER} tone="attention" />
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{GROWTH_REVENUE_INTELLIGENCE_PRIVACY_NOTE}</p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<Target className="size-3.5" />} label="Active opportunities" value={dashboard.activeOpportunityCount} />
            <StatTile icon={<TrendingUp className="size-3.5" />} label="Hottest accounts" value={dashboard.hottestAccountCount} />
            <StatTile label="Demo-ready" value={dashboard.demoReadyCount} />
            <StatTile label="Pricing stage" value={dashboard.pricingStageCount} />
            <StatTile label="Stalled" value={dashboard.stalledConversationCount} />
            <StatTile label="Unresolved objections" value={dashboard.unresolvedObjectionCount} />
            <StatTile label="High risk" value={dashboard.highRiskCount} />
            <StatTile label="Buying committee" value={dashboard.buyingCommitteeCount} />
          </div>

          <GrowthEngineCard title="Workspace filters">
            <div className="flex flex-wrap gap-2">
              {GROWTH_OPPORTUNITY_WORKSPACE_VIEWS.map((option) => (
                <Button key={option} size="sm" variant={view === option ? "default" : "outline"} onClick={() => setView(option)}>
                  {VIEW_LABELS[option]}
                </Button>
              ))}
            </div>
          </GrowthEngineCard>
        </>
      ) : null}

      <GrowthEngineCard title="Opportunity accounts">
        {!dashboard || dashboard.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts match this view. Process inbound replies to populate momentum and signals.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.items.map((item) => (
              <li key={item.leadId} className="rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.companyLabel}</p>
                    <p className="text-muted-foreground">{item.recommendedAction ?? "Operator review recommended."}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <GrowthBadge label={`Momentum ${item.momentumScore}`} tone={item.momentumScore >= 65 ? "healthy" : "neutral"} />
                    <GrowthBadge label={item.momentumTrend} tone="attention" />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.signalCount} signals</span>
                  <span>· {item.unresolvedObjectionCount} objections</span>
                  <span>· Committee {item.committeeCompleteness}%</span>
                  <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setSelectedLeadId(item.leadId)}>
                    Revenue copilot
                  </button>
                  <Link href={`/admin/growth/leads?leadId=${item.leadId}`} className="font-medium text-indigo-600 hover:underline">
                    Open lead
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div data-qa-marker={GROWTH_REVENUE_INTELLIGENCE_QA_MARKER}>
        <GrowthEngineCard title="Buying momentum & revenue copilot" icon={<Bot className="size-4" />}>
          {!selectedLeadId || !copilot ? (
            <p className="text-sm text-muted-foreground">Select an account above for AI-assisted revenue intelligence (human executes all actions).</p>
          ) : (
            <div className="space-y-3 text-sm">
              <GrowthVoiceRevenueIntelligencePassiveCard leadId={selectedLeadId} compact />
              <GrowthBadge label={copilot.assistedLabel} tone="attention" />
              <p>{copilot.accountSummary}</p>
              <p><span className="font-medium">Momentum:</span> {copilot.momentumSummary}</p>
              <p><span className="font-medium">Objections:</span> {copilot.objectionSummary}</p>
              <p><span className="font-medium">Next action:</span> {copilot.suggestedNextAction}</p>
              <p className="text-xs text-muted-foreground">{copilot.confidenceNote}</p>
            </div>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
