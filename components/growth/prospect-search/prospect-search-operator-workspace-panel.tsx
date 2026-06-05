"use client"

import { useEffect, useMemo, useState } from "react"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { buildProspectSearchOperatorWorkspace } from "@/lib/growth/prospect-search/prospect-search-workspace"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import { buildProspectSearchWorkspaceExecutionPreview } from "@/lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import { buildProspectSearchWorkspaceWorklistMetrics } from "@/lib/growth/prospect-search/prospect-search-workspace-metrics"
import {
  clearProspectSearchWorkspaceSelection,
  selectAllProspectSearchWorkspaceVisible,
  toggleProspectSearchWorkspaceSelection,
} from "@/lib/growth/prospect-search/prospect-search-workspace-selection"
import { buildProspectSearchWorkspaceWorklistForView } from "@/lib/growth/prospect-search/prospect-search-workspace-worklists"
import type {
  ProspectSearchWorkspaceQueueId,
  ProspectSearchWorkspaceViewId,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { ProspectSearchWorkspaceBulkExecutionResult } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { ProspectSearchWorkspaceSummaryCard } from "@/components/growth/prospect-search/prospect-search-workspace-summary-card"
import { ProspectSearchWorkspaceHealthCard } from "@/components/growth/prospect-search/prospect-search-workspace-health-card"
import { ProspectSearchWorkspaceQueuesCard } from "@/components/growth/prospect-search/prospect-search-workspace-queues-card"
import { ProspectSearchWorkspaceViewSelector } from "@/components/growth/prospect-search/prospect-search-workspace-view-selector"
import { ProspectSearchWorkspaceWorklistCard } from "@/components/growth/prospect-search/prospect-search-workspace-worklist-card"
import { ProspectSearchWorkspaceExecutionPreviewCard } from "@/components/growth/prospect-search/prospect-search-workspace-execution-preview-card"
import { ProspectSearchWorkspaceBulkExecutionCard } from "@/components/growth/prospect-search/prospect-search-workspace-bulk-execution-card"
import { ProspectSearchWorkspaceSelectionBar } from "@/components/growth/prospect-search/prospect-search-workspace-selection-bar"
import { PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE } from "@/lib/growth/prospect-search/prospect-search-workspace-ux"
export function ProspectSearchOperatorWorkspacePanel({
  companies,
  visibleCompanies,
  selectedViewId,
  onSelectView,
  onBulkExecutionComplete,
  className,
}: {
  companies: GrowthProspectSearchCompanyResult[]
  visibleCompanies: GrowthProspectSearchCompanyResult[]
  selectedViewId: ProspectSearchWorkspaceViewId | null
  onSelectView: (viewId: ProspectSearchWorkspaceViewId | null) => void
  onBulkExecutionComplete?: (result: ProspectSearchWorkspaceBulkExecutionResult) => void
  className?: string
}) {
  const [selectedQueueId, setSelectedQueueId] = useState<ProspectSearchWorkspaceQueueId | null>(null)
  const [selection, setSelection] = useState(() => clearProspectSearchWorkspaceSelection())

  const workspace = useMemo(
    () => buildProspectSearchOperatorWorkspace(companies),
    [companies],
  )

  const visibleCompanyKeys = useMemo(
    () => visibleCompanies.map((row) => prospectSearchSelectionKey(row)),
    [visibleCompanies],
  )

  useEffect(() => {
    setSelection(clearProspectSearchWorkspaceSelection())
    setSelectedQueueId(null)
  }, [selectedViewId])

  useEffect(() => {
    if (selectedViewId === "acquire_humans") {
      setSelectedQueueId("acquire_humans")
      return
    }
    const acquireCount =
      workspace.aggregates.research_queues.find((q) => q.queue_id === "acquire_humans")?.count ??
      0
    if (acquireCount > 0 && !selectedQueueId) {
      setSelectedQueueId("acquire_humans")
    }
  }, [selectedViewId, workspace.aggregates.research_queues, selectedQueueId])

  const worklist = useMemo(() => {
    if (!selectedViewId) return null
    return buildProspectSearchWorkspaceWorklistForView({
      companies,
      viewId: selectedViewId,
      company_keys: visibleCompanyKeys,
    })
  }, [companies, selectedViewId, visibleCompanyKeys])

  const selectedCompanyKeys = useMemo(
    () => [...selection.selectedKeys].filter((key) => visibleCompanyKeys.includes(key)),
    [selection.selectedKeys, visibleCompanyKeys],
  )

  const executionPreview = useMemo(() => {
    if (selectedCompanyKeys.length === 0) return null
    return buildProspectSearchWorkspaceExecutionPreview({
      companies,
      company_keys: selectedCompanyKeys,
      queue_id: selectedQueueId,
    })
  }, [companies, selectedCompanyKeys, selectedQueueId])

  const metrics = useMemo(
    () =>
      buildProspectSearchWorkspaceWorklistMetrics({
        visible_company_keys: visibleCompanyKeys,
        selected_company_keys: selectedCompanyKeys,
        preview: executionPreview,
      }),
    [visibleCompanyKeys, selectedCompanyKeys, executionPreview],
  )

  if (workspace.account_count === 0) return null

  const handleSelectView = (viewId: ProspectSearchWorkspaceViewId) => {
    if (selectedViewId === viewId) {
      onSelectView(null)
      return
    }
    onSelectView(viewId)
  }

  return (
    <div
      className={className}
      data-operator-workspace-panel="v1"
      data-qa-marker={workspace.qa_marker}
      data-workspace-fb-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER}
      data-workspace-fc-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER}
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
            onSelectView={handleSelectView}
            filteringActive={Boolean(selectedViewId)}
          />
        </div>
        <ProspectSearchWorkspaceQueuesCard
          researchQueues={workspace.aggregates.research_queues}
          coverageQueues={workspace.aggregates.coverage_queues}
          selectedQueueId={selectedQueueId}
          onSelectQueue={(queueId) =>
            setSelectedQueueId((prev) => (prev === queueId ? null : queueId))
          }
        />
        {selectedViewId ? (
          <>
            <ProspectSearchWorkspaceSelectionBar
              metrics={metrics}
              onSelectAllVisible={() =>
                setSelection(selectAllProspectSearchWorkspaceVisible(selection, visibleCompanyKeys))
              }
              onClearSelection={() => setSelection(clearProspectSearchWorkspaceSelection())}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <ProspectSearchWorkspaceWorklistCard
                worklist={worklist}
                selectedKeys={selection.selectedKeys}
                onToggleAccount={(companyKey, selected) =>
                  setSelection(toggleProspectSearchWorkspaceSelection(selection, companyKey, selected))
                }
              />
              <ProspectSearchWorkspaceExecutionPreviewCard preview={executionPreview} />
            </div>
            <ProspectSearchWorkspaceBulkExecutionCard
              companies={companies}
              selectedCompanyKeys={selectedCompanyKeys}
              selectedQueueId={selectedQueueId}
              preview={executionPreview}
              metrics={metrics}
              onExecutionComplete={onBulkExecutionComplete}
            />
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Select a workspace view to filter results, open the operator worklist, and preview bulk
            execution plans.
          </p>
        )}
      </div>
    </div>
  )
}
