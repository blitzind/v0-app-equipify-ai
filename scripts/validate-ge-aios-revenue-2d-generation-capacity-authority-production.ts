/**
 * GE-AIOS-REVENUE-2D — Generation capacity authority audit (read-only Production).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2d-generation-capacity-authority-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import {
  mapPortfolioCapacityClassToResourceClass,
  mapDurableStateToPortfolioCapacityClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import { collectGenerationCapacityCandidates } from "@/lib/growth/draft-factory/draft-factory-generation-capacity"
import {
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { evaluatePortfolioAllocationFacade } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { planWakeEvaluationBatch } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"

export const GE_AIOS_REVENUE_2D_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2d-generation-capacity-authority-production-v1" as const

const PHASE = "GE-AIOS-REVENUE-2D" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

async function main(): Promise<void> {
  console.log(`[${PHASE}] Generation capacity authority audit (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2D_PRODUCTION_VALIDATION_QA_MARKER}`)

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
  console.log(`  ✓ block_lead_id: ${BLOCK_LEAD_ID}`)

  const { data: blitzDf } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .maybeSingle()

  const { data: blockDf } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLOCK_LEAD_ID)
    .maybeSingle()

  console.log("\n=== Phase 1 — Generation Authority Trace (Blitz snapshot) ===")
  console.log("Blitz DF durable row:")
  console.log(JSON.stringify(blitzDf, null, 2))

  const { data: blitzLead } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status, primary_decision_maker_id, updated_at",
    )
    .eq("id", BLITZ_LEAD_ID)
    .maybeSingle()

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

  const { data: deferredRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, paused_reason, updated_at")
    .eq("organization_id", organizationId)
    .or("state.eq.paused,paused_reason.eq.portfolio_deferred,earliest_incomplete_stage.eq.portfolio")

  const deferredStates = (deferredRows ?? []).map((row) => ({
    leadId: String((row as { lead_id: string }).lead_id),
    state: String((row as { state: string }).state),
    updatedAt: String((row as { updated_at: string }).updated_at),
  }))

  const generationPool = collectGenerationCapacityCandidates({
    deferredStates,
    dueStates,
    limit: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  })

  const capacityBatch = planWakeEvaluationBatch({
    totalWaits: generationPool.candidates.length,
    perRunCap: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  })

  console.log("\nGeneration candidate collection (simulated from Production):")
  console.log(
    JSON.stringify(
      {
        qa_marker: generationPool.qa_marker,
        deferred_count: generationPool.deferredCount,
        waiting_for_generation_count: generationPool.waitingForGenerationCount,
        capacity_candidate_count: generationPool.candidates.length,
        capacity_slots_per_org: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
        capacity_batch: capacityBatch,
        candidates: generationPool.candidates,
      },
      null,
      2,
    ),
  )

  const poolLeadIds = generationPool.candidates.map((c) => c.leadId)
  const { data: poolLeads } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status, primary_decision_maker_id",
    )
    .in("id", poolLeadIds.length > 0 ? poolLeadIds : [BLITZ_LEAD_ID])

  const leadById = new Map((poolLeads ?? []).map((l) => [String((l as { id: string }).id), l]))

  type EnrichedCapacity = {
    leadId: string
    source: string
    state: string
    updatedAt: string
    companyName: string | null
    admissionState: string | null
    investmentState: string
    spendAuthorized: boolean
    portfolioEligible: boolean
    portfolioReason: string | null
    excluded: boolean
    exclusionReason: string | null
    missionPriorityOverall: number
    priorityBindingRank: number
  }

  const capacityEnriched: EnrichedCapacity[] = []
  for (const [index, row] of generationPool.candidates.entries()) {
    const lead = leadById.get(row.leadId)
    if (!lead) {
      capacityEnriched.push({
        leadId: row.leadId,
        source: row.source,
        state: row.state,
        updatedAt: row.updatedAt,
        companyName: null,
        admissionState: null,
        investmentState: "stop_investment",
        spendAuthorized: false,
        portfolioEligible: false,
        portfolioReason: "lead_not_found",
        excluded: true,
        exclusionReason: "lead_not_found",
        missionPriorityOverall: 100 - index,
        priorityBindingRank: index + 1,
      })
      continue
    }

    const metadata = (lead as { metadata?: Record<string, unknown> }).metadata ?? {}
    const admissionState = resolveLeadAdmissionStateFromMetadata(metadata)
    const pe = evaluateGrowthPortfolioLeadEligibility({ lead: lead as never, organizationId })
    if (!pe.eligible) {
      capacityEnriched.push({
        leadId: row.leadId,
        source: row.source,
        state: row.state,
        updatedAt: row.updatedAt,
        companyName: String((lead as { company_name?: string }).company_name ?? ""),
        admissionState,
        investmentState: "stop_investment",
        spendAuthorized: false,
        portfolioEligible: false,
        portfolioReason: pe.reasonCode,
        excluded: true,
        exclusionReason: pe.reasonCode ?? "portfolio_ineligible",
        missionPriorityOverall: 100 - index,
        priorityBindingRank: index + 1,
      })
      continue
    }

    const signals = buildResourceAllocationSignalsFromLead(lead as never, {
      budgetAvailable: true,
      killSwitchActive: false,
    })
    const resource = evaluateResourceAllocationFacade({
      organizationId,
      accountId: row.leadId,
      resourceClass: mapPortfolioCapacityClassToResourceClass("llm_drafting"),
      signals,
    })

    if (resource.investment_state === "stop_investment") {
      capacityEnriched.push({
        leadId: row.leadId,
        source: row.source,
        state: row.state,
        updatedAt: row.updatedAt,
        companyName: String((lead as { company_name?: string }).company_name ?? ""),
        admissionState,
        investmentState: resource.investment_state,
        spendAuthorized: resource.spend_authorized,
        portfolioEligible: true,
        portfolioReason: null,
        excluded: true,
        exclusionReason: "stop_investment",
        missionPriorityOverall: 100 - index,
        priorityBindingRank: index + 1,
      })
      continue
    }

    capacityEnriched.push({
      leadId: row.leadId,
      source: row.source,
      state: row.state,
      updatedAt: row.updatedAt,
      companyName: String((lead as { company_name?: string }).company_name ?? ""),
      admissionState,
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      portfolioEligible: true,
      portfolioReason: null,
      excluded: false,
      exclusionReason: null,
      missionPriorityOverall: 100 - index,
      priorityBindingRank: index + 1,
    })
  }

  const allocatable = capacityEnriched.filter((row) => !row.excluded)
  const allocation = evaluatePortfolioAllocationFacade({
    organizationId,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: capacityBatch.effectiveLimit,
    decidedAt: nowIso,
    candidates: allocatable.map((row) => ({
      leadId: row.leadId,
      organizationId,
      companyName: row.companyName,
      investmentState: row.investmentState as never,
      spendAuthorized: row.spendAuthorized,
      signals: {
        missionAligned: true,
        missionPriorityOverall: row.missionPriorityOverall,
        dailyQueueSortScore: row.missionPriorityOverall,
      },
    })),
  })

  console.log("\n=== Phase 2 — Generation Capacity Analysis (llm_drafting) ===")
  console.log(
    JSON.stringify(
      {
        capacity_class: "llm_drafting",
        slots_per_org: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
        effective_slots_this_tick: capacityBatch.effectiveLimit,
        wake_execution_enabled: capacityBatch.wakeExecutionEnabled,
        pool_candidates: generationPool.candidates.length,
        enriched_count: capacityEnriched.length,
        allocatable_count: allocatable.length,
        selected_count: allocation.selectedLeadIds.length,
        deferred_count: allocatable.filter((r) => !allocation.selectedLeadIds.includes(r.leadId)).length,
        allocation,
      },
      null,
      2,
    ),
  )

  const blitzEnriched = capacityEnriched.find((r) => r.leadId === BLITZ_LEAD_ID)
  console.log("\nBlitz capacity analysis:")
  console.log(
    JSON.stringify(
      {
        in_generation_pool: generationPool.candidates.some((c) => c.leadId === BLITZ_LEAD_ID),
        pool_source: generationPool.candidates.find((c) => c.leadId === BLITZ_LEAD_ID)?.source ?? null,
        enriched: blitzEnriched ?? null,
        selected_in_simulation: allocation.selectedLeadIds.includes(BLITZ_LEAD_ID),
        defer_reason: allocation.selectedLeadIds.includes(BLITZ_LEAD_ID)
          ? null
          : blitzEnriched?.excluded
            ? blitzEnriched.exclusionReason
            : "not_selected_by_evaluatePortfolioAllocationFacade",
        generation_attempts: (blitzDf as { attempt_counts?: { generation?: number } } | null)?.attempt_counts
          ?.generation,
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 3 — Competing Generation Candidates (llm_drafting) ===")
  for (const row of capacityEnriched) {
    const selected = allocation.selectedLeadIds.includes(row.leadId)
    console.log(
      JSON.stringify({
        leadId: row.leadId,
        company: row.companyName,
        admissionState: row.admissionState,
        dfState: row.state,
        source: row.source,
        investmentState: row.investmentState,
        portfolioEligible: row.portfolioEligible,
        excluded: row.excluded,
        exclusionReason: row.exclusionReason,
        missionPriorityOverall: row.missionPriorityOverall,
        selected,
        deferred: !selected && !row.excluded,
        why: row.excluded
          ? row.exclusionReason
          : selected
            ? "evaluatePortfolioAllocationFacade_selected"
            : "capacity_slots_exhausted_or_ranked_out",
      }),
    )
  }

  console.log("\n=== Phase 4 — Scheduler Timeline (Blitz wake receipts) ===")
  const { data: blitzReceipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_type, outcome, wake_fingerprint, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .gte("created_at", "2026-07-19T00:00:00.000Z")
    .order("created_at", { ascending: true })

  for (const receipt of blitzReceipts ?? []) {
    console.log(JSON.stringify(receipt, null, 2))
  }

  console.log("\n=== Phase 4b — Block Imaging generation receipts (reference happy path) ===")
  const { data: blockReceipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_type, outcome, wake_fingerprint, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLOCK_LEAD_ID)
    .in("wake_type", ["capacity_available", "generation_completed", "portfolio_deferred", "scheduled_resume"])
    .order("created_at", { ascending: true })

  for (const receipt of blockReceipts ?? []) {
    console.log(JSON.stringify(receipt, null, 2))
  }

  console.log("\n=== Phase 5 — Package Generation ===")
  const blitzPackageId = (blitzDf as { package_id?: string | null } | null)?.package_id ?? null
  const blockPackageId = (blockDf as { package_id?: string | null } | null)?.package_id ?? null

  const { data: blitzPrepRuns } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("id, lead_id, package_id, outcome, completed_at, created_at, approval_package")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: blockPrepRuns } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("id, lead_id, package_id, outcome, completed_at, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLOCK_LEAD_ID)
    .order("created_at", { ascending: false })
    .limit(5)

  console.log(
    JSON.stringify(
      {
        blitz: {
          df_package_id: blitzPackageId,
          df_state: (blitzDf as { state?: string } | null)?.state ?? null,
          preparation_runs: (blitzPrepRuns ?? []).map((run) => ({
            id: (run as { id: string }).id,
            package_id: (run as { package_id?: string }).package_id ?? null,
            outcome: (run as { outcome?: string }).outcome ?? null,
            has_approval_package: Boolean((run as { approval_package?: unknown }).approval_package),
            created_at: (run as { created_at?: string }).created_at ?? null,
          })),
          package_generation_occurred: Boolean(blitzPackageId || (blitzPrepRuns ?? []).length > 0),
        },
        block_reference: {
          df_package_id: blockPackageId,
          df_state: (blockDf as { state?: string } | null)?.state ?? null,
          preparation_run_count: (blockPrepRuns ?? []).length,
          latest_prep_run: blockPrepRuns?.[0] ?? null,
        },
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 6 — Idempotency (Blitz receipts) ===")
  const { data: blitzIdempotencyReceipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_type, outcome, wake_fingerprint, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", BLITZ_LEAD_ID)
    .in("outcome", ["duplicate_noop", "completed"])
    .order("created_at", { ascending: true })

  console.log(
    JSON.stringify(
      {
        duplicate_or_completed_receipts: blitzIdempotencyReceipts ?? [],
        idempotency_mechanism:
          "generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory reuses existing approval_package; planDurableStageAdvance returns duplicate_noop when draftValid+packageId at approval stage",
        blitz_has_package_to_deduplicate: Boolean(blitzPackageId),
      },
      null,
      2,
    ),
  )

  const { data: capacityAvailableOrg } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("lead_id, wake_type, outcome, created_at")
    .eq("organization_id", organizationId)
    .eq("wake_type", "capacity_available")
    .gte("created_at", "2026-07-19T00:00:00.000Z")
    .order("created_at", { ascending: false })
    .limit(20)

  console.log("\n=== Phase 7 — Generation Fairness (org-wide capacity_available receipts, 7d) ===")
  console.log(JSON.stringify(capacityAvailableOrg ?? [], null, 2))

  const { data: waitingForGenRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, updated_at, attempt_counts, package_id, next_eligible_wake_at")
    .eq("organization_id", organizationId)
    .eq("state", "waiting_for_generation")

  console.log("\nAll waiting_for_generation rows:")
  console.log(JSON.stringify(waitingForGenRows ?? [], null, 2))

  console.log("\n=== Phase 8 — Approval Readiness (Blitz) ===")
  const blitzEvidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId,
    leadId: BLITZ_LEAD_ID,
    portfolioSelected: true,
  }).catch(() => null)

  console.log(
    JSON.stringify(
      {
        current_df_state: (blitzDf as { state?: string } | null)?.state ?? null,
        earliest_incomplete_stage: (blitzDf as { earliest_incomplete_stage?: string } | null)
          ?.earliest_incomplete_stage,
        package_id: blitzPackageId,
        draft_valid: blitzEvidence?.draftValid ?? null,
        pending_human_approval: blitzEvidence?.pendingHumanApproval ?? null,
        transport_blocked: blitzEvidence?.transportBlocked ?? null,
        prerequisites_for_waiting_for_approval: [
          "capacity_available wake selects Blitz",
          "generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory persists package",
          "advanceDraftFactoryForLead completes generation stage with packageId",
          "durable state transitions to waiting_for_approval",
        ],
        outbound_transport: "disabled_by_policy (transportBlocked: true on packages)",
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 9/10 — Certification inputs ===")
  const blitzCapacityReceipts = (blitzReceipts ?? []).filter((r) => {
    const wt = String((r as { wake_type: string }).wake_type)
    const fp = String((r as { wake_fingerprint?: string }).wake_fingerprint ?? "")
    return (
      wt === "capacity_available" ||
      wt === "portfolio_deferred" ||
      fp.includes("llm_drafting") ||
      wt === "generation_completed"
    )
  })

  console.log(
    JSON.stringify(
      {
        generation_selection_works: allocation.selectedLeadIds.includes(BLITZ_LEAD_ID),
        package_generation_works_for_blitz: Boolean(blitzPackageId),
        block_happy_path_proven: Boolean(blockPackageId),
        blitz_capacity_wake_receipts: blitzCapacityReceipts,
        blitz_lost_to_competitor: allocatable.length > 1 && !allocation.selectedLeadIds.includes(BLITZ_LEAD_ID),
        permanent_waiting_risk:
          allocatable.length <= GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG
            ? "low_when_sole_allocatable_candidate"
            : "depends_on_ranking_each_tick",
      },
      null,
      2,
    ),
  )

  console.log("\n=== Audit complete (read-only) ===")
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
