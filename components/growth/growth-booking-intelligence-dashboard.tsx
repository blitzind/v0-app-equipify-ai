"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER,
  intentTypeLabel,
  routingRuleTypeLabel,
  type GrowthBookingIntelligenceDashboard,
  type GrowthBookingRecommendation,
} from "@/lib/growth/booking-intelligence/booking-types"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthBookingIntelligenceDashboard
  privacy_note?: string
  message?: string
}

export function GrowthBookingIntelligenceDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthBookingIntelligenceDashboard | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [communicationPreferences, setCommunicationPreferences] = useState<
    Array<{ preferenceValue: string; evidenceSnippet: string; leadLabel: string }>
  >([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/booking-intelligence/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load booking intelligence dashboard.")
      }
      setDashboard(payload.dashboard)

      const memoryRes = await fetch("/api/platform/growth/lead-memory/dashboard", { cache: "no-store" })
      const memoryPayload = (await memoryRes.json().catch(() => ({}))) as {
        dashboard?: {
          communicationPreferences?: Array<{
            preferenceValue: string
            evidenceSnippet: string
            leadLabel: string
          }>
        }
      }
      if (memoryRes.ok && memoryPayload.dashboard) {
        setCommunicationPreferences(memoryPayload.dashboard.communicationPreferences?.slice(0, 8) ?? [])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load booking intelligence dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function recommendationAction(
    recommendation: GrowthBookingRecommendation,
    action: "approve" | "dismiss" | "complete",
  ) {
    setActionLoading(`${action}:${recommendation.id}`)
    try {
      const response = await fetch(
        `/api/platform/growth/booking-intelligence/recommendations/${recommendation.id}/${action}`,
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
        Loading booking intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/inbox">Unified Inbox</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/meetings">Meetings</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/intelligence/relationship-memory">Relationship Memory</Link>
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

      <GrowthEngineCard title="Booking Intelligence" icon={<CalendarClock className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatTile label="Meeting Intent" value={String(dashboard?.meetingIntentCount ?? 0)} />
          <StatTile label="Pending Booking Reviews" value={String(dashboard?.pendingBookingReviews.length ?? 0)} />
          <StatTile label="Approved Booking Actions" value={String(dashboard?.approvedBookingActions.length ?? 0)} />
          <StatTile label="Completed Meetings" value={String(dashboard?.completedMeetings.length ?? 0)} />
          <StatTile label="Sequence Stop Candidates" value={String(dashboard?.sequenceStopCandidates.length ?? 0)} />
          <StatTile label="Conversion Attribution" value={String(dashboard?.conversionAttribution.length ?? 0)} />
        </div>
      </GrowthEngineCard>

      {communicationPreferences.length > 0 ? (
        <GrowthEngineCard title="Preference Memory">
          <p className="mb-3 text-xs text-muted-foreground">
            Communication preferences from relationship memory — use when routing meetings and follow-ups.
          </p>
          <ul className="space-y-2 text-sm">
            {communicationPreferences.map((pref, index) => (
              <li key={`${pref.leadLabel}-${pref.preferenceValue}-${index}`} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-medium">
                  {pref.leadLabel}: {pref.preferenceValue.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">{pref.evidenceSnippet}</p>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Pending Booking Reviews">
        {(dashboard?.pendingBookingReviews ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending booking reviews.</p>
        ) : (
          <RecommendationList
            recommendations={dashboard?.pendingBookingReviews ?? []}
            actionLoading={actionLoading}
            onApprove={(rec) => void recommendationAction(rec, "approve")}
            onDismiss={(rec) => void recommendationAction(rec, "dismiss")}
          />
        )}
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Approved Booking Actions">
          {(dashboard?.approvedBookingActions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved booking actions awaiting completion.</p>
          ) : (
            <RecommendationList
              recommendations={dashboard?.approvedBookingActions ?? []}
              actionLoading={actionLoading}
              onComplete={(rec) => void recommendationAction(rec, "complete")}
            />
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Sequence Stop Candidates">
          {(dashboard?.sequenceStopCandidates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sequence stop candidates.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.sequenceStopCandidates ?? []).map((candidate) => (
                <div key={candidate.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm">
                  <GrowthBadge label="human approval required" tone="attention" />
                  <p className="mt-1 font-medium">{candidate.leadLabel}</p>
                  <p className="text-muted-foreground">{candidate.reason}</p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Booking Recommendations">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Account</th>
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Routing</th>
                <th className="px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.bookingRecommendations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    No booking recommendations yet.
                  </td>
                </tr>
              ) : (
                (dashboard?.bookingRecommendations ?? []).map((recommendation) => (
                  <tr key={recommendation.id} className="border-b border-border/70">
                    <td className="px-2 py-3">{recommendation.leadLabel}</td>
                    <td className="px-2 py-3">{recommendation.title}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={recommendation.status.replace(/_/g, " ")} tone="attention" />
                    </td>
                    <td className="px-2 py-3">
                      {recommendation.routingRuleType ? routingRuleTypeLabel(recommendation.routingRuleType) : "—"}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{formatDate(recommendation.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Intent Signals">
          <div className="space-y-2">
            {(dashboard?.intentSignals ?? []).slice(0, 12).map((signal) => (
              <div key={signal.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={intentTypeLabel(signal.intentType)} tone="healthy" />
                  <span className="text-xs text-muted-foreground">{signal.leadLabel}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{signal.evidenceSnippet}</p>
              </div>
            ))}
            {(dashboard?.intentSignals ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No intent signals yet.</p>
            ) : null}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Routing Rules">
          <div className="space-y-2">
            {(dashboard?.routingRules ?? []).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{rule.label}</p>
                  <p className="text-muted-foreground">{routingRuleTypeLabel(rule.ruleType)} · priority {rule.priority}</p>
                </div>
                <GrowthBadge label={rule.isActive ? "active" : "inactive"} tone={rule.isActive ? "healthy" : "neutral"} />
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Attribution Events">
        {(dashboard?.attributionEvents ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No attribution events yet.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.attributionEvents ?? []).slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={event.eventType.replace(/_/g, " ")} tone="medium" />
                  <span>{event.leadLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(event.occurredAt)} · score {event.weightedScore}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}

function RecommendationList({
  recommendations,
  actionLoading,
  onApprove,
  onDismiss,
  onComplete,
}: {
  recommendations: GrowthBookingRecommendation[]
  actionLoading: string | null
  onApprove?: (recommendation: GrowthBookingRecommendation) => void
  onDismiss?: (recommendation: GrowthBookingRecommendation) => void
  onComplete?: (recommendation: GrowthBookingRecommendation) => void
}) {
  return (
    <div className="space-y-3">
      {recommendations.map((recommendation) => (
        <div key={recommendation.id} className="rounded-lg border border-border px-3 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{recommendation.title}</p>
              <p className="text-muted-foreground">{recommendation.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">{recommendation.leadLabel}</p>
              {recommendation.availabilityHint ? (
                <p className="mt-1 text-xs text-muted-foreground">{recommendation.availabilityHint}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {onApprove ? (
                <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => onApprove(recommendation)}>
                  Approve
                </Button>
              ) : null}
              {onDismiss ? (
                <Button type="button" size="sm" variant="outline" disabled={Boolean(actionLoading)} onClick={() => onDismiss(recommendation)}>
                  Dismiss
                </Button>
              ) : null}
              {onComplete ? (
                <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => onComplete(recommendation)}>
                  Complete
                </Button>
              ) : null}
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
  )
}
