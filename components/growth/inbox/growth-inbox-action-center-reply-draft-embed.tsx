"use client"

import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { GrowthReplyDraftingPanel } from "@/components/growth/growth-reply-drafting-panel"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

export function GrowthInboxActionCenterReplyDraftEmbed() {
  const { selectedThread, actionLoading } = useGrowthInboxWorkspace()

  if (!selectedThread) return null

  return (
    <div id="inbox-reply-draft" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER}>
      <GrowthInboxWidgetErrorBoundary label="Reply drafting">
        <GrowthReplyDraftingPanel threadId={selectedThread.id} disabled={Boolean(actionLoading)} />
      </GrowthInboxWidgetErrorBoundary>
    </div>
  )
}
