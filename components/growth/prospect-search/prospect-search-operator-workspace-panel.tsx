"use client"

import { useMemo, useState } from "react"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { buildProspectSearchOperatorWorkspace } from "@/lib/growth/prospect-search/prospect-search-workspace"
import type { ProspectSearchWorkspaceViewId } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { ProspectSearchWorkspaceSummaryCard } from "@/components/growth/prospect-search/prospect-search-workspace-summary-card"
import { ProspectSearchWorkspaceHealthCard } from "@/components/growth/prospect-search/prospect-search-workspace-health-card"
import { ProspectSearchWorkspaceQueuesCard } from "@/components/growth/prospect-search/prospect-search-workspace-queues-card"
import { ProspectSearchWorkspaceViewSelector } from "@/components/growth/prospect-search/prospect-search-workspace-view-selector"
import { PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE } from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

export function ProspectSearchOperatorWorkspacePanel({
  companies,
  className,
}: {
  companies: GrowthProspectSearchCompanyResult[]
  className?: string
}) {
  const [selectedViewId, setSelectedViewId] = useState<ProspectSearchWorkspaceViewId | null>(null)

  const workspace = useMemo(
    () => buildProspectSearchOperatorWorkspace(companies),
    [companies],
  )

  if (workspace.account_count === 0) return null

  return (
    <div
      className={className}
      data-operator-workspace-panel="v1"
      data-qa-marker={workspace.qa_marker}
    >
      <p className="mb-3 text-[11px] text-slate-700">{PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE}</p>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <ProspectSearchWorkspaceSummaryCard
          prioritization={workspace.aggregates.prioritization}
          accountCount={workspace.account_count}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ProspectSearchWorkspaceHealthCard health={workspace.health} />
          <ProspectSearchWorkspaceViewSelector
            views={workspace.views}
            selectedViewId={selectedViewId}
            onSelectView={setSelectedViewId}
          />
        </div>
        <ProspectSearchWorkspaceQueuesCard
          researchQueues={workspace.aggregates.research_queues}
          coverageQueues={workspace.aggregates.coverage_queues}
        />
      </div>
    </div>
  )
}
