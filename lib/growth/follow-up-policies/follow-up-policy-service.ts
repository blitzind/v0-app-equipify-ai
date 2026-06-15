/** Phase GS-5C — Smart Follow-Up Policy server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { generateSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-engine"
import {
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
  type SmartFollowUpAuditEvent,
  type SmartFollowUpFilter,
  type SmartFollowUpPolicy,
  type SmartFollowUpPoliciesResponse,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { applyOperatorInboxAction, fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import type { OperatorInboxItemSource } from "@/lib/growth/operator-inbox/operator-inbox-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistFollowUpPolicyAudit(
  admin: SupabaseClient,
  input: {
    event_name: SmartFollowUpAuditEvent
    policy: SmartFollowUpPolicy
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
        qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
        event_name: input.event_name,
        follow_up_policy: true,
        policy_id: input.policy.policy_id,
        policy_type: input.policy.policy_type,
        priority: input.policy.priority,
        lead_id: input.policy.lead_id,
        policy: input.policy,
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

function parsePolicySourceRef(policy: SmartFollowUpPolicy): {
  source: OperatorInboxItemSource | null
  source_ref: string | null
} {
  const parts = policy.policy_id.split(":")
  if (parts.length >= 3 && parts[0] === "policy" && parts[1] !== "intervention") {
    const source = parts[1] as OperatorInboxItemSource
    return { source, source_ref: parts.slice(2).join(":") }
  }
  return { source: null, source_ref: null }
}

export async function fetchSmartFollowUpPolicies(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    filter?: SmartFollowUpFilter
    limit?: number
    include_campaign_readiness?: boolean
    include_interventions?: boolean
    persist_audit?: boolean
  },
): Promise<SmartFollowUpPoliciesResponse> {
  const includeInterventions = input?.include_interventions !== false
  const includeReadiness = input?.include_campaign_readiness !== false

  const [inbox, interventions, readiness] = await Promise.all([
    fetchOperatorInboxQueue(admin, {
      lead_id: input?.lead_id,
      limit: input?.limit ?? 50,
    }),
    includeInterventions
      ? fetchHumanInterventions(admin, {
          lead_id: input?.lead_id,
          limit: input?.limit ?? 50,
          include_campaign_readiness: false,
          persist_audit: false,
        }).catch(() => null)
      : Promise.resolve(null),
    includeReadiness && input?.lead_id
      ? loadCampaignReadinessAssessment(admin, { lead_id: input.lead_id }).catch(() => null)
      : Promise.resolve(null),
  ])

  const response = generateSmartFollowUpPolicies({
    inbox_items: inbox.items,
    interventions: interventions?.interventions ?? [],
    campaign_readiness: readiness?.assessment ?? null,
    filter: input?.filter,
    limit: input?.limit,
  })

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id && response.policies[0]) {
      await persistFollowUpPolicyAudit(admin, {
        event_name: "follow_up_policy_generated",
        policy: response.policies[0],
        organization_id,
      })
    }
  }

  return response
}

export async function applySmartFollowUpPolicyAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    policy: SmartFollowUpPolicy
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: SmartFollowUpAuditEvent =
    input.action === "dismiss"
      ? "follow_up_policy_dismissed"
      : input.action === "mark_reviewed"
        ? "follow_up_policy_reviewed"
        : "follow_up_policy_viewed"

  const updated: SmartFollowUpPolicy = {
    ...input.policy,
    review_status:
      input.action === "dismiss"
        ? "dismissed"
        : input.action === "mark_reviewed"
          ? "reviewed"
          : input.policy.review_status,
  }

  await persistFollowUpPolicyAudit(admin, {
    event_name: eventName,
    policy: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  const { source, source_ref } = parsePolicySourceRef(input.policy)
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
