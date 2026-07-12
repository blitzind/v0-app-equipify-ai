"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GrowthOpportunityRecommendationScoringDetails } from "@/components/growth/growth-opportunity-recommendation-scoring-details"
import {
  recommendationTypeLabel,
  signalTypeLabel,
  type GrowthOpportunityRecommendation,
  type GrowthOpportunitySignal,
  type GrowthSequencePauseCandidate,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"
import { growthAvaEmptyRecommendations } from "@/lib/growth/workspace/growth-workspace-ava-identity"

type GrowthInboxOpportunityIntelligencePanelProps = {
  leadId: string | null
  threadId: string
  disabled?: boolean
}

type SignalsPayload = { ok?: boolean; signals?: GrowthOpportunitySignal[] }
type RecommendationsPayload = { ok?: boolean; recommendations?: GrowthOpportunityRecommendation[] }

export function GrowthInboxOpportunityIntelligencePanel({
  leadId,
  threadId,
  disabled,
}: GrowthInboxOpportunityIntelligencePanelProps) {
  const { teammate } = useAiTeammateIdentity()
  const [loading, setLoading] = useState(false)
  const [signals, setSignals] = useState<GrowthOpportunitySignal[]>([])
  const [recommendations, setRecommendations] = useState<GrowthOpportunityRecommendation[]>([])
  const [pauseCandidates, setPauseCandidates] = useState<GrowthSequencePauseCandidate[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!leadId) {
      setSignals([])
      setRecommendations([])
      setPauseCandidates([])
      return
    }
    setLoading(true)
    try {
      const query = `leadId=${encodeURIComponent(leadId)}`
      const [signalsResponse, dashboardResponse] = await Promise.all([
        fetch(`/api/platform/growth/opportunities/signals?${query}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/opportunities/dashboard?${query}`, { cache: "no-store" }),
      ])
      const signalsPayload = (await signalsResponse.json()) as SignalsPayload
      const dashboardPayload = (await dashboardResponse.json()) as {
        intelligence?: {
          recommendedActions?: GrowthOpportunityRecommendation[]
          sequencePauseCandidates?: GrowthSequencePauseCandidate[]
        }
      }
      setSignals(
        (signalsPayload.signals ?? []).filter(
          (signal) => !signal.inboxThreadId || signal.inboxThreadId === threadId,
        ),
      )
      setRecommendations(
        (dashboardPayload.intelligence?.recommendedActions ?? []).filter(
          (recommendation) => !recommendation.inboxThreadId || recommendation.inboxThreadId === threadId,
        ),
      )
      setPauseCandidates(dashboardPayload.intelligence?.sequencePauseCandidates ?? [])
    } finally {
      setLoading(false)
    }
  }, [leadId, threadId])

  useEffect(() => {
    void load()
  }, [load])

  async function resolveRecommendation(
    recommendation: GrowthOpportunityRecommendation,
    action: "accept" | "dismiss",
  ) {
    setActionLoading(`${action}:${recommendation.id}`)
    try {
      await fetch(`/api/platform/growth/opportunities/recommendations/${recommendation.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  if (!leadId) return null

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <GrowthEngineCard title="Recommendation Panel">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading recommendations…
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{growthAvaEmptyRecommendations(teammate)}</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={recommendationTypeLabel(recommendation.recommendationType)} tone="attention" />
                  <span className="font-medium">{recommendation.title}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{recommendation.description}</p>
                <GrowthOpportunityRecommendationScoringDetails recommendation={recommendation} />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled || Boolean(actionLoading)}
                    onClick={() => void resolveRecommendation(recommendation, "accept")}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || Boolean(actionLoading)}
                    onClick={() => void resolveRecommendation(recommendation, "dismiss")}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Evidence Panel">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading evidence…
          </div>
        ) : signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence snippets for this thread.</p>
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={signalTypeLabel(signal.signalType)} tone="attention" />
                  <GrowthBadge label={signal.confidence} tone="medium" />
                </div>
                <p className="mt-1 text-muted-foreground">{signal.evidenceSnippet}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Pause Sequence Recommendation">
        {pauseCandidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sequence pause candidates for this account.</p>
        ) : (
          <div className="space-y-2">
            {pauseCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm">
                <GrowthBadge label="human approval required" tone="attention" />
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
