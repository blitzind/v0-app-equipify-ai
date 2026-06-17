"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"
import { GrowthAgentOrchestrationPanel } from "@/components/growth/growth-agent-orchestration-panel"
import { GrowthRealtimeEventBusPanel } from "@/components/growth/growth-realtime-event-bus-panel"
import { GrowthInboxDiagnosticsPanel } from "@/components/growth/inbox/growth-inbox-diagnostics-panel"
import { GrowthInboxV2SupportingPanels } from "@/components/growth/inbox/growth-inbox-v2-supporting-panels"
import { GROWTH_INBOX_DIAGNOSTICS_HREF } from "@/lib/growth/inbox/inbox-workspace-types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { usePathname } from "next/navigation"

export const GROWTH_INBOX_OPERATIONS_PANEL_QA_MARKER = "growth-inbox-operations-panel-v3" as const

/** Phase 8A — planning, orchestration, and diagnostics kept out of the operator queue. */
export function GrowthInboxWorkspaceOperationsPanel() {
  const pathname = usePathname()
  const revenueQueuePath = growthFeaturePath(pathname, "leads")

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_INBOX_OPERATIONS_PANEL_QA_MARKER}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={revenueQueuePath}>Revenue Queue</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/revenue-execution">Revenue Execution</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
        </Button>
      </div>

      <GrowthInboxDiagnosticsPanel />

      <GrowthCampaignBuilderWizardPanel title="Campaign Builder Wizard" compact />

      <GrowthAgentOrchestrationPanel title="Agent Orchestration" compact />

      <GrowthRealtimeEventBusPanel title="Real-Time Event Bus" compact />

      <GrowthInboxV2SupportingPanels />
    </div>
  )
}
