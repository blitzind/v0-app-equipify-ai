"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"

export function GrowthInboxActionCenterBookingEmbed() {
  const { bookingRecommendations, loading, refresh } = useGrowthInboxLeadContext()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function recommendationAction(recommendationId: string, action: "approve" | "dismiss") {
    setActionLoading(`${action}:${recommendationId}`)
    try {
      await fetch(`/api/platform/growth/booking-intelligence/recommendations/${recommendationId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      await refresh()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking Recommendations</p>
      {loading && bookingRecommendations.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : bookingRecommendations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending booking recommendations.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {bookingRecommendations.slice(0, 3).map((recommendation) => (
            <li key={recommendation.id} className="rounded-md border border-border px-2 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <GrowthBadge label="human approval required" tone="attention" />
                <span className="font-medium">{recommendation.title}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{recommendation.description}</p>
              <div className="mt-2 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  disabled={Boolean(actionLoading)}
                  onClick={() => void recommendationAction(recommendation.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  disabled={Boolean(actionLoading)}
                  onClick={() => void recommendationAction(recommendation.id, "dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
