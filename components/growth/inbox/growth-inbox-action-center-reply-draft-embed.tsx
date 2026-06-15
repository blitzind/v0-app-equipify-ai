"use client"

import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { GrowthReplyDraftingPanel } from "@/components/growth/growth-reply-drafting-panel"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

export function GrowthInboxActionCenterReplyDraftEmbed() {
  const { selectedThread, actionLoading } = useGrowthInboxWorkspace()

  if (!selectedThread) return null

  return (
    <div id="inbox-reply-draft" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER}>
      <GrowthInboxWidgetErrorBoundary label="Reply drafting">
        <GrowthReplyDraftingPanel threadId={selectedThread.id} disabled={Boolean(actionLoading)} embedded />
      </GrowthInboxWidgetErrorBoundary>
      <div className="mt-4">
        <GrowthConversationalPlaybooksPanel
          consumer="email"
          title="Email Conversational Playbook"
          leadId={selectedThread.lead_id}
          compact
        />
        <GrowthHumanInterventionsPanel
          title="Human Interventions"
          leadId={selectedThread.lead_id}
          compact
        />
        <GrowthSmartFollowUpPoliciesPanel
          title="Smart Follow-Up Policies"
          leadId={selectedThread.lead_id}
          compact
        />
      </div>
    </div>
  )
}
