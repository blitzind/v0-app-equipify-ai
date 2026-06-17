"use client"

import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthInboxReplyIntelligencePanel } from "@/components/growth/inbox/growth-inbox-reply-intelligence-panel"
import { GrowthInboxWorkflowIntelligenceSummary } from "@/components/growth/inbox/growth-inbox-workflow-intelligence-summary"
import { GrowthSequencePreviewStudioPanel } from "@/components/growth/growth-sequence-preview-studio-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"

export const GROWTH_INBOX_WORKFLOW_PANEL_QA_MARKER = "growth-inbox-workflow-panel-v3" as const

/** Phase 8A.2 — each execution surface mounted once; no nested duplicate panels. */
export function GrowthInboxWorkspaceWorkflowPanel() {
  return (
    <div className="space-y-4" data-qa-marker={GROWTH_INBOX_WORKFLOW_PANEL_QA_MARKER}>
      <GrowthInboxWorkflowIntelligenceSummary />
      <GrowthReplyWorkflowActionsPanel
        showSequenceExit
        title="Workflow Action Center"
        includeEmbeddedSurfaces={false}
      />
      <GrowthHumanInterventionsPanel title="Human Interventions" compact />
      <GrowthConversationalPlaybooksPanel consumer="operator_inbox" title="Conversational Playbook" compact />
      <GrowthInboxReplyIntelligencePanel leadId={null} compact />
      <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" compact />
      <GrowthSequencePreviewStudioPanel title="Sequence Preview Studio" compact />
    </div>
  )
}
