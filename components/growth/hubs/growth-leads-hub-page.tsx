"use client"

import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { Target } from "lucide-react"
import { GrowthLeadsHubTodaysBriefing } from "@/components/growth/hubs/leads/growth-leads-hub-todays-briefing"
import { GrowthLeadsHubResumeSession } from "@/components/growth/hubs/leads/growth-leads-hub-resume-session"
import { GrowthLeadsHubRevenueQueueSummary } from "@/components/growth/hubs/leads/growth-leads-hub-revenue-queue-summary"
import { GrowthLeadsHubOperatorHealth } from "@/components/growth/hubs/leads/growth-leads-hub-operator-health"
import { GrowthLeadsHubRecommendations } from "@/components/growth/hubs/leads/growth-leads-hub-recommendations"
import { GrowthLeadsHubSearch } from "@/components/growth/hubs/leads/growth-leads-hub-search"
import { GrowthLeadsHubPrimaryActions } from "@/components/growth/hubs/leads/growth-leads-hub-primary-actions"
import { GrowthLeadsHubKpiStrip } from "@/components/growth/hubs/leads/growth-leads-hub-kpi-strip"
import { GrowthLeadsHubOperatorLauncher } from "@/components/growth/hubs/leads/growth-leads-hub-operator-launcher"
import {
  GrowthLeadsHubAllSavedSearches,
  GrowthLeadsHubFavoriteSavedSearches,
} from "@/components/growth/hubs/leads/growth-leads-hub-favorite-saved-searches"
import { GrowthLeadsHubActivityTimeline } from "@/components/growth/hubs/leads/growth-leads-hub-activity-timeline"
import { GrowthLeadsHubHeaderActions } from "@/components/growth/hubs/leads/growth-leads-hub-header-actions"
import { GROWTH_LEADS_HUB_UX_QA_MARKER } from "@/lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_WORKSPACE_HUB_QA_MARKER } from "@/lib/growth/hubs/growth-workspace-hub-types"
import { cn } from "@/lib/utils"

/** Fills viewport below Growth chrome so the hub does not end on bare shell background. */
const GROWTH_LEADS_HUB_WORKSPACE_SURFACE =
  "min-h-[calc(100dvh-9.5rem)] rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 lg:min-h-[calc(100dvh-10rem)] lg:p-6"

export function GrowthLeadsHubPage() {
  return (
    <GrowthWorkspacePageContent
      className={cn(GROWTH_LEADS_HUB_WORKSPACE_SURFACE, "gap-5")}
      data-qa-marker={GROWTH_WORKSPACE_HUB_QA_MARKER}
      data-growth-leads-hub-ux={GROWTH_LEADS_HUB_UX_QA_MARKER}
      data-growth-workspace-hub="leads"
    >
      <GrowthWorkspacePageHeader
        title="Leads"
        description="Daily prospecting and revenue operations — search, triage, and move accounts forward."
        icon={Target}
        iconClassName="bg-emerald-50 text-emerald-600"
        actions={<GrowthLeadsHubHeaderActions />}
      />

      <div className="flex flex-1 flex-col gap-5">
        <GrowthLeadsHubTodaysBriefing />
        <GrowthLeadsHubResumeSession />
        <GrowthLeadsHubRevenueQueueSummary />
        <GrowthLeadsHubOperatorHealth />
        <GrowthLeadsHubRecommendations />
        <GrowthLeadsHubSearch />
        <GrowthLeadsHubPrimaryActions />
        <GrowthLeadsHubKpiStrip />
        <GrowthLeadsHubOperatorLauncher />
        <GrowthLeadsHubFavoriteSavedSearches />
        <GrowthLeadsHubActivityTimeline />
        <GrowthLeadsHubAllSavedSearches />
      </div>
    </GrowthWorkspacePageContent>
  )
}
