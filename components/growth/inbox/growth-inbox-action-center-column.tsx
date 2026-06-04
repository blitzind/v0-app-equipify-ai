"use client"

import { GrowthInboxActionCenterWorkflowEmbeds } from "@/components/growth/inbox/growth-inbox-action-center-workflow-embeds"
import { GrowthInboxQuickActions } from "@/components/growth/inbox/growth-inbox-quick-actions"
import { GrowthInboxRecommendedActionCard } from "@/components/growth/inbox/growth-inbox-recommended-action-card"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

export function GrowthInboxActionCenterColumn() {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { error: leadContextError } = useGrowthInboxLeadContext()

  if (!selectedThread) {
    return (
      <div className="flex h-full flex-col p-4">
        <h2 className="text-sm font-semibold">Action Center</h2>
        <p className="mt-4 text-sm text-muted-foreground">Select a thread to view recommendations and operator actions.</p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Action Center</h2>
        <p className="text-xs text-muted-foreground">Sales execution workspace — human approval only.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {leadContextError ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{leadContextError}</p>
        ) : null}

        <GrowthInboxRecommendedActionCard />
        <GrowthInboxQuickActions />
        <GrowthInboxActionCenterWorkflowEmbeds />
      </div>
    </div>
  )
}
