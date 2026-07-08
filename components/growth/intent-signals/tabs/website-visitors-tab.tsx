"use client"

import { Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IntentSignalsFilterBar } from "@/components/growth/intent-signals/intent-signals-filter-bar"
import { IntentSignalsMetricsRow } from "@/components/growth/intent-signals/intent-signals-metrics-row"
import { IntentSignalsPreviewBanner } from "@/components/growth/intent-signals/intent-signals-preview-banner"
import { IntentSignalsPreviewState } from "@/components/growth/intent-signals/intent-signals-preview-state"
import { IntentSignalsViewToggle } from "@/components/growth/intent-signals/intent-signals-view-toggle"
import { IntentSignalsWebsiteVisitorsTable } from "@/components/growth/intent-signals/intent-signals-website-visitors-table"
import {
  getIntentSignalTabMeta,
  type IntentSignalTabId,
} from "@/components/growth/intent-signals/intent-signals-ux-constants"
import { HighIntentQueuePanel } from "@/components/growth/intent-pixel-monitor/high-intent-queue-panel"
import { VisitorTimelinePanel } from "@/components/growth/intent-pixel-monitor/visitor-timeline-panel"
import type { GrowthIntentPixelAdminDiagnostics } from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import type { GrowthLiveVisitorMonitorSnapshot } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import type { GrowthIntentPixelProcessRecentResult } from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import type { IntentSignalsViewMode } from "@/components/growth/intent-signals/intent-signals-view-toggle"

export function WebsiteVisitorsTab({
  siteKey,
  schemaReady,
  diagnostics,
  snapshot,
  monitorLoading,
  viewMode,
  onViewModeChange,
  onOpenSetupDrawer,
  onProcessRecentIntent,
  processingIntent,
  lastHandoff,
  onMonitorRefresh,
}: {
  siteKey: string
  schemaReady: boolean
  diagnostics: GrowthIntentPixelAdminDiagnostics | null
  snapshot: GrowthLiveVisitorMonitorSnapshot | null
  monitorLoading: boolean
  viewMode: IntentSignalsViewMode
  onViewModeChange: (mode: IntentSignalsViewMode) => void
  onOpenSetupDrawer: () => void
  onProcessRecentIntent: () => void
  processingIntent: boolean
  lastHandoff: GrowthIntentPixelProcessRecentResult | null
  onMonitorRefresh?: () => void
}) {
  const tabMeta = getIntentSignalTabMeta("website-visitors")
  const receivingEvents = diagnostics?.install_status === "receiving"
  const showLiveResults = schemaReady && receivingEvents
  const showPreview = !showLiveResults

  const totalResults = showLiveResults
    ? (snapshot?.live_visitors.length ?? diagnostics?.session_count_24h ?? null)
    : null

  return (
    <div className="flex flex-col gap-4">
      {showPreview ? <IntentSignalsPreviewBanner /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <IntentSignalsFilterBar
          filters={tabMeta.filters}
          sourceLabel={siteKey}
          sourceDisabled={false}
        />
        {showLiveResults ? (
          <IntentSignalsViewToggle mode={viewMode} onChange={onViewModeChange} />
        ) : null}
      </div>

      <IntentSignalsMetricsRow
        totalCount={
          showLiveResults
            ? (totalResults ?? diagnostics?.session_count_24h ?? 0)
            : tabMeta.sampleMetrics.total
        }
        count24h={showLiveResults ? (diagnostics?.session_count_24h ?? null) : tabMeta.sampleMetrics.h24}
        count7d={showLiveResults ? null : tabMeta.sampleMetrics.d7}
        count30d={showLiveResults ? null : tabMeta.sampleMetrics.d30}
        isPreview={showPreview}
        exportDisabled
      />

      {monitorLoading && showLiveResults ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading visitors" />
        </div>
      ) : null}

      {showPreview ? (
        <IntentSignalsPreviewState
          columns={tabMeta.columns}
          sampleRows={tabMeta.sampleRows}
          title={tabMeta.emptyState.title}
          description={tabMeta.emptyState.description}
          ctaLabel={tabMeta.emptyState.ctaLabel}
          onCtaClick={onOpenSetupDrawer}
          ctaSoonBadge={false}
        />
      ) : (
        <>
          <IntentSignalsWebsiteVisitorsTable
            visitors={snapshot?.live_visitors ?? []}
            viewMode={viewMode}
          />

          {schemaReady ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <Button size="sm" onClick={onProcessRecentIntent} disabled={processingIntent}>
                {processingIntent ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Inbox className="mr-2 size-4" />
                )}
                Process recent intent
              </Button>
              <p className="text-xs text-muted-foreground">
                Runs Intent → Lead Bridge on recent sessions and adds eligible sessions to Revenue Queue.
              </p>
              {lastHandoff && lastHandoff.growth_lead_ids.length > 0 ? (
                <p className="w-full text-xs text-muted-foreground">
                  Latest handoff: {lastHandoff.ingested_count} lead(s). Review in{" "}
                  <a href="/admin/growth/leads/queue" className="font-medium text-violet-700 underline">
                    Revenue Queue
                  </a>
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          <HighIntentQueuePanel
            queue={snapshot?.high_intent_queue ?? []}
            siteKey={siteKey}
            onProcessed={onMonitorRefresh}
          />
          <VisitorTimelinePanel timeline={snapshot?.visitor_timeline ?? []} />
        </>
      )}
    </div>
  )
}

export function IntentSignalsPreviewTab({
  tabId,
}: {
  tabId: Exclude<IntentSignalTabId, "website-visitors">
}) {
  const tabMeta = getIntentSignalTabMeta(tabId)

  return (
    <div className="flex flex-col gap-4">
      <IntentSignalsPreviewBanner />
      <IntentSignalsFilterBar filters={tabMeta.filters} sourceDisabled />
      <IntentSignalsMetricsRow
        totalCount={tabMeta.sampleMetrics.total}
        count24h={tabMeta.sampleMetrics.h24}
        count7d={tabMeta.sampleMetrics.d7}
        count30d={tabMeta.sampleMetrics.d30}
        isPreview
        exportDisabled
      />
      <IntentSignalsPreviewState
        columns={tabMeta.columns}
        sampleRows={tabMeta.sampleRows}
        title={tabMeta.emptyState.title}
        description={tabMeta.emptyState.description}
        ctaLabel={tabMeta.emptyState.ctaLabel}
        showCta
        ctaSoonBadge
      />
    </div>
  )
}
