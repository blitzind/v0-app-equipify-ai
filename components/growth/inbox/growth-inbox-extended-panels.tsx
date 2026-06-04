"use client"

import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthReplyDraftingPanel } from "@/components/growth/growth-reply-drafting-panel"
import { GrowthInboxOpportunityIntelligencePanel } from "@/components/growth/growth-inbox-opportunity-intelligence-panel"
import { GrowthInboxBookingRecommendationPanel } from "@/components/growth/growth-inbox-booking-recommendation-panel"
import { GrowthInboxRelationshipMemoryPanel } from "@/components/growth/growth-inbox-relationship-memory-panel"
import { GrowthInboxTeamQueuePanel } from "@/components/growth/growth-inbox-team-queue-panel"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { INBOX_SEVERITY_TONE } from "@/components/growth/inbox/growth-inbox-shared-ui"

/** Shared panels preserved below the v2 shell and in legacy layout. */
export function GrowthInboxExtendedPanels() {
  const {
    events,
    intelligence,
    selectedThread,
    actionLoading,
    setSelectedThreadId,
    loadThreadDetail,
  } = useGrowthInboxWorkspace()

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <GrowthEngineCard title="Reply Intelligence">
          <div className="grid gap-2 sm:grid-cols-2">
            <StatTile label="Budget" value={String(intelligence?.budget ?? 0)} />
            <StatTile label="Timeline" value={String(intelligence?.timeline ?? 0)} />
            <StatTile label="Meeting intent" value={String(intelligence?.meeting_intent ?? 0)} />
            <StatTile label="Positive interest" value={String(intelligence?.positive_interest ?? 0)} />
            <StatTile label="Competitor mention" value={String(intelligence?.competitor ?? 0)} />
            <StatTile label="Unsubscribe" value={String(intelligence?.unsubscribe ?? 0)} />
          </div>
          <div className="mt-4 space-y-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={event.severity} tone={INBOX_SEVERITY_TONE[event.severity] ?? "neutral"} />
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
              </div>
            ))}
            {events.length === 0 ? <p className="text-sm text-muted-foreground">No reply intelligence events yet.</p> : null}
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthInboxWidgetErrorBoundary label="Team queue">
        <GrowthInboxTeamQueuePanel
          selectedThreadId={selectedThread?.id ?? null}
          onSelectThread={(threadId) => {
            setSelectedThreadId(threadId)
            void loadThreadDetail(threadId)
          }}
          disabled={Boolean(actionLoading)}
        />
      </GrowthInboxWidgetErrorBoundary>

      {selectedThread ? (
        <>
          <GrowthInboxWidgetErrorBoundary label="Reply drafting">
            <div id="inbox-reply-draft">
              <GrowthReplyDraftingPanel threadId={selectedThread.id} disabled={Boolean(actionLoading)} />
            </div>
          </GrowthInboxWidgetErrorBoundary>

          <GrowthInboxWidgetErrorBoundary label="Opportunity intelligence">
            <GrowthInboxOpportunityIntelligencePanel
              leadId={selectedThread.lead_id}
              threadId={selectedThread.id}
              disabled={Boolean(actionLoading)}
            />
          </GrowthInboxWidgetErrorBoundary>

          <GrowthInboxWidgetErrorBoundary label="Booking recommendations">
            <GrowthInboxBookingRecommendationPanel
              leadId={selectedThread.lead_id}
              threadId={selectedThread.id}
              disabled={Boolean(actionLoading)}
            />
          </GrowthInboxWidgetErrorBoundary>

          <GrowthInboxWidgetErrorBoundary label="Relationship memory">
            <GrowthInboxRelationshipMemoryPanel
              leadId={selectedThread.lead_id}
              threadId={selectedThread.id}
              disabled={Boolean(actionLoading)}
            />
          </GrowthInboxWidgetErrorBoundary>
        </>
      ) : null}
    </>
  )
}
