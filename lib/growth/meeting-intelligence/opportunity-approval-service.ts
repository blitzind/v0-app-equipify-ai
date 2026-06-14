/** Opportunity Approval Engine — human-confirmed draft to opportunity conversion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import { recomputeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-intelligence-service"
import {
  buildOpportunityApprovalAttributionRecord,
  buildOpportunityApprovalConversionMetadata,
  evaluateOpportunityDraftConversionDuplicateBlock,
  evaluateOpportunityDraftCreateOpportunityGate,
  OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  resolveOpportunityFieldsFromDraft,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-evidence"
import type {
  ConfirmCreateOpportunityFromDraftResult,
  OpportunityApprovalDraftEdits,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import { mapOpportunityDraftDbRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import { updateGrowthMeetingRow } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { createGrowthOpportunity } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import {
  deleteGrowthOpportunityRow,
  fetchGrowthOpportunityByLeadId,
} from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { recomputeGrowthRevenueOperatingDashboard } from "@/lib/growth/revenue-operating/revenue-operating-dashboard-repository"

const TABLE = "opportunity_drafts"

type Actor = { userId?: string | null; email?: string | null }

function failureResult(
  error: string,
  draftId: string | null = null,
): ConfirmCreateOpportunityFromDraftResult {
  return {
    ok: false,
    opportunity_created: false,
    opportunity_id: null,
    draft_id: draftId,
    draft_status: null,
    attribution_chain: [...OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN],
    error,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  }
}

async function refreshDownstreamIntelligence(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string },
): Promise<void> {
  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId).catch(() => undefined)
  await recomputeDealIntelligenceScore({
    admin,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
  }).catch(() => undefined)
  await recomputeGrowthRevenueOperatingDashboard(admin, { refresh: true }).catch(() => undefined)
}

export async function confirmCreateOpportunityFromDraft(
  admin: SupabaseClient,
  input: {
    opportunity_draft_id: string
    operator_id?: string | null
    operator_email?: string | null
    edits?: OpportunityApprovalDraftEdits
  },
): Promise<ConfirmCreateOpportunityFromDraftResult> {
  const draftId = input.opportunity_draft_id.trim()
  if (!draftId) return failureResult("opportunity_draft_id_required")

  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", draftId)
    .maybeSingle()

  if (error) return failureResult(error.message, draftId)
  if (!data) return failureResult("opportunity_draft_not_found", draftId)

  const draft = mapOpportunityDraftDbRow(data as Record<string, unknown>)
  const createGate = evaluateOpportunityDraftCreateOpportunityGate({ draft })
  if (!createGate.allowed) {
    return failureResult(createGate.code ?? "create_opportunity_blocked", draftId)
  }

  const existingOpportunity = await fetchGrowthOpportunityByLeadId(admin, draft.lead_id)
  const duplicate = evaluateOpportunityDraftConversionDuplicateBlock({
    draft,
    lead_has_opportunity: Boolean(existingOpportunity),
  })
  if (duplicate.blocked) {
    return failureResult(duplicate.code ?? "duplicate_conversion_blocked", draftId)
  }

  const resolved = resolveOpportunityFieldsFromDraft({ draft, edits: input.edits })
  const attribution = buildOpportunityApprovalAttributionRecord(
    draft.source_attribution && typeof draft.source_attribution === "object"
      ? (draft.source_attribution as Record<string, unknown>)
      : null,
  )

  const actor: Actor = {
    userId: input.operator_id ?? null,
    email: input.operator_email ?? null,
  }

  const created = await createGrowthOpportunity(admin, {
    leadId: draft.lead_id,
    title: resolved.title,
    amount: resolved.amount,
    stageKey: resolved.stageKey,
    expectedCloseDate: resolved.expectedCloseDate,
    ownerUserId: resolved.ownerUserId,
    source: "opportunity_draft",
    priority: draft.confidence_score >= 0.75 ? "high" : "medium",
    actor,
  })

  if (!created.ok) {
    return failureResult(created.code, draftId)
  }

  const opportunityId = created.opportunity.id
  const now = new Date().toISOString()
  const conversionMetadata = buildOpportunityApprovalConversionMetadata({
    draft_id: draft.draft_id,
    meeting_id: draft.meeting_id,
    opportunity_id: opportunityId,
    operator_id: input.operator_id ?? null,
    operator_email: input.operator_email ?? null,
    attribution,
    next_steps: resolved.nextSteps,
  })

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "converted",
      opportunity_id: opportunityId,
      converted_at: now,
      converted_by: input.operator_id ?? null,
      converted_email: input.operator_email ?? null,
      opportunity_created: true,
      conversion_metadata: conversionMetadata,
      source_attribution: attribution,
      updated_at: now,
      metadata: {
        qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
        human_confirmed: true,
        auto_created: false,
      },
    })
    .eq("id", draftId)

  if (updateError) {
    await deleteGrowthOpportunityRow(admin, opportunityId).catch(() => undefined)
    return failureResult(updateError.message, draftId)
  }

  await updateGrowthMeetingRow(admin, draft.meeting_id, {
    opportunity_id: opportunityId,
  }).catch(() => undefined)

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: draft.lead_id,
    eventType: "opportunity_created_from_draft",
    title: "Opportunity created from draft",
    summary: `Operator confirmed opportunity from approved draft: ${resolved.title}.`,
    actorUserId: actor.userId,
    actorEmail: actor.email,
    payload: {
      opportunity_id: opportunityId,
      opportunity_draft_id: draftId,
      meeting_id: draft.meeting_id,
      source: "opportunity_approval_engine",
      attribution_chain: attribution.attribution_chain,
    },
  }).catch(() => undefined)

  await refreshDownstreamIntelligence(admin, {
    leadId: draft.lead_id,
    opportunityId,
  })

  await logGrowthEngine("opportunity_created_from_draft", {
    draft_id: draftId,
    opportunity_id: opportunityId,
    meeting_id: draft.meeting_id,
    lead_id: draft.lead_id,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  })

  return {
    ok: true,
    opportunity_created: true,
    opportunity_id: opportunityId,
    draft_id: draftId,
    draft_status: "converted",
    attribution_chain: attribution.attribution_chain,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  }
}
