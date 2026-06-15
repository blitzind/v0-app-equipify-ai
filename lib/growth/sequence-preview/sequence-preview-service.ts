/** Phase GS-5B — Sequence Preview server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import {
  SEQUENCE_PREVIEW_QA_MARKER,
  type SequencePreview,
  type SequencePreviewAuditEvent,
  type SequencePreviewFilter,
  type SequencePreviewStudioResponse,
} from "@/lib/growth/sequence-preview/sequence-preview-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistSequencePreviewAudit(
  admin: SupabaseClient,
  input: {
    event_name: SequencePreviewAuditEvent
    preview: SequencePreview
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
        qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
        event_name: input.event_name,
        sequence_preview: true,
        preview_id: input.preview.preview_id,
        pattern_id: input.preview.pattern_id,
        sequence_status: input.preview.sequence_status,
        lead_id: input.preview.lead_id,
        preview: input.preview,
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

export async function fetchSequencePreviewStudio(
  admin: SupabaseClient,
  input?: {
    pattern_id?: string | null
    lead_id?: string | null
    filter?: SequencePreviewFilter
    limit?: number
    include_campaign_readiness?: boolean
    persist_audit?: boolean
  },
): Promise<SequencePreviewStudioResponse> {
  const includeReadiness = input?.include_campaign_readiness !== false

  const [patterns, readiness, interventions, lead] = await Promise.all([
    listGrowthSequencePatterns(admin),
    includeReadiness && input?.lead_id
      ? loadCampaignReadinessAssessment(admin, { lead_id: input.lead_id }).catch(() => null)
      : Promise.resolve(null),
    input?.lead_id
      ? fetchHumanInterventions(admin, {
          lead_id: input.lead_id,
          limit: 20,
          include_campaign_readiness: false,
          persist_audit: false,
        }).catch(() => null)
      : Promise.resolve(null),
    input?.lead_id ? fetchGrowthLeadById(admin, input.lead_id).catch(() => null) : Promise.resolve(null),
  ])

  const filteredPatterns = input?.pattern_id
    ? patterns.filter((p) => p.id === input.pattern_id)
    : patterns

  const response = generateSequencePreview({
    patterns: filteredPatterns,
    campaign_readiness: readiness?.assessment ?? null,
    interventions: interventions?.interventions ?? [],
    lead_id: input?.lead_id ?? null,
    company_name: lead?.companyName ?? null,
    filter: input?.filter,
    limit: input?.limit,
  })

  if (input?.persist_audit) {
    const organization_id = getGrowthEngineAiOrgId()
    if (organization_id && response.previews[0]) {
      await persistSequencePreviewAudit(admin, {
        event_name: "sequence_preview_generated",
        preview: response.previews[0],
        organization_id,
      })
    }
  }

  return response
}

export async function applySequencePreviewAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    preview: SequencePreview
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_required" }
  }

  const eventName: SequencePreviewAuditEvent =
    input.action === "dismiss"
      ? "sequence_preview_dismissed"
      : input.action === "mark_reviewed"
        ? "sequence_preview_reviewed"
        : "sequence_preview_viewed"

  const updated: SequencePreview = {
    ...input.preview,
    review_status:
      input.action === "dismiss"
        ? "dismissed"
        : input.action === "mark_reviewed"
          ? "reviewed"
          : input.preview.review_status,
  }

  await persistSequencePreviewAudit(admin, {
    event_name: eventName,
    preview: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  return { ok: true }
}
