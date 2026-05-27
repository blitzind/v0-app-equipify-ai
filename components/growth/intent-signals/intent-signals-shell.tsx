"use client"

import { useState } from "react"
import {
  Globe,
  Briefcase,
  TrendingUp,
  UserPlus,
  FileText,
  Newspaper,
  Cpu,
  DollarSign,
} from "lucide-react"
import {
  GROWTH_INTENT_SIGNALS_LAYOUT_V2_QA_MARKER,
  INTENT_SIGNAL_TABS,
  type IntentSignalTabId,
} from "@/components/growth/intent-signals/intent-signals-ux-constants"
import {
  IntentSignalsPreviewTab,
  WebsiteVisitorsTab,
} from "@/components/growth/intent-signals/tabs/website-visitors-tab"
import { NewsTab } from "@/components/growth/intent-signals/tabs/news-tab"
import { JobsTab } from "@/components/growth/intent-signals/tabs/jobs-tab"
import { HiresTab } from "@/components/growth/intent-signals/tabs/hires-tab"
import {
  JobChangesTab,
  PromotionsTab,
} from "@/components/growth/intent-signals/tabs/person-signals-tab"
import {
  IntentSignalsWatchlistBar,
  type IntentSignalsWatchlistSelection,
} from "@/components/growth/intent-signals/intent-signals-watchlist-bar"
import { IntentSignalsWatchlistDrawer } from "@/components/growth/intent-signals/intent-signals-watchlist-drawer"
import type { IntentSignalsViewMode } from "@/components/growth/intent-signals/intent-signals-view-toggle"
import type {
  GrowthIntentPixelAdminDiagnostics,
  GrowthIntentPixelProcessRecentResult,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import type { GrowthLiveVisitorMonitorSnapshot } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { cn } from "@/lib/utils"

const TAB_ICONS: Record<IntentSignalTabId, typeof Globe> = {
  "website-visitors": Globe,
  "job-changes": Briefcase,
  promotions: TrendingUp,
  hires: UserPlus,
  jobs: FileText,
  news: Newspaper,
  tech: Cpu,
  funds: DollarSign,
}

export function IntentSignalsShell({
  activeTab,
  onActiveTabChange,
  siteKey,
  schemaReady,
  diagnostics,
  snapshot,
  monitorLoading,
  onOpenSetupDrawer,
  onProcessRecentIntent,
  processingIntent,
  lastHandoff,
  onMonitorRefresh,
}: {
  activeTab: IntentSignalTabId
  onActiveTabChange: (tab: IntentSignalTabId) => void
  siteKey: string
  schemaReady: boolean
  diagnostics: GrowthIntentPixelAdminDiagnostics | null
  snapshot: GrowthLiveVisitorMonitorSnapshot | null
  monitorLoading: boolean
  onOpenSetupDrawer: () => void
  onProcessRecentIntent: () => void
  processingIntent: boolean
  lastHandoff: GrowthIntentPixelProcessRecentResult | null
  onMonitorRefresh?: () => void
}) {
  const [viewMode, setViewMode] = useState<IntentSignalsViewMode>("people")
  const [watchlistSelection, setWatchlistSelection] = useState<IntentSignalsWatchlistSelection>({
    watchlistId: null,
    watchlist: null,
  })
  const [watchlistDrawerOpen, setWatchlistDrawerOpen] = useState(false)
  const [watchlistRefreshToken, setWatchlistRefreshToken] = useState(0)

  const showWatchlists =
    activeTab === "news" ||
    activeTab === "jobs" ||
    activeTab === "hires" ||
    activeTab === "job-changes" ||
    activeTab === "promotions"

  return (
    <div
      className="flex flex-col gap-5"
      data-qa-marker={GROWTH_INTENT_SIGNALS_LAYOUT_V2_QA_MARKER}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max border-b border-border">
          {INTENT_SIGNAL_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab.id]
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onActiveTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {!tab.implemented ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                    Soon
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {showWatchlists ? (
        <IntentSignalsWatchlistBar
          selection={watchlistSelection}
          onSelectionChange={setWatchlistSelection}
          onCreateClick={() => setWatchlistDrawerOpen(true)}
          refreshToken={watchlistRefreshToken}
        />
      ) : null}

      {activeTab === "website-visitors" ? (
        <WebsiteVisitorsTab
          siteKey={siteKey}
          schemaReady={schemaReady}
          diagnostics={diagnostics}
          snapshot={snapshot}
          monitorLoading={monitorLoading}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenSetupDrawer={onOpenSetupDrawer}
          onProcessRecentIntent={onProcessRecentIntent}
          processingIntent={processingIntent}
          lastHandoff={lastHandoff}
          onMonitorRefresh={onMonitorRefresh}
        />
      ) : activeTab === "news" ? (
        <NewsTab
          onOpenSetupDrawer={onOpenSetupDrawer}
          watchlistId={watchlistSelection.watchlistId}
        />
      ) : activeTab === "jobs" ? (
        <JobsTab
          onOpenSetupDrawer={onOpenSetupDrawer}
          watchlistId={watchlistSelection.watchlistId}
        />
      ) : activeTab === "hires" ? (
        <HiresTab
          onOpenSetupDrawer={onOpenSetupDrawer}
          watchlistId={watchlistSelection.watchlistId}
        />
      ) : activeTab === "job-changes" ? (
        <JobChangesTab watchlistId={watchlistSelection.watchlistId} />
      ) : activeTab === "promotions" ? (
        <PromotionsTab watchlistId={watchlistSelection.watchlistId} />
      ) : (
        <IntentSignalsPreviewTab tabId={activeTab} />
      )}

      <IntentSignalsWatchlistDrawer
        open={watchlistDrawerOpen}
        onOpenChange={setWatchlistDrawerOpen}
        onCreated={(watchlist) => {
          setWatchlistSelection({ watchlistId: watchlist.id, watchlist })
          setWatchlistRefreshToken((value) => value + 1)
        }}
      />
    </div>
  )
}
