"use client"

import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthInboxReplyIntelligencePanel } from "@/components/growth/inbox/growth-inbox-reply-intelligence-panel"
import { GrowthInboxWorkflowIntelligenceSummary } from "@/components/growth/inbox/growth-inbox-workflow-intelligence-summary"
import { GrowthSequencePreviewStudioPanel } from "@/components/growth/growth-sequence-preview-studio-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import { GrowthInboxExpandableLazyPanel } from "@/components/growth/inbox/growth-inbox-expandable-lazy-panel"

export const GROWTH_INBOX_WORKFLOW_PANEL_QA_MARKER = "growth-inbox-workflow-panel-v3" as const

/** Phase 8F — workflow intelligence summary first; execution panels lazy-load on expand. */
export function GrowthInboxWorkspaceWorkflowPanel() {
  return (
    <div className="space-y-4" data-qa-marker={GROWTH_INBOX_WORKFLOW_PANEL_QA_MARKER}>
      <GrowthInboxWorkflowIntelligenceSummary />

      <GrowthInboxExpandableLazyPanel
        panelId="workflow-action-center"
        title="Workflow Action Center"
        description="Pending workflow actions and exits"
      >
        <GrowthReplyWorkflowActionsPanel
          showSequenceExit
          title="Workflow Action Center"
          includeEmbeddedSurfaces={false}
          useInboxConcurrencyLimit
        />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="human-interventions"
        title="Human Interventions"
        description="Operator intervention queue"
      >
        <GrowthHumanInterventionsPanel
          title="Human Interventions"
          compact
          useInboxConcurrencyLimit
          lazyPanelId="human-interventions"
        />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="conversational-playbook"
        title="Conversational Playbook"
        description="Knowledge-augmented coaching"
      >
        <GrowthConversationalPlaybooksPanel
          consumer="operator_inbox"
          title="Conversational Playbook"
          compact
          loadOnMount
          useInboxConcurrencyLimit
        />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="reply-intelligence"
        title="Reply Intelligence"
        description="Reply timeline and copilot context"
      >
        <GrowthInboxReplyIntelligencePanel leadId={null} compact />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="smart-follow-up"
        title="Smart Follow-Up Policies"
        description="Deterministic follow-up planning"
      >
        <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" compact useInboxConcurrencyLimit />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="sequence-preview"
        title="Sequence Preview Studio"
        description="Sequence preview recommendations"
      >
        <GrowthSequencePreviewStudioPanel title="Sequence Preview Studio" compact useInboxConcurrencyLimit />
      </GrowthInboxExpandableLazyPanel>
    </div>
  )
}
