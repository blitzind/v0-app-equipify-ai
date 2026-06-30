"use client"

import { GrowthInboxLeadContextProvider } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { GrowthInboxSharedDataProvider } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { GrowthInboxConversationColumn } from "@/components/growth/inbox/growth-inbox-conversation-column"
import { GrowthInboxQueueProvider } from "@/components/growth/inbox/growth-inbox-queue-context"
import { GrowthInboxQueueUrlSync } from "@/components/growth/inbox/growth-inbox-queue-url-sync"
import { GrowthInboxThreadUrlSync } from "@/components/growth/inbox/growth-inbox-thread-url-sync"
import { GrowthInboxThreadQueueColumn } from "@/components/growth/inbox/growth-inbox-thread-queue-column"
import { GrowthInboxWorkspaceActionsMenu } from "@/components/growth/inbox/growth-inbox-workspace-actions-menu"
import { GrowthInboxWorkspaceKeyboardBridge } from "@/components/growth/inbox/growth-inbox-workspace-keyboard-bridge"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxCompactPanelState } from "@/components/growth/inbox/growth-inbox-compact-panel-state"
import { GrowthInboxTier1RefreshBridge } from "@/components/growth/inbox/growth-inbox-tier1-refresh-bridge"
import { GrowthInboxTier1PollCoordinatorProvider } from "@/components/growth/inbox/growth-inbox-tier1-poll-coordinator"
import { GrowthInboxActionFirstStrip } from "@/components/growth/inbox/growth-inbox-action-first-strip"
import { GrowthInboxResumeWorkHero } from "@/components/growth/hubs/inbox/growth-inbox-resume-work-hero"
import { GrowthInboxPrimaryWorkspace } from "@/components/growth/hubs/inbox/growth-inbox-primary-workspace"
import { GrowthInboxIntelligenceSidebar } from "@/components/growth/inbox/growth-inbox-intelligence-sidebar"
import { GrowthInboxAdvancedTools } from "@/components/growth/hubs/inbox/growth-inbox-advanced-tools"
import { GROWTH_INBOX_FINAL_POLISH_QA_MARKER } from "@/lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { GROWTH_INBOX_HUB_UX_QA_MARKER } from "@/lib/growth/hubs/growth-inbox-hub-config"
import { GROWTH_INBOX_WORKSPACE_V2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { buildGrowthInboxSetupEmptyState } from "@/lib/growth/inbox/inbox-runtime-types"

export const GROWTH_INBOX_OPERATOR_PANEL_QA_MARKER = "growth-inbox-operator-panel-v5" as const

/** UX-AUDIT-9 — operator daily-driver inbox workspace. */
export function GrowthInboxWorkspaceV2Panel() {
  const {
    loading,
    error,
    showHonestEmptyState,
    setupPhase,
    selectedThread,
    load,
  } = useGrowthInboxWorkspace()

  if (loading) {
    return <GrowthInboxCompactPanelState title="Inbox" state="loading" />
  }

  const setupState = showHonestEmptyState ? buildGrowthInboxSetupEmptyState(setupPhase) : null

  return (
    <div
      className="space-y-2"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
      data-qa-marker={GROWTH_INBOX_OPERATOR_PANEL_QA_MARKER}
      data-growth-inbox-hub-ux={GROWTH_INBOX_HUB_UX_QA_MARKER}
      data-growth-inbox-final-polish={GROWTH_INBOX_FINAL_POLISH_QA_MARKER}
    >
      {error ? (
        <GrowthInboxCompactPanelState title="Inbox" state="error" message={error} onRetry={() => void load()} />
      ) : null}

      {setupState ? (
        <GrowthInboxCompactPanelState title={setupState.title} state="empty" message={setupState.message} />
      ) : null}

      <div className="flex justify-end">
        <GrowthInboxWorkspaceActionsMenu />
      </div>

      <GrowthInboxSharedDataProvider deferUntilLeadId={selectedThread?.lead_id ?? null}>
        <GrowthInboxTier1PollCoordinatorProvider>
          <GrowthInboxTier1RefreshBridge />
          <GrowthInboxQueueProvider>
            <GrowthInboxQueueUrlSync />
            <GrowthInboxThreadUrlSync />
            <GrowthInboxActionFirstStrip />
            <GrowthInboxResumeWorkHero />
            <GrowthInboxLeadContextProvider
              leadId={selectedThread?.lead_id ?? null}
              threadId={selectedThread?.id ?? null}
              thread={selectedThread}
            >
              <GrowthInboxPrimaryWorkspace
                threadQueue={<GrowthInboxThreadQueueColumn />}
                conversation={<GrowthInboxConversationColumn />}
                intelligenceSidebar={<GrowthInboxIntelligenceSidebar />}
              />
              <GrowthInboxWorkspaceKeyboardBridge />
            </GrowthInboxLeadContextProvider>
            <GrowthInboxAdvancedTools />
          </GrowthInboxQueueProvider>
        </GrowthInboxTier1PollCoordinatorProvider>
      </GrowthInboxSharedDataProvider>
    </div>
  )
}
