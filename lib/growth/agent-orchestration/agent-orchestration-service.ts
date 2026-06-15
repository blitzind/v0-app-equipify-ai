/** Phase GS-4D — Agent Orchestration server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { generateGrowthAgentPlan } from "@/lib/growth/agent-orchestration/agent-orchestration-engine"
import {
  AGENT_ORCHESTRATION_QA_MARKER,
  type AgentOrchestrationAuditEvent,
  type AgentOrchestrationFilter,
  type GrowthAgentOrchestrationResponse,
  type GrowthAgentPlan,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { fetchCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-service"
import { fetchSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-service"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { fetchGrowthRealtimeEvents } from "@/lib/growth/realtime-events/realtime-events-service"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { fetchSequencePreviewStudio } from "@/lib/growth/sequence-preview/sequence-preview-service"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistAgentOrchestrationAudit(
  admin: SupabaseClient,
  input: {
    event_name: AgentOrchestrationAuditEvent
    plan: GrowthAgentPlan
    organization_id: string
    operator_id?: string | null
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
        qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
        event_name: input.event_name,
        agent_orchestration: true,
        plan_id: input.plan.plan_id,
        plan_status: input.plan.plan_status,
        lead_id: input.plan.lead_id,
        plan: input.plan,
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

export async function fetchGrowthAgentOrchestration(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    pattern_id?: string | null
    filter?: AgentOrchestrationFilter
    limit?: number
    include_campaign_readiness?: boolean
    persist_audit?: boolean
  },
): Promise<GrowthAgentOrchestrationResponse> {
  const includeReadiness = input?.include_campaign_readiness !== false

  const [
    patterns,
    readiness,
    previews,
    policies,
    interventions,
    inbox,
    events,
    wizards,
    lead,
  ] = await Promise.all([
    listGrowthSequencePatterns(admin),
    includeReadiness && input?.lead_id
      ? loadCampaignReadinessAssessment(admin, { lead_id: input.lead_id }).catch(() => null)
      : Promise.resolve(null),
    fetchSequencePreviewStudio(admin, {
      pattern_id: input?.pattern_id,
      lead_id: input?.lead_id,
      limit: input?.limit ?? 10,
      include_campaign_readiness: false,
      persist_audit: false,
    }).catch(() => null),
    input?.lead_id
      ? fetchSmartFollowUpPolicies(admin, {
          lead_id: input.lead_id,
          limit: 15,
          include_campaign_readiness: false,
          persist_audit: false,
        }).catch(() => null)
      : Promise.resolve(null),
    input?.lead_id
      ? fetchHumanInterventions(admin, {
          lead_id: input.lead_id,
          limit: 15,
          include_campaign_readiness: false,
          persist_audit: false,
        }).catch(() => null)
      : Promise.resolve(null),
    fetchOperatorInboxQueue(admin, {
      lead_id: input?.lead_id,
      limit: input?.limit ?? 20,
    }).catch(() => null),
    fetchGrowthRealtimeEvents(admin, { limit: 15 }).catch(() => null),
    fetchCampaignBuilderWizard(admin, {
      lead_id: input?.lead_id,
      pattern_id: input?.pattern_id,
      limit: input?.limit ?? 5,
      include_campaign_readiness: false,
      persist_audit: false,
    }).catch(() => null),
    input?.lead_id ? fetchGrowthLeadById(admin, input.lead_id).catch(() => null) : Promise.resolve(null),
  ])

  const response = generateGrowthAgentPlan({
    lead_id: input?.lead_id ?? null,
    company_name: lead?.companyName ?? null,
    campaign_readiness: readiness?.assessment ?? null,
    sequence_previews: previews?.previews ?? [],
    follow_up_policies: policies?.policies ?? [],
    interventions: interventions?.interventions ?? [],
    campaign_wizards: wizards?.wizards ?? [],
    inbox_items: inbox?.items ?? [],
    realtime_events: events?.events ?? [],
    sequence_pattern_count: patterns.length,
    filter: input?.filter,
    limit: input?.limit,
  })

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id && response.plans[0]) {
      await persistAgentOrchestrationAudit(admin, {
        event_name: "agent_plan_generated",
        plan: response.plans[0],
        organization_id,
      })
    }
  }

  return response
}

export async function applyAgentOrchestrationAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    plan: GrowthAgentPlan
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: AgentOrchestrationAuditEvent =
    input.action === "dismiss"
      ? "agent_plan_dismissed"
      : input.action === "mark_reviewed"
        ? "agent_plan_reviewed"
        : "agent_plan_viewed"

  const updated: GrowthAgentPlan = {
    ...input.plan,
    review_status:
      input.action === "dismiss"
        ? "dismissed"
        : input.action === "mark_reviewed"
          ? "reviewed"
          : input.plan.review_status,
  }

  await persistAgentOrchestrationAudit(admin, {
    event_name: eventName,
    plan: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  return { ok: true }
}
