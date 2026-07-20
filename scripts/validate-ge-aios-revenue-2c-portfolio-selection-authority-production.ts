/**
 * GE-AIOS-REVENUE-2C — Portfolio selection authority audit (read-only Production).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2c-portfolio-selection-authority-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { mapDurableStateToPortfolioCapacityClass } from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import { planFairDueCapacityClassAdmission } from "@/lib/growth/draft-factory/draft-factory-due-fair-admission"
import {
  GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { selectPortfolioAwareDueDraftFactoryStates } from "@/lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GE_AIOS_REVENUE_2C_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2c-portfolio-selection-authority-production-v1" as const

const PHASE = "GE-AIOS-REVENUE-2C" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"

async function main(): Promise<void> {
  console.log(`[${PHASE}] Portfolio selection authority audit (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2C_PRODUCTION_VALIDATION_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error("GROWTH_ENGINE_AI_ORG_ID not configured")
    process.exit(1)
  }

  const nowIso = new Date().toISOString()
  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ observed_at: ${nowIso}`)
  console.log(`  ✓ blitz_lead_id: ${BLITZ_LEAD_ID}`)

  const { data: blitzLead } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status, primary_decision_maker_id, updated_at",
    )
    .eq("id", BLITZ_LEAD_ID)
    .maybeSingle()

  const { data: blitzDf } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .maybeSingle()

  console.log("\n=== Phase 1 — Portfolio Selection Trace (current snapshot) ===")
  console.log("Blitz DF durable row:")
  console.log(JSON.stringify(blitzDf, null, 2))

  const portfolioEligibility = blitzLead
    ? evaluateGrowthPortfolioLeadEligibility({ lead: blitzLead as never, organizationId })
    : null
  console.log("Portfolio eligibility:", JSON.stringify(portfolioEligibility, null, 2))

  const capacityClass = blitzDf
    ? mapDurableStateToPortfolioCapacityClass(String((blitzDf as { state: string }).state), {
        earliestIncompleteStage: (blitzDf as { earliest_incomplete_stage?: string }).earliest_incomplete_stage,
      })
    : null
  console.log(`Capacity class assignment: ${capacityClass}`)

  const { data: duePoolRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, updated_at, paused_reason, next_eligible_wake_at")
    .eq("organization_id", organizationId)
    .not("state", "in", '("waiting_for_approval","approved","executed","failed")')
    .or(`next_eligible_wake_at.is.null,next_eligible_wake_at.lte.${nowIso}`)
    .order("updated_at", { ascending: true })
    .limit(500)

  const dueStates = (duePoolRows ?? []).map((row) => ({
    leadId: String((row as { lead_id: string }).lead_id),
    state: String((row as { state: string }).state),
    updatedAt: String((row as { updated_at: string }).updated_at),
    earliestIncompleteStage: (row as { earliest_incomplete_stage?: string }).earliest_incomplete_stage ?? null,
  }))

  const admission = planFairDueCapacityClassAdmission({
    dueStates,
    totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
    perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  })

  console.log("\nDue pool admission plan (simulated from Production due pool):")
  console.log(JSON.stringify(admission, null, 2))

  const blitzSampled = admission.sampledCandidates.some((c) => c.leadId === BLITZ_LEAD_ID)
  console.log(`Blitz in sampledCandidates for enrichment: ${blitzSampled}`)

  const dueLeadIds = dueStates.map((r) => r.leadId)
  const { data: dueLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status")
    .in("id", dueLeadIds.length > 0 ? dueLeadIds : [BLITZ_LEAD_ID])

  const leadById = new Map((dueLeads ?? []).map((l) => [String((l as { id: string }).id), l]))

  type Enriched = {
    leadId: string
    state: string
    updatedAt: string
    earliestIncompleteStage: string | null
    investmentState: string
    spendAuthorized: boolean
    companyName: string
    researchFresh: boolean | null
    researchStale: boolean | null
    portfolioEligible: boolean
    portfolioReason: string | null
  }

  const enriched: Enriched[] = []
  for (const candidate of admission.sampledCandidates) {
    const lead = leadById.get(candidate.leadId)
    if (!lead) continue
    const pe = evaluateGrowthPortfolioLeadEligibility({ lead: lead as never, organizationId })
    if (!pe.eligible) continue

    const hasResearch = Boolean(
      (lead as { latest_prospect_research_run_id?: string }).latest_prospect_research_run_id &&
        (lead as { last_prospect_researched_at?: string }).last_prospect_researched_at,
    )
    const researchStale = (lead as { last_prospect_researched_at?: string }).last_prospect_researched_at
      ? isProspectResearchStale(String((lead as { last_prospect_researched_at: string }).last_prospect_researched_at))
      : true
    const signals = buildResourceAllocationSignalsFromLead(lead as never, {
      budgetAvailable: true,
      killSwitchActive: false,
    })
    const resource = evaluateResourceAllocationFacade({
      organizationId,
      accountId: candidate.leadId,
      resourceClass: "website_research",
      signals,
    })

    enriched.push({
      leadId: candidate.leadId,
      state: candidate.state,
      updatedAt: candidate.updatedAt,
      earliestIncompleteStage: candidate.capacityClass === "cheap_validation" ? "portfolio" : null,
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      companyName: String((lead as { company_name?: string }).company_name ?? ""),
      researchFresh: hasResearch && !researchStale,
      researchStale,
      portfolioEligible: pe.eligible,
      portfolioReason: pe.reasonCode,
    })
  }

  const selection = selectPortfolioAwareDueDraftFactoryStates({
    organizationId,
    dueStates: enriched.map((row) => {
      const dueRow = dueStates.find((d) => d.leadId === row.leadId)
      return {
        leadId: row.leadId,
        state: row.state,
        updatedAt: row.updatedAt,
        earliestIncompleteStage: dueRow?.earliestIncompleteStage ?? null,
        investmentState: row.investmentState as never,
        spendAuthorized: row.spendAuthorized,
        companyName: row.companyName,
        researchFresh: row.researchFresh,
        researchStale: row.researchStale,
      }
    }),
    totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
    perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
    decidedAt: nowIso,
  })

  console.log("\nPortfolio selection result (simulated on enriched sample):")
  console.log(JSON.stringify(selection, null, 2))
  console.log(`Blitz selected in simulation: ${selection.selectedLeadIds.includes(BLITZ_LEAD_ID)}`)

  console.log("\n=== Phase 2 — Capacity Analysis (cheap_validation) ===")
  const cheapClass = selection.classSelections.find((c) => c.capacityClass === "cheap_validation")
  console.log(JSON.stringify(cheapClass ?? { note: "no cheap_validation class in selection" }, null, 2))

  console.log("\n=== Phase 5 — Competing Leads in cheap_validation due pool ===")
  const cheapDue = dueStates.filter(
    (row) =>
      mapDurableStateToPortfolioCapacityClass(row.state, {
        earliestIncompleteStage: row.earliestIncompleteStage,
      }) === "cheap_validation",
  )
  for (const row of cheapDue) {
    const lead = leadById.get(row.leadId)
    const admissionState = lead
      ? resolveLeadAdmissionStateFromMetadata((lead as { metadata?: Record<string, unknown> }).metadata)
      : null
    const selected = selection.selectedLeadIds.includes(row.leadId)
    console.log(
      JSON.stringify({
        leadId: row.leadId,
        company: (lead as { company_name?: string } | undefined)?.company_name ?? null,
        admissionState,
        state: row.state,
        updatedAt: row.updatedAt,
        inSampledCandidates: admission.sampledCandidates.some((c) => c.leadId === row.leadId),
        inEnriched: enriched.some((e) => e.leadId === row.leadId),
        selected,
      }),
    )
  }

  console.log("\n=== Phase 3/4 — Scheduler History (wake receipts) ===")
  const { data: receipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_type, outcome, wake_fingerprint, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .gte("created_at", "2026-07-19T00:00:00.000Z")
    .order("created_at", { ascending: true })

  for (const receipt of receipts ?? []) {
    console.log(JSON.stringify(receipt, null, 2))
  }

  console.log("\n=== Phase 8 — Generation capacity pool (deferred states) ===")
  const { data: deferredRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, paused_reason, updated_at")
    .eq("organization_id", organizationId)
    .or("state.eq.paused,paused_reason.eq.portfolio_deferred,earliest_incomplete_stage.eq.portfolio")

  console.log(`Deferred/portfolio rows: ${(deferredRows ?? []).length}`)
  console.log(JSON.stringify(deferredRows ?? [], null, 2))

  console.log("\n=== Phase 9 — Validator table check ===")
  const { error: wrongTableError } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_jobs")
    .select("id", { count: "exact", head: true })
    .limit(1)
  const { count: correctBcJobs } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  console.log(
    JSON.stringify({
      buying_committee_intelligence_jobs_table_exists: !wrongTableError,
      buying_committee_intelligence_jobs_error: wrongTableError?.message ?? null,
      buying_committee_jobs_7d: correctBcJobs ?? 0,
      revenue_2a_still_uses_wrong_table: true,
    }),
  )

  console.log("\n=== Audit complete (read-only) ===")
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
