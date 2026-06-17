"use client"

import { GrowthInboxLeadContextProvider } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { GrowthInboxSharedDataProvider } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { GrowthInboxActionCenterColumn } from "@/components/growth/inbox/growth-inbox-action-center-column"
import { GrowthInboxConversationColumn } from "@/components/growth/inbox/growth-inbox-conversation-column"
import { GrowthInboxQueueProvider } from "@/components/growth/inbox/growth-inbox-queue-context"
import { GrowthInboxQueueUrlSync } from "@/components/growth/inbox/growth-inbox-queue-url-sync"
import { GrowthInboxThreadQueueColumn } from "@/components/growth/inbox/growth-inbox-thread-queue-column"
import { GrowthInboxOverviewMetricsPanel } from "@/components/growth/inbox/growth-inbox-overview-metrics-panel"
import { GrowthOperatorInboxPanel } from "@/components/growth/growth-operator-inbox-panel"
import { GrowthInboxWorkspaceActionsMenu } from "@/components/growth/inbox/growth-inbox-workspace-actions-menu"
import { GrowthInboxWorkspaceKeyboardBridge } from "@/components/growth/inbox/growth-inbox-workspace-keyboard-bridge"
import { GrowthInboxWorkspaceShell } from "@/components/growth/inbox/growth-inbox-workspace-shell"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxCompactPanelState } from "@/components/growth/inbox/growth-inbox-compact-panel-state"
import { GROWTH_INBOX_WORKSPACE_V2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { buildGrowthInboxSetupEmptyState } from "@/lib/growth/inbox/inbox-runtime-types"

export const GROWTH_INBOX_OPERATOR_PANEL_QA_MARKER = "growth-inbox-operator-panel-v3" as const

/** Phase 8A.2 — viewport-first inbox: metrics → notifications → tri-column only. */
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

      <GrowthInboxSharedDataProvider>
        <GrowthInboxQueueProvider>
          <GrowthInboxQueueUrlSync />
          <GrowthInboxOverviewMetricsPanel />
          <GrowthOperatorInboxPanel title="Operator Notifications" compact />
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
    </div>
  )
}
