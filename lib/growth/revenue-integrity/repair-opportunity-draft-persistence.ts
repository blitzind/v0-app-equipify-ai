/** Repair opportunity draft persistence — human-triggered production integrity repair. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recomputeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-intelligence-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveOpportunityFieldsFromDraft } from "@/lib/growth/meeting-intelligence/opportunity-approval-evidence"
import { mapOpportunityDraftDbRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import { updateGrowthMeetingRow } from "@/lib/growth/meeting-intelligence/meeting-repository"
import {
  fetchGrowthOpportunityById,
  insertGrowthOpportunityRow,
  insertGrowthOpportunityStageHistory,
  recomputeGrowthOpportunityDerivedFields,
} from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  computeGrowthOpportunityWeightedAmount,
  resolveGrowthOpportunityStageProbability,
} from "@/lib/growth/opportunity-pipeline/pipeline-probability"
import { fetchGrowthOpportunityPipelineSettings } from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { recomputeGrowthRevenueOperatingDashboard } from "@/lib/growth/revenue-operating/revenue-operating-dashboard-repository"
import { investigateOpportunityDraftPersistence } from "@/lib/growth/revenue-integrity/investigate-opportunity-draft-persistence"
import {
  REVENUE_INTEGRITY_QA_MARKER,
  type RevenuePersistenceRepairAction,
  type RevenuePersistenceRepairReport,
} from "@/lib/growth/revenue-integrity/revenue-integrity-types"

type Step = RevenuePersistenceRepairReport["steps"][number]

async function recomputeDownstream(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string },
): Promise<Step[]> {
  const steps: Step[] = []

  try {
    await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
    steps.push({ step: "recompute_lead_workflow", ok: true, detail: { lead_id: input.leadId } })
  } catch (error) {
    steps.push({
      step: "recompute_lead_workflow",
      ok: false,
      detail: { error: error instanceof Error ? error.message : String(error) },
    })
  }

  try {
    await recomputeDealIntelligenceScore({
      admin,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
    })
    steps.push({ step: "recompute_deal_intelligence", ok: true, detail: { opportunity_id: input.opportunityId } })
  } catch (error) {
    steps.push({
      step: "recompute_deal_intelligence",
      ok: false,
      detail: { error: error instanceof Error ? error.message : String(error) },
    })
  }

  try {
    await recomputeGrowthRevenueOperatingDashboard(admin, { refresh: true })
    steps.push({ step: "recompute_revenue_operating_dashboard", ok: true, detail: {} })
  } catch (error) {
    steps.push({
      step: "recompute_revenue_operating_dashboard",
      ok: false,
      detail: { error: error instanceof Error ? error.message : String(error) },
    })
  }

  try {
    await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
    steps.push({ step: "recompute_opportunity_derived_fields", ok: true, detail: {} })
  } catch (error) {
    steps.push({
      step: "recompute_opportunity_derived_fields",
      ok: false,
      detail: { error: error instanceof Error ? error.message : String(error) },
    })
  }

  return steps
}

async function restoreOpportunityRowFromDraft(
  admin: SupabaseClient,
  input: {
    draftId: string
    preserveOpportunityId: string
    closedWon: boolean
    operatorEmail?: string | null
  },
): Promise<{ ok: boolean; opportunityId: string | null; error?: string }> {
  const { data: draftRow } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("*")
    .eq("id", input.draftId)
    .maybeSingle()

  if (!draftRow) return { ok: false, opportunityId: null, error: "draft_not_found" }

  const draft = mapOpportunityDraftDbRow(draftRow as Record<string, unknown>)
  const lead = await fetchGrowthLeadById(admin, draft.lead_id)
  if (!lead) return { ok: false, opportunityId: null, error: "lead_not_found" }

  const { data: existingByLead } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id")
    .eq("lead_id", draft.lead_id)
    .maybeSingle()
  if (existingByLead) {
    return { ok: false, opportunityId: null, error: "opportunity_already_exists_for_lead" }
  }

  const existingById = await fetchGrowthOpportunityById(admin, input.preserveOpportunityId)
  if (existingById) return { ok: true, opportunityId: existingById.id }

  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const resolved = resolveOpportunityFieldsFromDraft({ draft })
  const stageKey: GrowthOpportunityStageKey = input.closedWon ? "closed_won" : resolved.stageKey
  const probability = resolveGrowthOpportunityStageProbability(stageKey, settings.stageProbabilityOverrides)
  const weightedAmount = computeGrowthOpportunityWeightedAmount(resolved.amount, probability)
  const now = new Date().toISOString()
  const ownerUserId = resolved.ownerUserId ?? lead.assignedTo ?? null

  const opportunity = await insertGrowthOpportunityRow(admin, {
    id: input.preserveOpportunityId,
    lead_id: draft.lead_id,
    owner_user_id: ownerUserId,
    company_name: lead.companyName,
    title: resolved.title,
    stage_key: stageKey,
    amount: resolved.amount,
    probability,
    weighted_amount: weightedAmount,
    forecast_category: input.closedWon ? "commit" : "pipeline",
    expected_close_date: resolved.expectedCloseDate,
    source: "opportunity_draft_repair",
    priority: draft.confidence_score >= 0.75 ? "high" : "medium",
    last_activity_at: now,
    stage_entered_at: now,
    closed_won_at: input.closedWon ? now : null,
    closed_lost_at: null,
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
  })

  await insertGrowthOpportunityStageHistory(admin, {
    opportunityId: opportunity.id,
    fromStageKey: null,
    toStageKey: stageKey,
    amount: resolved.amount,
    probability,
    changedBy: input.operatorEmail ?? "revenue_integrity_repair",
  })

  if (draft.meeting_id) {
    await updateGrowthMeetingRow(admin, draft.meeting_id, {
      opportunity_id: opportunity.id,
    }).catch(() => undefined)
  }

  return { ok: true, opportunityId: opportunity.id }
}

export async function repairOpportunityDraftPersistence(
  admin: SupabaseClient,
  input: {
    draft_id: string
    operator_email?: string | null
    dry_run?: boolean
  },
): Promise<RevenuePersistenceRepairReport> {
  const draftId = input.draft_id.trim()
  const dryRun = input.dry_run === true
  const blockers: string[] = []
  const warnings: string[] = []
  const steps: Step[] = []

  const investigation = await investigateOpportunityDraftPersistence(admin, draftId)
  steps.push({
    step: "investigate",
    ok: investigation.scenario !== "draft_not_found",
    detail: investigation as unknown as Record<string, unknown>,
  })

  if (investigation.scenario === "draft_not_found") {
    blockers.push("draft_not_found")
    return {
      qa_marker: REVENUE_INTEGRITY_QA_MARKER,
      ok: false,
      dry_run: dryRun,
      draft_id: draftId,
      action: "none",
      investigation,
      opportunity_id: null,
      blockers,
      warnings,
      steps,
    }
  }

  let action: RevenuePersistenceRepairAction = "none"
  let opportunityId =
    investigation.opportunity_row_exists && investigation.draft_opportunity_id
      ? investigation.draft_opportunity_id
      : investigation.opportunity_by_lead_id

  if (investigation.scenario === "healthy") {
    action = "recompute_only"
    if (!dryRun && opportunityId && investigation.draft_lead_id) {
      steps.push(...(await recomputeDownstream(admin, { leadId: investigation.draft_lead_id, opportunityId })))
    }
  } else if (investigation.scenario === "orphaned_opportunity_for_lead") {
    action = "link_draft_to_existing_opportunity"
    opportunityId = investigation.opportunity_by_lead_id
    if (!dryRun && opportunityId) {
      const { error } = await admin
        .schema("growth")
        .from("opportunity_drafts")
        .update({
          opportunity_id: opportunityId,
          status: "converted",
          opportunity_created: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
      steps.push({
        step: "link_draft_to_existing_opportunity",
        ok: !error,
        detail: { opportunity_id: opportunityId, error: error?.message ?? null },
      })
      if (error) blockers.push("draft_link_update_failed")
      else if (investigation.draft_lead_id) {
        steps.push(...(await recomputeDownstream(admin, { leadId: investigation.draft_lead_id, opportunityId })))
      }
    }
  } else if (investigation.scenario === "phantom_opportunity_reference") {
    action = "restore_opportunity_row"
    const preserveId = investigation.draft_opportunity_id
    if (!preserveId) {
      blockers.push("missing_draft_opportunity_id")
    } else if (dryRun) {
      steps.push({
        step: "restore_opportunity_row_dry_run",
        ok: true,
        detail: {
          would_restore_opportunity_id: preserveId,
          closed_won: investigation.attribution_opportunity_won,
        },
      })
      opportunityId = preserveId
    } else {
      const restored = await restoreOpportunityRowFromDraft(admin, {
        draftId,
        preserveOpportunityId: preserveId,
        closedWon: investigation.attribution_opportunity_won,
        operatorEmail: input.operator_email,
      })
      steps.push({
        step: "restore_opportunity_row",
        ok: restored.ok,
        detail: { opportunity_id: restored.opportunityId, error: restored.error ?? null },
      })
      if (!restored.ok) {
        blockers.push(restored.error ?? "restore_failed")
      } else {
        opportunityId = restored.opportunityId
        if (investigation.draft_lead_id && opportunityId) {
          steps.push(...(await recomputeDownstream(admin, { leadId: investigation.draft_lead_id, opportunityId })))
        }
      }
    }
  } else {
    blockers.push(`scenario_not_repairable:${investigation.scenario}`)
    warnings.push("Draft must be converted with phantom opportunity reference to auto-repair.")
  }

  const ok = blockers.length === 0 && (dryRun || action !== "none")

  if (ok && !dryRun) {
    await logGrowthEngine("revenue_persistence_repair", {
      draft_id: draftId,
      action,
      opportunity_id: opportunityId,
      scenario: investigation.scenario,
      qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    })
  }

  return {
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    ok,
    dry_run: dryRun,
    draft_id: draftId,
    action,
    investigation,
    opportunity_id: opportunityId,
    blockers,
    warnings,
    steps,
  }
}
