/** Phase GS-5D — Campaign Builder server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { generateCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-engine"
import {
  CAMPAIGN_BUILDER_QA_MARKER,
  type CampaignBuilderAuditEvent,
  type CampaignBuilderFilter,
  type CampaignBuilderWizard,
  type CampaignBuilderWizardResponse,
} from "@/lib/growth/campaign-builder/campaign-builder-types"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { fetchSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-service"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { fetchSequencePreviewStudio } from "@/lib/growth/sequence-preview/sequence-preview-service"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistCampaignBuilderAudit(
  admin: SupabaseClient,
  input: {
    event_name: CampaignBuilderAuditEvent
    wizard: CampaignBuilderWizard
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
        qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
        event_name: input.event_name,
        campaign_builder: true,
        wizard_id: input.wizard.wizard_id,
        wizard_status: input.wizard.wizard_status,
        configuration_score: input.wizard.configuration_score,
        lead_id: input.wizard.lead_id,
        wizard: input.wizard,
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

export async function fetchCampaignBuilderWizard(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    pattern_id?: string | null
    filter?: CampaignBuilderFilter
    limit?: number
    include_campaign_readiness?: boolean
    persist_audit?: boolean
  },
): Promise<CampaignBuilderWizardResponse> {
  const includeReadiness = input?.include_campaign_readiness !== false

  const [patterns, readiness, previews, policies, interventions, lead] = await Promise.all([
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
    input?.lead_id ? fetchGrowthLeadById(admin, input.lead_id).catch(() => null) : Promise.resolve(null),
  ])

  const response = generateCampaignBuilderWizard({
    lead_id: input?.lead_id ?? null,
    company_name: lead?.companyName ?? null,
    pattern_id: input?.pattern_id,
    campaign_readiness: readiness?.assessment ?? null,
    sequence_previews: previews?.previews ?? [],
    follow_up_policies: policies?.policies ?? [],
    interventions: interventions?.interventions ?? [],
    patterns,
    filter: input?.filter,
    limit: input?.limit,
  })

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id && response.wizards[0]) {
      await persistCampaignBuilderAudit(admin, {
        event_name: "campaign_builder_generated",
        wizard: response.wizards[0],
        organization_id,
      })
    }
  }

  return response
}

export async function applyCampaignBuilderAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    wizard: CampaignBuilderWizard
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: CampaignBuilderAuditEvent =
    input.action === "dismiss"
      ? "campaign_builder_dismissed"
      : input.action === "mark_reviewed"
        ? "campaign_builder_reviewed"
        : "campaign_builder_viewed"

  const updated: CampaignBuilderWizard = {
    ...input.wizard,
    review_status:
      input.action === "dismiss"
        ? "dismissed"
        : input.action === "mark_reviewed"
          ? "reviewed"
          : input.wizard.review_status,
  }

  await persistCampaignBuilderAudit(admin, {
    event_name: eventName,
    wizard: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  return { ok: true }
}
