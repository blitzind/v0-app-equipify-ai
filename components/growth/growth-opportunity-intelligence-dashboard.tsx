"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Lightbulb, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthOpportunityRecommendationScoringDetails } from "@/components/growth/growth-opportunity-recommendation-scoring-details"
import { GrowthCampaignReadinessPanel } from "@/components/growth/growth-campaign-readiness-panel"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import {
  GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER,
  recommendationTypeLabel,
  signalTypeLabel,
  type GrowthOpportunitySignalType,
  type GrowthOpportunityIntelligenceDashboard,
  type GrowthOpportunityRecommendation,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"

const CONFIDENCE_TONE: Record<string, "healthy" | "medium" | "attention" | "neutral"> = {
  verified: "healthy",
  high: "healthy",
  medium: "medium",
  low: "neutral",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  intelligence?: GrowthOpportunityIntelligenceDashboard | null
  privacy_note?: string
  message?: string
}

export function GrowthOpportunityIntelligenceDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthOpportunityIntelligenceDashboard | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/opportunities/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.intelligence) {
        throw new Error(payload.message ?? "Could not load opportunity intelligence dashboard.")
      }
      setDashboard(payload.intelligence)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load opportunity intelligence dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function resolveRecommendation(
    recommendation: GrowthOpportunityRecommendation,
    action: "accept" | "dismiss",
  ) {
    setActionLoading(`${action}:${recommendation.id}`)
    try {
      const response = await fetch(
        `/api/platform/growth/opportunities/recommendations/${recommendation.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ humanApprovalConfirmed: true }),
        },
      )
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? `Could not ${action} recommendation.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} recommendation.`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading opportunity intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/inbox">Unified Inbox</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/opportunities">Opportunity Readiness</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Opportunity Intelligence" icon={<Lightbulb className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="High Intent Accounts" value={String(dashboard?.highIntentAccounts.length ?? 0)} />
          <StatTile label="Opportunity Signals" value={String(dashboard?.opportunitySignals.length ?? 0)} />
          <StatTile label="Committee Expansion" value={String(dashboard?.committeeExpansion.length ?? 0)} />
          <StatTile label="Recommended Actions" value={String(dashboard?.recommendedActions.length ?? 0)} />
          <StatTile label="Sequence Pause Candidates" value={String(dashboard?.sequencePauseCandidates.length ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthCampaignReadinessPanel title="Campaign Readiness" compact />

      <GrowthConversationalPlaybooksPanel consumer="opportunity_intelligence" title="Conversational Playbook" compact />

      <GrowthHumanInterventionsPanel title="Human Interventions" compact />

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="High Intent Accounts">
          {(dashboard?.highIntentAccounts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No high-intent accounts detected yet.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.highIntentAccounts ?? []).map((account) => (
                <div key={account.leadId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{account.leadLabel}</p>
                    <p className="text-muted-foreground">{signalTypeLabel(account.topSignal as GrowthOpportunitySignalType)}</p>
                  </div>
                  <GrowthBadge label={`${account.signalCount} signals`} tone="healthy" />
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Buying Signals">
          {(dashboard?.buyingSignals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No buying signals yet.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.buyingSignals ?? []).slice(0, 8).map((signal) => (
                <div key={signal.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={signalTypeLabel(signal.signalType)} tone="attention" />
                    <GrowthBadge label={signal.confidence} tone={CONFIDENCE_TONE[signal.confidence] ?? "neutral"} />
                    <span className="text-xs text-muted-foreground">{signal.leadLabel}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{signal.evidenceSnippet}</p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Recommended Actions">
        {(dashboard?.recommendedActions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending recommendations.</p>
        ) : (
          <div className="space-y-3">
            {(dashboard?.recommendedActions ?? []).map((recommendation) => (
              <div key={recommendation.id} className="rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={recommendationTypeLabel(recommendation.recommendationType)} tone="attention" />
                      <span className="font-medium">{recommendation.title}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{recommendation.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{recommendation.leadLabel}</p>
                    <GrowthOpportunityRecommendationScoringDetails recommendation={recommendation} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(actionLoading)}
                      onClick={() => void resolveRecommendation(recommendation, "accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() => void resolveRecommendation(recommendation, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
                {recommendation.evidence.length > 0 ? (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {recommendation.evidence.map((item, index) => (
                      <p key={`${recommendation.id}-evidence-${index}`} className="text-xs text-muted-foreground">
                        <span className="font-medium">{item.source}:</span> {item.snippet}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Signals">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Account</th>
                  <th className="px-2 py-2 font-medium">Signal</th>
                  <th className="px-2 py-2 font-medium">Confidence</th>
                  <th className="px-2 py-2 font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.opportunitySignals ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                      No opportunity signals yet.
                    </td>
                  </tr>
                ) : (
                  (dashboard?.opportunitySignals ?? []).slice(0, 20).map((signal) => (
                    <tr key={signal.id} className="border-b border-border/70">
                      <td className="px-2 py-3">{signal.leadLabel}</td>
                      <td className="px-2 py-3">{signalTypeLabel(signal.signalType)}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={signal.confidence} tone={CONFIDENCE_TONE[signal.confidence] ?? "neutral"} />
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{formatDate(signal.detectedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Committee Activity">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Account</th>
                  <th className="px-2 py-2 font-medium">Contact</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Strength</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.committeeExpansion ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                      No committee signals yet.
                    </td>
                  </tr>
                ) : (
                  (dashboard?.committeeExpansion ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-border/70">
                      <td className="px-2 py-3">{entry.leadLabel}</td>
                      <td className="px-2 py-3">{entry.contactLabel}</td>
                      <td className="px-2 py-3">{entry.roleHint ?? "—"}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={entry.signalStrength} tone={CONFIDENCE_TONE[entry.signalStrength] ?? "neutral"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Evidence">
        {(dashboard?.recommendedActions ?? []).length === 0 && (dashboard?.opportunitySignals ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Evidence appears when inbox activity generates signals.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.opportunitySignals ?? []).slice(0, 12).map((signal) => (
              <div key={`evidence-${signal.id}`} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={signal.source} tone="neutral" />
                  <GrowthBadge label={signalTypeLabel(signal.signalType)} tone="attention" />
                </div>
                <p className="mt-1 text-muted-foreground">{signal.evidenceSnippet}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Sequence Pause Candidates">
        {(dashboard?.sequencePauseCandidates ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No sequence pause candidates.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.sequencePauseCandidates ?? []).map((candidate) => (
              <div key={candidate.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label="pause candidate" tone="attention" />
                  <span className="font-medium">{candidate.leadLabel}</span>
                </div>
                <p className="mt-1">{candidate.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">{candidate.evidenceSnippet}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}
