"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthBookingRecommendation } from "@/lib/growth/booking-intelligence/booking-types"

type GrowthInboxBookingRecommendationPanelProps = {
  leadId: string | null
  threadId: string
  disabled?: boolean
}

export function GrowthInboxBookingRecommendationPanel({
  leadId,
  threadId,
  disabled,
}: GrowthInboxBookingRecommendationPanelProps) {
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<GrowthBookingRecommendation[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!leadId) {
      setRecommendations([])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/booking-intelligence/recommendations?leadId=${encodeURIComponent(leadId)}&status=pending_review`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as { recommendations?: GrowthBookingRecommendation[] }
      setRecommendations(
        (payload.recommendations ?? []).filter(
          (recommendation) => !recommendation.inboxThreadId || recommendation.inboxThreadId === threadId,
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [leadId, threadId])

  useEffect(() => {
    void load()
  }, [load])

  async function recommendationAction(
    recommendation: GrowthBookingRecommendation,
    action: "approve" | "dismiss",
  ) {
    setActionLoading(`${action}:${recommendation.id}`)
    try {
      await fetch(`/api/platform/growth/booking-intelligence/recommendations/${recommendation.id}/${action}`, {
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
    <GrowthEngineCard title="Meeting Booking Recommendation">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading booking recommendations…
        </div>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meeting booking recommendations for this thread.</p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((recommendation) => (
            <div key={recommendation.id} className="rounded-lg border border-border px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label="human approval required" tone="attention" />
                <span className="font-medium">{recommendation.title}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{recommendation.description}</p>
              {recommendation.suggestedOwnerLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">Route to: {recommendation.suggestedOwnerLabel}</p>
              ) : null}
              {recommendation.availabilityHint ? (
                <p className="mt-1 text-xs text-muted-foreground">{recommendation.availabilityHint}</p>
              ) : null}
              {recommendation.evidence.map((item, index) => (
                <p key={`${recommendation.id}-evidence-${index}`} className="mt-1 text-xs text-muted-foreground">
                  {item.snippet}
                </p>
              ))}
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || Boolean(actionLoading)}
                  onClick={() => void recommendationAction(recommendation, "approve")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || Boolean(actionLoading)}
                  onClick={() => void recommendationAction(recommendation, "dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GrowthEngineCard>
  )
}
