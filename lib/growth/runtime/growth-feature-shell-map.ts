/**
 * Phase 8H — Tier 2 registry key → shell surface inventory.
 * Documentation + verification; routes and APIs remain registered.
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_INBOX_DIAGNOSTICS_HREF } from "@/lib/growth/inbox/inbox-workspace-types"

export const GROWTH_FEATURE_SHELL_MAP_VERSION = "8h.1" as const

export type GrowthFeatureShellSurface = {
  registryKey: GrowthFeatureKey
  component: string
  routes: readonly string[]
  mountedBy: readonly string[]
  prefetchBehavior: "default" | "disabled_when_cold"
}

const opsRoute = `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations` as const
const workflowRoute = `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow` as const

export const GROWTH_TIER2_SHELL_SURFACES: readonly GrowthFeatureShellSurface[] = [
  {
    registryKey: "campaignBuilder",
    component: "GrowthCampaignBuilderWizardPanel",
    routes: [opsRoute, workflowRoute, "/admin/growth/command"],
    mountedBy: [
      "GrowthInboxWorkspaceOperationsPanel",
      "GrowthInboxWorkspaceWorkflowPanel",
      "GrowthOperatorInboxPanel",
      "GrowthCommandCenterDashboard",
      "GrowthCampaignReadinessPanel",
      "GrowthVoiceDropCampaignsPanel",
      "GrowthLeadOpportunityIntelligencePanel",
      "GrowthOpportunityIntelligenceDashboard",
      "GrowthSequencePatternBuilder",
      "GrowthSmartFollowUpPoliciesPanel",
      "natural-language-discovery-panel",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "sequencePreviewStudio",
    component: "GrowthSequencePreviewStudioPanel",
    routes: [opsRoute, workflowRoute, "/admin/growth/command"],
    mountedBy: [
      "GrowthInboxWorkspaceWorkflowPanel",
      "GrowthOperatorInboxPanel",
      "GrowthCommandCenterDashboard",
      "GrowthCampaignReadinessPanel",
      "GrowthVoiceDropCampaignsPanel",
      "GrowthLeadOpportunityIntelligencePanel",
      "GrowthOpportunityIntelligenceDashboard",
      "GrowthSequencePatternBuilder",
      "GrowthHumanInterventionsPanel",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "agentOrchestrationDashboard",
    component: "GrowthAgentOrchestrationPanel",
    routes: [opsRoute, "/admin/growth/command"],
    mountedBy: [
      "GrowthInboxWorkspaceOperationsPanel",
      "GrowthOperatorInboxPanel",
      "GrowthCommandCenterDashboard",
      "GrowthCampaignReadinessPanel",
      "GrowthVoiceDropCampaignsPanel",
      "GrowthLeadOpportunityIntelligencePanel",
      "GrowthOpportunityIntelligenceDashboard",
      "GrowthHumanInterventionsPanel",
      "GrowthSequencePreviewStudioPanel",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "humanInterventionDashboard",
    component: "GrowthHumanInterventionsPanel",
    routes: [workflowRoute, "/admin/growth/command"],
    mountedBy: [
      "GrowthInboxWorkspaceWorkflowPanel",
      "GrowthOperatorInboxPanel",
      "GrowthCommandCenterDashboard",
      "GrowthCampaignReadinessPanel",
      "GrowthVoiceDropCampaignsPanel",
      "GrowthLeadOpportunityIntelligencePanel",
      "GrowthOpportunityIntelligenceDashboard",
      "GrowthConversationalPlaybooksPanel",
      "GrowthReplyWorkflowActionsPanel",
      "GrowthMeetingPrepPanel",
      "GrowthCallWorkspaceLiveCoachingPanel",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "diagnosticsDashboards",
    component: "GrowthInboxDiagnosticsPanel",
    routes: [opsRoute, GROWTH_INBOX_DIAGNOSTICS_HREF, "/admin/growth/inbox/diagnostics"],
    mountedBy: [
      "GrowthInboxWorkspaceOperationsPanel",
      "GrowthUnifiedInboxDashboardPanel",
      "GrowthOperatorDiagnosticsDisclosure",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "realtimeEventBus",
    component: "GrowthRealtimeEventBusPanel",
    routes: [opsRoute, "/admin/growth/command"],
    mountedBy: [
      "GrowthInboxWorkspaceOperationsPanel",
      "GrowthCommandCenterDashboard",
      "GrowthOpportunityIntelligenceDashboard",
    ],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "executionGraphs",
    component: "GrowthAgentOrchestrationPanel",
    routes: [opsRoute],
    mountedBy: ["GrowthAgentOrchestrationPanel"],
    prefetchBehavior: "disabled_when_cold",
  },
  {
    registryKey: "workflowSummaryAutofetch",
    component: "GrowthInboxWorkflowIntelligenceSummary",
    routes: [workflowRoute],
    mountedBy: ["GrowthInboxWorkspaceWorkflowPanel"],
    prefetchBehavior: "disabled_when_cold",
  },
] as const

export const GROWTH_TIER2_REGISTRY_KEYS = GROWTH_TIER2_SHELL_SURFACES.map((row) => row.registryKey)

export function listGrowthFeatureShellSurfaces(key: GrowthFeatureKey): GrowthFeatureShellSurface[] {
  return GROWTH_TIER2_SHELL_SURFACES.filter((row) => row.registryKey === key)
}

export function listGrowthTier2ShellRoutes(): string[] {
  return [...new Set(GROWTH_TIER2_SHELL_SURFACES.flatMap((row) => row.routes))]
}
