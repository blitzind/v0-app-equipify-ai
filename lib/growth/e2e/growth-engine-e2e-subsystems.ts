/** Phase GE-HARDEN-1 — Growth Engine E2E subsystem registry (client-safe). */

import { buildAgentOrchestrationReadinessPayload } from "@/lib/growth/agent-orchestration/agent-orchestration-route-gates"
import { AGENT_ORCHESTRATION_QA_MARKER } from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import { buildCampaignBuilderReadinessPayload } from "@/lib/growth/campaign-builder/campaign-builder-route-gates"
import { CAMPAIGN_BUILDER_QA_MARKER } from "@/lib/growth/campaign-builder/campaign-builder-types"
import { buildCampaignReadinessReadinessPayload } from "@/lib/growth/campaign-readiness/campaign-readiness-route-gates"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { buildCommandCenterUnificationReadinessPayload } from "@/lib/growth/command-center-unification/command-center-unification-route-gates"
import { COMMAND_CENTER_UNIFICATION_QA_MARKER } from "@/lib/growth/command-center-unification/command-center-unification-types"
import { buildConversationalPlaybookReadinessPayload } from "@/lib/growth/conversational-playbooks/conversational-playbook-route-gates"
import { CONVERSATIONAL_PLAYBOOK_QA_MARKER } from "@/lib/growth/conversational-playbooks/conversational-playbook-types"
import type { GrowthEngineE2ESubsystemId } from "@/lib/growth/e2e/growth-engine-e2e-types"
import { buildSmartFollowUpPolicyReadinessPayload } from "@/lib/growth/follow-up-policies/follow-up-policy-route-gates"
import { SMART_FOLLOW_UP_POLICY_QA_MARKER } from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import { buildHumanInterventionReadinessPayload } from "@/lib/growth/human-interventions/human-intervention-route-gates"
import { HUMAN_INTERVENTION_QA_MARKER } from "@/lib/growth/human-interventions/human-intervention-types"
import { buildOperatorInboxReadinessPayload } from "@/lib/growth/operator-inbox/operator-inbox-route-gates"
import { OPERATOR_INBOX_QA_MARKER } from "@/lib/growth/operator-inbox/operator-inbox-types"
import { buildProspectDiscoveryReadinessPayload } from "@/lib/growth/prospect-discovery/prospect-search-certification"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { buildRealtimeEventsReadinessPayload } from "@/lib/growth/realtime-events/realtime-events-route-gates"
import { REALTIME_EVENTS_QA_MARKER } from "@/lib/growth/realtime-events/realtime-events-types"
import { buildSequencePreviewReadinessPayload } from "@/lib/growth/sequence-preview/sequence-preview-route-gates"
import { SEQUENCE_PREVIEW_QA_MARKER } from "@/lib/growth/sequence-preview/sequence-preview-types"
import { buildSignalFeedReadinessPayload } from "@/lib/growth/signal-intelligence/signal-feed-route-gates"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"

export type GrowthEngineE2ESubsystemDefinition = {
  subsystem_id: GrowthEngineE2ESubsystemId
  phase: string
  qa_marker: string
  readiness_route: string
  execute_route: string
  buildReadiness: () => Record<string, unknown>
}

/** Full workflow chain in deterministic order. */
export const GROWTH_ENGINE_E2E_CHAIN: GrowthEngineE2ESubsystemId[] = [
  "prospect_discovery",
  "signal_feed",
  "operator_inbox",
  "campaign_readiness",
  "conversational_playbooks",
  "human_interventions",
  "follow_up_policies",
  "sequence_preview",
  "campaign_builder",
  "realtime_events",
  "agent_orchestration",
  "command_center_unification",
]

export const GROWTH_ENGINE_E2E_SUBSYSTEMS: GrowthEngineE2ESubsystemDefinition[] = [
  {
    subsystem_id: "prospect_discovery",
    phase: "GS-2A",
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    readiness_route: "/api/platform/growth/prospect-discovery/readiness",
    execute_route: "/api/platform/growth/prospect-discovery/execute",
    buildReadiness: buildProspectDiscoveryReadinessPayload,
  },
  {
    subsystem_id: "signal_feed",
    phase: "GS-1D",
    qa_marker: SIGNAL_FEED_QA_MARKER,
    readiness_route: "/api/platform/growth/signal-feed/readiness",
    execute_route: "/api/platform/growth/signal-feed/execute",
    buildReadiness: () => buildSignalFeedReadinessPayload(),
  },
  {
    subsystem_id: "operator_inbox",
    phase: "GS-1E",
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    readiness_route: "/api/platform/growth/operator-inbox/readiness",
    execute_route: "/api/platform/growth/operator-inbox/execute",
    buildReadiness: buildOperatorInboxReadinessPayload,
  },
  {
    subsystem_id: "campaign_readiness",
    phase: "GS-2E",
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    readiness_route: "/api/platform/growth/campaign-readiness/readiness",
    execute_route: "/api/platform/growth/campaign-readiness/execute",
    buildReadiness: buildCampaignReadinessReadinessPayload,
  },
  {
    subsystem_id: "conversational_playbooks",
    phase: "GS-3D",
    qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
    readiness_route: "/api/platform/growth/conversational-playbooks/readiness",
    execute_route: "/api/platform/growth/conversational-playbooks/execute",
    buildReadiness: buildConversationalPlaybookReadinessPayload,
  },
  {
    subsystem_id: "human_interventions",
    phase: "GS-3E",
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
    readiness_route: "/api/platform/growth/human-interventions/readiness",
    execute_route: "/api/platform/growth/human-interventions/execute",
    buildReadiness: buildHumanInterventionReadinessPayload,
  },
  {
    subsystem_id: "follow_up_policies",
    phase: "GS-5C",
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    readiness_route: "/api/platform/growth/follow-up-policies/readiness",
    execute_route: "/api/platform/growth/follow-up-policies/execute",
    buildReadiness: buildSmartFollowUpPolicyReadinessPayload,
  },
  {
    subsystem_id: "sequence_preview",
    phase: "GS-5B",
    qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
    readiness_route: "/api/platform/growth/sequence-preview/readiness",
    execute_route: "/api/platform/growth/sequence-preview/execute",
    buildReadiness: buildSequencePreviewReadinessPayload,
  },
  {
    subsystem_id: "campaign_builder",
    phase: "GS-5D",
    qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
    readiness_route: "/api/platform/growth/campaign-builder/readiness",
    execute_route: "/api/platform/growth/campaign-builder/execute",
    buildReadiness: buildCampaignBuilderReadinessPayload,
  },
  {
    subsystem_id: "realtime_events",
    phase: "GS-4C",
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    readiness_route: "/api/platform/growth/realtime-events/readiness",
    execute_route: "/api/platform/growth/realtime-events/execute",
    buildReadiness: buildRealtimeEventsReadinessPayload,
  },
  {
    subsystem_id: "agent_orchestration",
    phase: "GS-4D",
    qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
    readiness_route: "/api/platform/growth/agent-orchestration/readiness",
    execute_route: "/api/platform/growth/agent-orchestration/execute",
    buildReadiness: buildAgentOrchestrationReadinessPayload,
  },
  {
    subsystem_id: "command_center_unification",
    phase: "GS-6A",
    qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
    readiness_route: "/api/platform/growth/command-center-unification/readiness",
    execute_route: "/api/platform/growth/command-center-unification/execute",
    buildReadiness: buildCommandCenterUnificationReadinessPayload,
  },
]
