/** Phase GS-6A — Command Center Unification server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { fetchCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-service"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import {
  buildGrowthCommandCenterUnificationResponse,
  buildGrowthLeadWorkspace,
  type CommandCenterAggregationContext,
} from "@/lib/growth/command-center-unification/command-center-unification-engine"
import {
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  type CommandCenterUnificationActionType,
  type CommandCenterUnificationAuditEvent,
  type CommandCenterUnificationFilter,
  type GrowthCommandCenterLeadWorkspace,
  type GrowthCommandCenterUnificationResponse,
  type GrowthCommandCenterWorkspace,
} from "@/lib/growth/command-center-unification/command-center-unification-types"
import { loadConversationalPlaybookForRequest } from "@/lib/growth/conversational-playbooks/conversational-playbook-service"
import { fetchSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-service"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { fetchGrowthHumanExecutionQueueView } from "@/lib/growth/human-execution/human-execution-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { fetchGrowthRealtimeEvents } from "@/lib/growth/realtime-events/realtime-events-service"
import { fetchSequencePreviewStudio } from "@/lib/growth/sequence-preview/sequence-preview-service"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistCommandCenterUnificationAudit(
  admin: SupabaseClient,
  input: {
    event_name: CommandCenterUnificationAuditEvent
    workspace: GrowthCommandCenterWorkspace | GrowthCommandCenterLeadWorkspace
    organization_id: string
    operator_id?: string | null
    navigation_target?: string | null
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: input.organization_id,
      event_type: "scored",
      event_payload: {
        qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
        event_name: input.event_name,
        command_center_unification: true,
        workspace_id: input.workspace.workspace_id,
        workspace_status: input.workspace.workspace_status,
        lead_id: "lead_id" in input.workspace ? input.workspace.lead_id : null,
        workspace: input.workspace,
        navigation_target: input.navigation_target ?? null,
        operator_id: input.operator_id ?? null,
        occurred_at: now,
        requires_human_review: true,
        requires_human_approval: true,
        enrollment_enabled: false,
        outreach_enabled: false,
        outreach_execution: false,
        enrollment_execution: false,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

async function loadAggregationContext(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    pattern_id?: string | null
    limit?: number
    include_campaign_readiness?: boolean
  },
): Promise<CommandCenterAggregationContext> {
  const includeReadiness = input?.include_campaign_readiness !== false
  const limit = input?.limit ?? 15

  const [
    signalFeed,
    operatorInbox,
    interventions,
    followUpPolicies,
    sequencePreviews,
    campaignBuilder,
    agentOrchestration,
    realtimeEvents,
    humanExecutionQueue,
    playbookResult,
    readiness,
    lead,
  ] = await Promise.all([
    loadGrowthSignalFeed(admin, { lead_id: input?.lead_id, limit: 50 }).catch(() => null),
    fetchOperatorInboxQueue(admin, { lead_id: input?.lead_id, limit }).catch(() => null),
    input?.lead_id
      ? fetchHumanInterventions(admin, { lead_id: input.lead_id, limit, persist_audit: false }).catch(() => null)
      : fetchHumanInterventions(admin, { limit, persist_audit: false }).catch(() => null),
    input?.lead_id
      ? fetchSmartFollowUpPolicies(admin, { lead_id: input.lead_id, limit, persist_audit: false }).catch(() => null)
      : fetchSmartFollowUpPolicies(admin, { limit, persist_audit: false }).catch(() => null),
    fetchSequencePreviewStudio(admin, {
      lead_id: input?.lead_id,
      pattern_id: input?.pattern_id,
      limit,
      persist_audit: false,
    }).catch(() => null),
    fetchCampaignBuilderWizard(admin, {
      lead_id: input?.lead_id,
      pattern_id: input?.pattern_id,
      limit,
      include_campaign_readiness: false,
      persist_audit: false,
    }).catch(() => null),
    fetchGrowthAgentOrchestration(admin, {
      lead_id: input?.lead_id,
      pattern_id: input?.pattern_id,
      limit,
      persist_audit: false,
    }).catch(() => null),
    fetchGrowthRealtimeEvents(admin, { limit: 20 }).catch(() => null),
    fetchGrowthHumanExecutionQueueView(admin).catch(() => null),
    input?.lead_id
      ? loadConversationalPlaybookForRequest(admin, {
          consumer: "operator_inbox",
          lead_id: input.lead_id,
        }).catch(() => ({ ok: false as const }))
      : Promise.resolve({ ok: false as const }),
    includeReadiness && input?.lead_id
      ? loadCampaignReadinessAssessment(admin, { lead_id: input.lead_id }).catch(() => null)
      : Promise.resolve(null),
    input?.lead_id ? fetchGrowthLeadById(admin, input.lead_id).catch(() => null) : Promise.resolve(null),
  ])

  return {
    signal_feed: signalFeed,
    operator_inbox: operatorInbox,
    interventions,
    follow_up_policies: followUpPolicies,
    sequence_previews: sequencePreviews,
    campaign_builder: campaignBuilder,
    agent_orchestration: agentOrchestration,
    realtime_events: realtimeEvents,
    human_execution_queue: humanExecutionQueue,
    playbook: playbookResult.ok ? playbookResult.playbook : null,
    campaign_readiness: readiness?.assessment ?? null,
    lead_id: input?.lead_id ?? null,
    company_name: lead?.companyName ?? readiness?.assessment.company_name ?? null,
  }
}

export async function fetchGrowthCommandCenterUnification(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    pattern_id?: string | null
    filter?: CommandCenterUnificationFilter
    limit?: number
    include_campaign_readiness?: boolean
    persist_audit?: boolean
    lead_workspace_limit?: number
  },
): Promise<GrowthCommandCenterUnificationResponse> {
  const ctx = await loadAggregationContext(admin, input)

  const leadWorkspaces: GrowthCommandCenterLeadWorkspace[] = []
  if (input?.lead_id) {
    leadWorkspaces.push(buildGrowthLeadWorkspace(ctx))
  }

  const response = buildGrowthCommandCenterUnificationResponse(ctx, leadWorkspaces)

  if (input?.filter === "blocked") {
    response.views = response.views.map((view) => ({
      ...view,
      items: view.items.filter((item) => item.view_id === "campaign_blocked"),
    }))
  } else if (input?.filter === "needs_attention") {
    response.views = response.views.map((view) => ({
      ...view,
      items: view.items.filter(
        (item) => item.view_id === "needs_attention" || item.priority === "urgent" || item.priority === "high",
      ),
    }))
  } else if (input?.filter === "ready") {
    response.views = response.views.map((view) => ({
      ...view,
      items: view.items.filter((item) => item.view_id === "ready_for_outreach"),
    }))
  }

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id) {
      await persistCommandCenterUnificationAudit(admin, {
        event_name: "command_center_workspace_generated",
        workspace: response,
        organization_id,
      })
    }
  }

  return response
}

export async function fetchGrowthCommandCenterLeadWorkspace(
  admin: SupabaseClient,
  input: {
    lead_id: string
    pattern_id?: string | null
    limit?: number
    persist_audit?: boolean
  },
): Promise<GrowthCommandCenterLeadWorkspace> {
  const ctx = await loadAggregationContext(admin, {
    lead_id: input.lead_id,
    pattern_id: input.pattern_id,
    limit: input.limit,
    include_campaign_readiness: true,
  })

  const workspace = buildGrowthLeadWorkspace(ctx)

  if (input.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id) {
      await persistCommandCenterUnificationAudit(admin, {
        event_name: "command_center_workspace_generated",
        workspace,
        organization_id,
      })
    }
  }

  return workspace
}

export async function applyCommandCenterUnificationAction(
  admin: SupabaseClient,
  input: {
    action: CommandCenterUnificationActionType
    workspace: GrowthCommandCenterWorkspace | GrowthCommandCenterLeadWorkspace
    navigation_target?: string | null
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: CommandCenterUnificationAuditEvent =
    input.action === "dismiss"
      ? "command_center_workspace_reviewed"
      : input.action === "mark_reviewed"
        ? "command_center_workspace_reviewed"
        : input.action === "navigate_to_source"
          ? "command_center_workspace_navigation"
          : "command_center_workspace_viewed"

  await persistCommandCenterUnificationAudit(admin, {
    event_name: eventName,
    workspace: input.workspace,
    organization_id,
    operator_id: input.operator_id,
    navigation_target: input.navigation_target,
  })

  return { ok: true }
}
