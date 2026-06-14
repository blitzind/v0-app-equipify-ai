/** Investigate opportunity draft persistence integrity — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapOpportunityDraftDbRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import {
  REVENUE_INTEGRITY_QA_MARKER,
  type RevenuePersistenceInvestigation,
  type RevenuePersistenceScenario,
} from "@/lib/growth/revenue-integrity/revenue-integrity-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function classifyScenario(input: {
  draftFound: boolean
  draftStatus: string | null
  draftOpportunityId: string | null
  opportunityRowExists: boolean
  opportunityByLeadId: string | null
}): RevenuePersistenceScenario {
  if (!input.draftFound) return "draft_not_found"
  if (input.draftStatus !== "converted") return "draft_not_converted"
  if (input.opportunityRowExists) return "healthy"
  if (input.opportunityByLeadId) return "orphaned_opportunity_for_lead"
  if (input.draftOpportunityId) return "phantom_opportunity_reference"
  return "draft_not_converted"
}

function rootCauseHypothesis(
  scenario: RevenuePersistenceScenario,
  evidence: Record<string, unknown>,
): string {
  switch (scenario) {
    case "healthy":
      return "Draft and opportunity row are linked; no persistence gap detected."
    case "phantom_opportunity_reference":
      if ((evidence.revenue_event_count as number) > 0 || (evidence.attribution_touch_count as number) > 0) {
        return "Opportunity row was created (attribution/events exist) then removed from growth.opportunities while draft remained converted — orphaned attribution survives because touches/events are not FK-cascade-deleted with opportunities."
      }
      return "Draft marked converted with opportunity_id but no durable row or attribution create evidence — possible manual draft update or failed compensating rollback."
    case "orphaned_opportunity_for_lead":
      return "Lead has an opportunity row but draft.opportunity_id points elsewhere or is stale."
    case "draft_not_converted":
      return "Draft has not completed create-opportunity flow."
    case "draft_not_found":
      return "Draft id not found in growth.opportunity_drafts."
    default:
      return "unknown"
  }
}

export async function investigateOpportunityDraftPersistence(
  admin: SupabaseClient,
  draftId: string,
): Promise<RevenuePersistenceInvestigation> {
  const trimmed = draftId.trim()
  const { data: draftRow } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("*")
    .eq("id", trimmed)
    .maybeSingle()

  const draftFound = Boolean(draftRow)
  const draft = draftRow ? mapOpportunityDraftDbRow(draftRow as Record<string, unknown>) : null
  const draftOpportunityId = draft?.opportunity_id ?? null
  const draftLeadId = draft?.lead_id ?? null
  const draftStatus = draft?.status ?? null

  let opportunityRowExists = false
  if (draftOpportunityId) {
    const { data } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id")
      .eq("id", draftOpportunityId)
      .maybeSingle()
    opportunityRowExists = Boolean(data)
  }

  let opportunityByLeadId: string | null = null
  if (draftLeadId) {
    const { data } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id")
      .eq("lead_id", draftLeadId)
      .maybeSingle()
    opportunityByLeadId = data ? asString((data as { id: string }).id) : null
  }

  const { data: touches } = draftLeadId
    ? await admin
        .schema("growth")
        .from("attribution_touches")
        .select("id,touch_type,opportunity_id")
        .eq("lead_id", draftLeadId)
        .limit(100)
    : { data: [] }
  const touchTypes = (touches ?? []).map((t) => asString((t as { touch_type: string }).touch_type))

  const { data: revenueEvents } = draftLeadId
    ? await admin
        .schema("growth")
        .from("revenue_attribution_events")
        .select("id,event_type,opportunity_id")
        .eq("lead_id", draftLeadId)
        .in("event_type", ["opportunity_created", "opportunity_won"])
        .limit(50)
    : { data: [] }

  const { count: stageHistoryCount } = draftOpportunityId
    ? await admin
        .schema("growth")
        .from("opportunity_stage_history")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", draftOpportunityId)
    : { count: 0 }

  const scenario = classifyScenario({
    draftFound,
    draftStatus,
    draftOpportunityId,
    opportunityRowExists,
    opportunityByLeadId,
  })

  const evidence: Record<string, unknown> = {
    conversion_metadata: draftRow ? (draftRow as Record<string, unknown>).conversion_metadata ?? null : null,
    converted_at: draftRow ? (draftRow as Record<string, unknown>).converted_at ?? null : null,
    converted_email: draftRow ? (draftRow as Record<string, unknown>).converted_email ?? null : null,
    opportunity_created_flag: draftRow ? (draftRow as Record<string, unknown>).opportunity_created ?? null : null,
    attribution_touch_types: touchTypes,
    revenue_events: revenueEvents ?? [],
    revenue_event_count: revenueEvents?.length ?? 0,
    stage_history_count: stageHistoryCount ?? 0,
    write_order_note:
      "confirmCreateOpportunityFromDraft: createGrowthOpportunity → draft update → meeting/timeline/recompute. Draft cannot reach converted without createGrowthOpportunity ok.",
    dashboard_note:
      "Revenue funnel opportunity/closed_won counts derive from attribution_touches, not growth.opportunities — touches can outlive deleted opportunity rows.",
  }

  return {
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    draft_id: trimmed,
    scenario,
    draft_status: draftStatus,
    draft_opportunity_id: draftOpportunityId,
    draft_lead_id: draftLeadId,
    opportunity_row_exists: opportunityRowExists,
    opportunity_by_lead_id: opportunityByLeadId,
    attribution_touch_count: touches?.length ?? 0,
    attribution_opportunity_created: touchTypes.includes("opportunity_created"),
    attribution_opportunity_won: touchTypes.includes("opportunity_won"),
    revenue_event_count: revenueEvents?.length ?? 0,
    stage_history_count: stageHistoryCount ?? 0,
    root_cause_hypothesis: rootCauseHypothesis(scenario, evidence),
    evidence,
  }
}
