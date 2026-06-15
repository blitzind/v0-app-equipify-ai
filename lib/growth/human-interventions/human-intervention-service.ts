/** Phase GS-3E — Human Intervention server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { generateHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-engine"
import {
  HUMAN_INTERVENTION_QA_MARKER,
  type HumanIntervention,
  type HumanInterventionAuditEvent,
  type HumanInterventionFilter,
  type HumanInterventionsResponse,
} from "@/lib/growth/human-interventions/human-intervention-types"
import { applyOperatorInboxAction } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import type { OperatorInboxItemSource } from "@/lib/growth/operator-inbox/operator-inbox-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistHumanInterventionAudit(
  admin: SupabaseClient,
  input: {
    event_name: HumanInterventionAuditEvent
    intervention: HumanIntervention
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
        qa_marker: HUMAN_INTERVENTION_QA_MARKER,
        event_name: input.event_name,
        human_intervention: true,
        intervention_id: input.intervention.intervention_id,
        intervention_type: input.intervention.intervention_type,
        priority: input.intervention.priority,
        lead_id: input.intervention.lead_id,
        intervention: input.intervention,
        operator_id: input.operator_id ?? null,
        occurred_at: now,
        requires_human_review: true,
        requires_human_approval: true,
        enrollment_enabled: false,
        outreach_enabled: false,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

function parseInterventionSourceRef(intervention: HumanIntervention): {
  source: OperatorInboxItemSource | null
  source_ref: string | null
} {
  const parts = intervention.intervention_id.split(":")
  if (parts.length >= 3 && parts[0] === "intervention") {
    const source = parts[1] as OperatorInboxItemSource
    return { source, source_ref: parts.slice(2).join(":") }
  }
  return { source: null, source_ref: null }
}

export async function fetchHumanInterventions(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    filter?: HumanInterventionFilter
    limit?: number
    include_campaign_readiness?: boolean
    persist_audit?: boolean
  },
): Promise<HumanInterventionsResponse> {
  const [inbox, readiness] = await Promise.all([
    fetchOperatorInboxQueue(admin, {
      lead_id: input?.lead_id,
      limit: input?.limit ?? 50,
    }),
    input?.include_campaign_readiness !== false && input?.lead_id
      ? loadCampaignReadinessAssessment(admin, { lead_id: input.lead_id }).catch(() => null)
      : Promise.resolve(null),
  ])

  const response = generateHumanInterventions({
    inbox_items: inbox.items,
    campaign_readiness: readiness?.assessment ?? null,
    filter: input?.filter,
    limit: input?.limit,
  })

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id) {
      await persistHumanInterventionAudit(admin, {
        event_name: "human_intervention_generated",
        intervention: response.interventions[0] ?? {
          qa_marker: HUMAN_INTERVENTION_QA_MARKER,
          intervention_id: "batch-empty",
          intervention_type: "manual_review",
          priority: "low",
          title: "No interventions",
          description: "No human interventions matched filters.",
          trigger: {
            trigger_id: "empty",
            trigger_type: "none",
            reason: "empty queue",
            evidence: [],
            source_system: "human_intervention_engine",
            source_ref: "empty",
          },
          recommendations: [],
          supporting_context: [],
          related_entities: [],
          available_actions: [],
          resolution: { resolution_status: "pending", resolved_at: null, resolved_by: null },
          lead_id: input.lead_id ?? null,
          company_name: null,
          occurred_at: new Date().toISOString(),
          related_href: null,
          requires_human_review: true,
          autonomous_execution_enabled: false,
        },
        organization_id,
      })
    }
  }

  return response
}

export async function applyHumanInterventionAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    intervention: HumanIntervention
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: HumanInterventionAuditEvent =
    input.action === "dismiss"
      ? "human_intervention_dismissed"
      : input.action === "mark_reviewed"
        ? "human_intervention_reviewed"
        : "human_intervention_generated"

  const updated: HumanIntervention = {
    ...input.intervention,
    resolution: {
      resolution_status:
        input.action === "dismiss"
          ? "dismissed"
          : input.action === "mark_reviewed"
            ? "reviewed"
            : input.intervention.resolution.resolution_status,
      resolved_at: new Date().toISOString(),
      resolved_by: input.operator_id ?? null,
    },
  }

  if (input.action === "mark_reviewed" && eventName === "human_intervention_reviewed") {
    await persistHumanInterventionAudit(admin, {
      event_name: "human_intervention_resolved",
      intervention: { ...updated, resolution: { ...updated.resolution, resolution_status: "resolved" } },
      organization_id,
      operator_id: input.operator_id,
    })
  }

  await persistHumanInterventionAudit(admin, {
    event_name: eventName,
    intervention: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  const { source, source_ref } = parseInterventionSourceRef(input.intervention)
  if (source && source_ref && (input.action === "mark_reviewed" || input.action === "dismiss")) {
    const inboxAction = input.action === "dismiss" ? "dismiss" : "mark_reviewed"
    await applyOperatorInboxAction(admin, {
      action: inboxAction,
      item_id: `${source}:${source_ref}`,
      source,
      source_ref,
    }).catch(() => ({ ok: true }))
  }

  return { ok: true }
}
