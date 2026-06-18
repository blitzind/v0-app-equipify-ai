"use client"

import { GrowthFeatureLink } from "@/components/growth/runtime/growth-feature-link"
import { Button } from "@/components/ui/button"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"
import { GrowthAgentOrchestrationPanel } from "@/components/growth/growth-agent-orchestration-panel"
import { GrowthRealtimeEventBusPanel } from "@/components/growth/growth-realtime-event-bus-panel"
import { GrowthInboxDiagnosticsPanel } from "@/components/growth/inbox/growth-inbox-diagnostics-panel"
import { GrowthInboxExpandableLazyPanel } from "@/components/growth/inbox/growth-inbox-expandable-lazy-panel"
import { GrowthInboxV2SupportingPanels } from "@/components/growth/inbox/growth-inbox-v2-supporting-panels"
import { GROWTH_INBOX_DIAGNOSTICS_HREF } from "@/lib/growth/inbox/inbox-workspace-types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { useGrowthTier2ShellVisible } from "@/lib/growth/runtime/use-growth-feature-shell-mounted"
import { usePathname } from "next/navigation"

export const GROWTH_INBOX_OPERATIONS_PANEL_QA_MARKER = "growth-inbox-operations-panel-v3" as const
export const GROWTH_INBOX_OPERATIONS_COLD_STORAGE_QA_MARKER = "growth-inbox-operations-cold-storage-v1" as const

function GrowthInboxOperationsColdStorageNotice() {
  return (
    <div
      className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground"
      data-qa-marker={GROWTH_INBOX_OPERATIONS_COLD_STORAGE_QA_MARKER}
    >
      <p className="font-medium text-foreground">Operations surfaces are in cold storage</p>
      <p className="mt-1 text-xs">
        Campaign builder, agent orchestration, diagnostics, and the realtime event bus are hidden in the operator_minimal
        profile. Platform admins retain access automatically, or set{" "}
        <code className="rounded bg-muted px-1">GROWTH_RUNTIME_PROFILE=full_admin</code> to restore.
      </p>
    </div>
  )
}

/** Phase 8F — diagnostics links render immediately; panels lazy-load on expand. Phase 8H — cold storage shell guards. */
export function GrowthInboxWorkspaceOperationsPanel() {
  const pathname = usePathname()
  const tier2ShellVisible = useGrowthTier2ShellVisible()
  const revenueQueuePath = growthFeaturePath(pathname, "leads")

  if (!tier2ShellVisible) {
    return (
      <div className="space-y-4" data-qa-marker={GROWTH_INBOX_OPERATIONS_PANEL_QA_MARKER}>
        <GrowthInboxOperationsColdStorageNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_INBOX_OPERATIONS_PANEL_QA_MARKER}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <GrowthFeatureLink feature="diagnosticsDashboards" href={GROWTH_INBOX_DIAGNOSTICS_HREF}>
            Inbox Diagnostics
          </GrowthFeatureLink>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <GrowthFeatureLink href={revenueQueuePath}>Revenue Queue</GrowthFeatureLink>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <GrowthFeatureLink href="/admin/growth/revenue-execution">Revenue Execution</GrowthFeatureLink>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <GrowthFeatureLink href="/admin/growth/sequences/execution">Sequence Execution</GrowthFeatureLink>
        </Button>
      </div>

      <GrowthInboxExpandableLazyPanel
        panelId="inbox-diagnostics"
        title="Inbox Diagnostics"
        description="Dashboard and sync health"
        feature="diagnosticsDashboards"
      >
        <GrowthInboxDiagnosticsPanel />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="campaign-builder"
        title="Campaign Builder Wizard"
        description="Human-reviewed campaign planning"
        feature="campaignBuilder"
      >
        <GrowthCampaignBuilderWizardPanel title="Campaign Builder Wizard" compact useInboxConcurrencyLimit />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="agent-orchestration"
        title="Agent Orchestration"
        description="Agent routing recommendations"
        feature="agentOrchestrationDashboard"
      >
        <GrowthAgentOrchestrationPanel title="Agent Orchestration" compact useInboxConcurrencyLimit />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel
        panelId="realtime-event-bus"
        title="Real-Time Event Bus"
        description="Growth realtime events"
        feature="realtimeEventBus"
      >
        <GrowthRealtimeEventBusPanel title="Real-Time Event Bus" compact useInboxConcurrencyLimit />
      </GrowthInboxExpandableLazyPanel>

      <GrowthInboxExpandableLazyPanel panelId="team-queue" title="Team Queue" description="Team inbox and thread routing">
        <GrowthInboxV2SupportingPanels />
      </GrowthInboxExpandableLazyPanel>
    </div>
  )
}
