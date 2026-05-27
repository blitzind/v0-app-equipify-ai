"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  intentTypeLabel,
  type GrowthBookingIntelligenceDashboard,
  type GrowthBookingRecommendation,
} from "@/lib/growth/booking-intelligence/booking-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadBookingIntelligencePanelProps = {
  lead: GrowthLead
}

export function GrowthLeadBookingIntelligencePanel({ lead }: GrowthLeadBookingIntelligencePanelProps) {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<GrowthBookingIntelligenceDashboard | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/booking-intelligence/dashboard?leadId=${encodeURIComponent(lead.id)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as { dashboard?: GrowthBookingIntelligenceDashboard }
      if (response.ok && payload.dashboard) setDashboard(payload.dashboard)
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function recommendationAction(
    recommendation: GrowthBookingRecommendation,
    action: "approve" | "dismiss" | "complete",
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

  const pendingCount = dashboard?.pendingBookingReviews.length ?? 0
  const intentCount = dashboard?.intentSignals.length ?? 0
  const collapsedSummary = loading ? "Loading…" : `${intentCount} intents · ${pendingCount} pending`

  return (
    <GrowthCollapsibleEngineCard
      title="Booking Intelligence"
      icon={<CalendarClock className="size-4" />}
      headerAside={collapsedSummary}
      persistKey={GROWTH_DRAWER_CARD_KEYS.bookingIntelligence}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading booking intelligence…
        </div>
      ) : (
        <div className="space-y-4">
          {(dashboard?.intentSignals ?? []).length > 0 ? (
            <div className="space-y-2">
              {(dashboard?.intentSignals ?? []).slice(0, 4).map((signal) => (
                <div key={signal.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <GrowthBadge label={intentTypeLabel(signal.intentType)} tone="healthy" />
                  <p className="mt-1 text-xs text-muted-foreground">{signal.evidenceSnippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No meeting intent signals for this account.</p>
          )}

          {(dashboard?.pendingBookingReviews ?? []).length > 0 ? (
            <div className="space-y-2">
              {(dashboard?.pendingBookingReviews ?? []).slice(0, 3).map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{recommendation.title}</p>
                  <p className="text-xs text-muted-foreground">{recommendation.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(actionLoading)}
                      onClick={() => void recommendationAction(recommendation, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() => void recommendationAction(recommendation, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
