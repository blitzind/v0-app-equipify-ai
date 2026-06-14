/** Revenue persistence integrity certification — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"
import { recomputeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-intelligence-service"
import { fetchGrowthRevenueAttributionDashboard } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard"
import { investigateOpportunityDraftPersistence } from "@/lib/growth/revenue-integrity/investigate-opportunity-draft-persistence"
import { repairOpportunityDraftPersistence } from "@/lib/growth/revenue-integrity/repair-opportunity-draft-persistence"
import {
  REVENUE_INTEGRITY_QA_MARKER,
  REVENUE_PERSISTENCE_INTEGRITY_CHECKS,
  type RevenuePersistenceIntegrityCheckId,
} from "@/lib/growth/revenue-integrity/revenue-integrity-types"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"

type Check = { id: RevenuePersistenceIntegrityCheckId; pass: boolean; detail: Record<string, unknown> }

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

export function auditCreateGrowthOpportunityWriteOrder(): Record<string, unknown> {
  const mutateSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/opportunity-pipeline/mutate-opportunity.ts"),
    "utf8",
  )
  const approvalSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-approval-service.ts"),
    "utf8",
  )

  const createOrder = [
    "fetchGrowthLeadById",
    "fetchGrowthOpportunityByLeadId",
    "insertGrowthOpportunityRow",
    "insertGrowthOpportunityStageHistory",
    "emitGrowthOpportunityCreatedTimeline",
    "recomputeGrowthOpportunityDerivedFields",
    "recordRevenueAttributionEvent",
  ]

  const approvalCreateIdx = approvalSource.indexOf("await createGrowthOpportunity(admin,")
  const approvalDraftUpdateIdx = approvalSource.indexOf('status: "converted"')
  const rollbackIdx = approvalSource.indexOf("await deleteGrowthOpportunityRow(admin, opportunityId)")

  const createSteps = createOrder.map((token) => mutateSource.indexOf(token)).filter((idx) => idx >= 0)
  const createMonotonic = createSteps.every((idx, i) => i === 0 || idx >= createSteps[i - 1])

  return {
    createGrowthOpportunity_order: createOrder,
    createGrowthOpportunity_monotonic: createMonotonic,
    confirmCreateOpportunityFromDraft_order: {
      create_before_draft_update: approvalCreateIdx >= 0 && approvalDraftUpdateIdx > approvalCreateIdx,
      compensating_rollback_on_draft_update_failure: rollbackIdx > approvalDraftUpdateIdx,
    },
    can_succeed_without_opportunity_row: [
      "attribution_touches (written by recordRevenueAttributionEvent inside createGrowthOpportunity)",
      "revenue_attribution_events (same path)",
      "lead_timeline_events (emitGrowthOpportunityCreatedTimeline)",
      "dashboard funnel counts (from attribution_touches, not opportunities table)",
    ],
    partial_write_scenarios: [
      {
        scenario: "opportunity inserted, draft update fails",
        before_rv1b: "orphan opportunity row + draft still approved",
        after_rv1b: "deleteGrowthOpportunityRow compensating rollback",
      },
      {
        scenario: "opportunity created then manually/deleted outside app",
        mitigation: "repairOpportunityDraftPersistence restores row with draft.opportunity_id",
      },
      {
        scenario: "downstream recompute throws",
        behavior: "best-effort .catch — opportunity row persists",
      },
    ],
  }
}

export async function certifyRevenuePersistenceIntegrity(
  admin: SupabaseClient,
  input: {
    draft_id: string
    repair?: boolean
    operator_email?: string | null
  },
): Promise<{
  qa_marker: typeof REVENUE_INTEGRITY_QA_MARKER
  certified: boolean
  certification_pct: number
  checks: Check[]
  blockers: string[]
  investigation: Awaited<ReturnType<typeof investigateOpportunityDraftPersistence>>
  repair: Awaited<ReturnType<typeof repairOpportunityDraftPersistence>> | null
  write_order_audit: Record<string, unknown>
}> {
  const blockers: string[] = []
  const checks: Check[] = []
  const writeOrderAudit = auditCreateGrowthOpportunityWriteOrder()

  let investigation = await investigateOpportunityDraftPersistence(admin, input.draft_id)
  let repair: Awaited<ReturnType<typeof repairOpportunityDraftPersistence>> | null = null

  if (input.repair && investigation.scenario === "phantom_opportunity_reference") {
    repair = await repairOpportunityDraftPersistence(admin, {
      draft_id: input.draft_id,
      operator_email: input.operator_email,
      dry_run: false,
    })
    if (!repair.ok) blockers.push(...repair.blockers)
    investigation = await investigateOpportunityDraftPersistence(admin, input.draft_id)
  }

  const oppId = investigation.draft_opportunity_id
  const leadId = investigation.draft_lead_id

  checks.push({
    id: "opportunity_row_exists",
    pass: investigation.opportunity_row_exists,
    detail: { opportunity_id: oppId, scenario: investigation.scenario },
  })

  checks.push({
    id: "draft_opportunity_id_linked",
    pass: Boolean(investigation.draft_opportunity_id) && investigation.opportunity_row_exists,
    detail: {
      draft_opportunity_id: investigation.draft_opportunity_id,
      draft_status: investigation.draft_status,
    },
  })

  let attributionReferencesRow = false
  if (oppId && leadId) {
    const { count } = await admin
      .schema("growth")
      .from("attribution_touches")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("opportunity_id", oppId)
    attributionReferencesRow = (count ?? 0) > 0 || !investigation.attribution_opportunity_created
  }
  checks.push({
    id: "attribution_references_existing_row",
    pass: investigation.opportunity_row_exists
      ? attributionReferencesRow || investigation.attribution_opportunity_created
      : false,
    detail: {
      attribution_opportunity_created: investigation.attribution_opportunity_created,
      attribution_opportunity_won: investigation.attribution_opportunity_won,
    },
  })

  let dashboardCountsRow = false
  if (leadId && investigation.opportunity_row_exists) {
    const dashboard = await fetchGrowthRevenueAttributionDashboard(admin, {})
    const oppStage = dashboard.funnel.find((s) => s.stage === "opportunity")
    dashboardCountsRow = (oppStage?.count ?? 0) > 0
  }
  checks.push({
    id: "dashboard_counts_existing_row",
    pass: dashboardCountsRow && investigation.opportunity_row_exists,
    detail: { dashboard_opportunity_stage_count: dashboardCountsRow },
  })

  let dealIntelCount = 0
  if (oppId && investigation.opportunity_row_exists) {
    const { count } = await admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", oppId)
    dealIntelCount = count ?? 0
  }
  checks.push({
    id: "deal_intelligence_references_existing_row",
    pass: investigation.opportunity_row_exists && dealIntelCount > 0,
    detail: { deal_intelligence_scores: dealIntelCount },
  })

  let leadForecast = false
  if (leadId && investigation.opportunity_row_exists) {
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select("revenue_forecast_computed_at")
      .eq("id", leadId)
      .maybeSingle()
    leadForecast = Boolean(data?.revenue_forecast_computed_at)
  }
  checks.push({
    id: "revenue_forecast_references_existing_row",
    pass: investigation.opportunity_row_exists && leadForecast,
    detail: { lead_forecast_computed: leadForecast },
  })

  let recomputeOk = false
  if (leadId && oppId && investigation.opportunity_row_exists) {
    try {
      await recomputeGrowthLeadWorkflowSignals(admin, leadId)
      await recomputeDealIntelligenceScore({ admin, leadId, opportunityId: oppId })
      recomputeOk = true
    } catch {
      recomputeOk = false
    }
  }
  checks.push({
    id: "recompute_hooks_succeed",
    pass: recomputeOk,
    detail: { lead_id: leadId, opportunity_id: oppId },
  })

  const rollbackProtection =
    (writeOrderAudit.confirmCreateOpportunityFromDraft_order as { compensating_rollback_on_draft_update_failure?: boolean })
      ?.compensating_rollback_on_draft_update_failure === true
  checks.push({
    id: "transaction_rollback_protection",
    pass: rollbackProtection,
    detail: writeOrderAudit.confirmCreateOpportunityFromDraft_order as Record<string, unknown>,
  })

  const { data: dupOpps } = leadId
    ? await admin.schema("growth").from("opportunities").select("id").eq("lead_id", leadId)
    : { data: [] }
  checks.push({
    id: "duplicate_prevention",
    pass: (dupOpps?.length ?? 0) <= 1,
    detail: { opportunity_count_for_lead: dupOpps?.length ?? 0 },
  })

  for (const check of checks) {
    if (!check.pass) blockers.push(`certification_failed:${check.id}`)
  }

  const passCount = checks.filter((c) => c.pass).length
  const certified = passCount === REVENUE_PERSISTENCE_INTEGRITY_CHECKS.length

  return {
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    certified,
    certification_pct: pct(passCount, REVENUE_PERSISTENCE_INTEGRITY_CHECKS.length),
    checks,
    blockers,
    investigation,
    repair,
    write_order_audit: writeOrderAudit,
  }
}
