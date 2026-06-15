"use client"

import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthInboxLeadContextProvider } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { GrowthInboxSharedDataProvider } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { GrowthInboxActionCenterColumn } from "@/components/growth/inbox/growth-inbox-action-center-column"
import { GrowthInboxConversationColumn } from "@/components/growth/inbox/growth-inbox-conversation-column"
import { GrowthInboxQueueProvider } from "@/components/growth/inbox/growth-inbox-queue-context"
import { GrowthInboxThreadQueueColumn } from "@/components/growth/inbox/growth-inbox-thread-queue-column"
import { GrowthInboxV2SupportingPanels } from "@/components/growth/inbox/growth-inbox-v2-supporting-panels"
import { GrowthOperatorInboxPanel } from "@/components/growth/growth-operator-inbox-panel"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import { GrowthSequencePreviewStudioPanel } from "@/components/growth/growth-sequence-preview-studio-panel"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"
import { GrowthInboxWorkspaceKeyboardBridge } from "@/components/growth/inbox/growth-inbox-workspace-keyboard-bridge"
import { GrowthInboxWorkspaceActionsMenu } from "@/components/growth/inbox/growth-inbox-workspace-actions-menu"
import { GrowthInboxWorkspaceShell } from "@/components/growth/inbox/growth-inbox-workspace-shell"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxSetupEmptyState } from "@/components/growth/growth-inbox-setup-empty-state"
import {
  GROWTH_INBOX_DIAGNOSTICS_HREF,
  GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER,
  GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER,
  GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER,
  GROWTH_INBOX_WORKSPACE_V2_QA_MARKER,
} from "@/lib/growth/inbox/inbox-workspace-types"
import { GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER } from "@/lib/growth/inbox/inbox-runtime-types"
import { GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER } from "@/lib/growth/inbox/inbox-types"
import { OPERATOR_INBOX_QA_MARKER } from "@/lib/growth/operator-inbox/operator-inbox-types"

export function GrowthInboxWorkspaceV2Panel() {
  const {
    loading,
    error,
    actionLoading,
    showHonestEmptyState,
    setupPhase,
    selectedThread,
    load,
  } = useGrowthInboxWorkspace()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading inbox…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER} · {GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER} ·{" "}
          {GROWTH_INBOX_WORKSPACE_V2_QA_MARKER} · {OPERATOR_INBOX_QA_MARKER} · {GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER} ·{" "}
          {GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER} · {GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER} · Primary sales operating surface — human approval only.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/revenue-execution">Revenue Execution</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
          </Button>
          <GrowthInboxWorkspaceActionsMenu />
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {showHonestEmptyState ? <GrowthInboxSetupEmptyState phase={setupPhase} /> : null}

      <GrowthInboxSharedDataProvider>
        <GrowthInboxQueueProvider>
          <GrowthInboxLeadContextProvider
            leadId={selectedThread?.lead_id ?? null}
            threadId={selectedThread?.id ?? null}
            thread={selectedThread}
          >
            <GrowthInboxWorkspaceShell
              threadQueue={<GrowthInboxThreadQueueColumn />}
              conversation={<GrowthInboxConversationColumn />}
              actionCenter={<GrowthInboxActionCenterColumn />}
            />
            <GrowthInboxWorkspaceKeyboardBridge />
          </GrowthInboxLeadContextProvider>
        </GrowthInboxQueueProvider>
      </GrowthInboxSharedDataProvider>

      <GrowthOperatorInboxPanel title="Unified Operator Inbox" compact />

      <GrowthConversationalPlaybooksPanel consumer="operator_inbox" title="Conversational Playbook" compact />

      <GrowthHumanInterventionsPanel title="Human Interventions" compact />

      <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" compact />

      <GrowthSequencePreviewStudioPanel title="Sequence Preview Studio" compact />

      <GrowthCampaignBuilderWizardPanel title="Campaign Builder Wizard" compact />

      <GrowthInboxV2SupportingPanels />
    </div>
  )
}
