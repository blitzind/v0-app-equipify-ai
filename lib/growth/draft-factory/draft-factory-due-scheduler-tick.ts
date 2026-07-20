/**
 * GE-AIOS-AUTONOMY-1B/1C/1E/1F — Draft Factory due/capacity sub-tick for Objective Runtime Scheduler.
 * Extends existing cron tick — does not register a new Vercel cron.
 *
 * AUTONOMY-1C: due advances via SV1-1 + SV1-2 capacity-class buckets.
 * AUTONOMY-1E: classify full due pool + sample per class before SV1-1 so FIFO
 * cannot starve capacity-class discovery under the due-tick runtime budget.
 * AUTONOMY-1F: waiting_for_generation enters llm_drafting capacity wake with
 * Growth 5F generation — due advances stay non-generative (allowGeneration: false).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { logGrowthEngine } from "@/lib/growth/access"
import { ensureGrowthAiEventBusInProcessSubscribers } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import {
  mapPortfolioCapacityClassToResourceClass,
} from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import {
  GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
  planFairDueCapacityClassAdmission,
} from "@/lib/growth/draft-factory/draft-factory-due-fair-admission"
import {
  collectGenerationCapacityCandidates,
  GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
  isWaitingForGenerationDurableState,
} from "@/lib/growth/draft-factory/draft-factory-generation-capacity"
import { selectPortfolioAwareDueDraftFactoryStates } from "@/lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import {
  advanceDraftFactoryCapacityWake,
  advanceDraftFactoryForLead,
  getDeferredDraftFactoryStates,
  listAdmissionIntegrityReconcileDraftFactoryStates,
  listDueDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import {
  advanceDraftFactoryForLeadLive,
  buildCanonicalEvidenceForLead,
} from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import {
  GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
  GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
  GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT,
  REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import {
  buildAdmissionIntegrityReconcileEvidenceFromMetadata,
  evaluateAdmissionDownstreamReconcileNeed,
  GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER,
  GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
  GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
  GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
  isAdmissionDownstreamReconcileState,
  isAdmissionReconcileCorrectedOutcome,
} from "@/lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { planWakeEvaluationBatch } from "@/lib/growth/runtime-guardrails/growth-wake-guardrails"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import type { AiOsPortfolioCapacityClass } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { DuePortfolioSelectionCandidate } from "@/lib/growth/draft-factory/draft-factory-due-portfolio-selection"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"

export type DraftFactoryAdmissionReconcileTickStats = {
  qa_marker: typeof GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER
  hotfix_3_qa_marker: typeof GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER
  hotfix_2_qa_marker: typeof GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER
  hotfix_1_qa_marker: typeof GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER
  limit_per_org: typeof REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG
  scan_pool_limit: typeof GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT
  candidates_found: number
  attempted: number
  corrected: number
  skipped: number
  failed: number
  remaining_violations: number
  elapsed_ms: number
  candidate_load_ms: number | null
  lead_fetch_ms: number | null
  batch_elapsed_ms: number | null
  avg_per_lead_elapsed_ms: number | null
  max_per_lead_elapsed_ms: number | null
  budget_remaining_before_reconcile_ms: number | null
  budget_remaining_after_reconcile_ms: number | null
  reconcile_started: boolean
  reconcile_completed: boolean
}

export type DraftFactoryDueSchedulerTickResult = {
  qa_marker: typeof GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER
  organizations_attempted: number
  due_states_found: number
  due_advanced: number
  capacity_selected: number
  capacity_deferred: number
  failures: number
  skipped_reason: string | null
  portfolio_aware_selected?: number
  portfolio_aware_classes?: number
  due_tick_started_at?: string
  due_tick_runtime_ms?: number
  budget_exhausted_phase?: string | null
  admission_reconcile?: DraftFactoryAdmissionReconcileTickStats
}

type BudgetPhase =
  | null
  | "classification"
  | "enrichment"
  | "advancement"
  | "admission_reconcile"
  | "capacity_wake"

async function projectInvestmentForDueLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  capacityClass: AiOsPortfolioCapacityClass,
): Promise<{
  investmentState: AiOsInvestmentState | null
  spendAuthorized: boolean
  companyName: string | null
  researchFresh: boolean | null
  researchStale: boolean | null
  enrichmentFailed: boolean
  enrichmentFailureReason: string | null
}> {
  try {
    const lead = await fetchGrowthLeadById(admin, leadId)
    if (!lead) {
      return {
        investmentState: "stop_investment",
        spendAuthorized: false,
        companyName: null,
        researchFresh: null,
        researchStale: null,
        enrichmentFailed: true,
        enrichmentFailureReason: "lead_not_found",
      }
    }

    const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
    const researchStale = lead.lastProspectResearchedAt
      ? isProspectResearchStale(lead.lastProspectResearchedAt)
      : true
    const researchFresh = hasUsableResearch && !researchStale

    const signals = buildResourceAllocationSignalsFromLead(lead, {
      budgetAvailable: true,
      killSwitchActive: false,
    })
    const resource = evaluateResourceAllocationFacade({
      organizationId,
      accountId: leadId,
      resourceClass: mapPortfolioCapacityClassToResourceClass(capacityClass),
      signals,
    })

    return {
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      companyName: lead.companyName,
      researchFresh,
      researchStale,
      enrichmentFailed: false,
      enrichmentFailureReason: null,
    }
  } catch (error) {
    return {
      investmentState: "stop_investment",
      spendAuthorized: false,
      companyName: null,
      researchFresh: null,
      researchStale: null,
      enrichmentFailed: true,
      enrichmentFailureReason:
        error instanceof Error ? error.message.slice(0, 160) : "enrichment_exception",
    }
  }
}

function remainingDueTickBudgetMs(startedAt: number, maxRuntimeMs: number): number {
  return Math.max(0, maxRuntimeMs - (Date.now() - startedAt))
}

async function prefetchLeadMetadataForAdmissionReconcile(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, Record<string, unknown> | null>> {
  const metadataByLead = new Map<string, Record<string, unknown> | null>()
  const uniqueLeadIds = [...new Set(leadIds)]
  if (uniqueLeadIds.length === 0) return metadataByLead

  for (let offset = 0; offset < uniqueLeadIds.length; offset += 100) {
    const chunk = uniqueLeadIds.slice(offset, offset + 100)
    const { data, error } = await admin
      .schema("growth")
      .from("leads")
      .select("id, metadata")
      .in("id", chunk)
    if (error) continue
    for (const row of data ?? []) {
      metadataByLead.set(
        String((row as { id: string }).id),
        ((row as { metadata?: Record<string, unknown> | null }).metadata ?? null) as Record<
          string,
          unknown
        > | null,
      )
    }
  }

  for (const leadId of uniqueLeadIds) {
    if (!metadataByLead.has(leadId)) metadataByLead.set(leadId, null)
  }

  return metadataByLead
}

type AdmissionReconcileOrgResult = {
  orgCandidatesFound: number
  orgAttempted: number
  orgCorrected: number
  orgSkipped: number
  orgFailed: number
  orgRemainingViolations: number
  reconcileElapsedMs: number
  candidateLoadMs: number
  leadFetchMs: number
  batchElapsedMs: number
  avgPerLeadElapsedMs: number | null
  maxPerLeadElapsedMs: number | null
  budgetRemainingBeforeMs: number
  budgetRemainingAfterMs: number
  budgetExhaustedDuringReconcile: boolean
  secondCandidateBlockedByBudgetGuard: boolean
}

async function runAdmissionIntegrityReconcileForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    repository: Awaited<ReturnType<typeof resolveDraftFactoryDurableRepository>>["repository"]
    now: string
    startedAt: number
    maxRuntimeMs: number
  },
): Promise<AdmissionReconcileOrgResult> {
  const reconcileStartedAt = Date.now()
  const budgetRemainingBeforeMs = remainingDueTickBudgetMs(input.startedAt, input.maxRuntimeMs)

  logGrowthEngine("draft_factory_admission_reconcile_started", {
    qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
    hotfix_3_qa_marker: GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
    organization_id: input.organizationId,
    budget_remaining_before_reconcile_ms: budgetRemainingBeforeMs,
    budget_before_ms: budgetRemainingBeforeMs,
    limit_per_org: REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
  })

  const candidateLoadStartedAt = Date.now()
  const reconcileScanStates = await listAdmissionIntegrityReconcileDraftFactoryStates({
    organizationId: input.organizationId,
    limit: GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT,
    repository: input.repository,
  })
  const candidateLoadMs = Date.now() - candidateLoadStartedAt

  const downstreamLeadIds = reconcileScanStates
    .filter((row) => isAdmissionDownstreamReconcileState(row.state))
    .map((row) => row.leadId)

  const leadFetchStartedAt = Date.now()
  const metadataCache = await prefetchLeadMetadataForAdmissionReconcile(admin, downstreamLeadIds)
  const leadFetchMs = Date.now() - leadFetchStartedAt

  const violationRows: Array<{
    row: Awaited<ReturnType<typeof listAdmissionIntegrityReconcileDraftFactoryStates>>[number]
    need: ReturnType<typeof evaluateAdmissionDownstreamReconcileNeed>
    metadata: Record<string, unknown>
  }> = []
  let orgSkipped = 0

  for (const row of reconcileScanStates) {
    if (!isAdmissionDownstreamReconcileState(row.state)) continue

    const metadata = metadataCache.get(row.leadId) ?? null
    if (metadata == null) {
      orgSkipped += 1
      continue
    }

    const need = evaluateAdmissionDownstreamReconcileNeed({ metadata })
    if (!need.needsReconcile) {
      orgSkipped += 1
      continue
    }

    violationRows.push({ row, need, metadata })
  }

  const orgCandidatesFound = violationRows.length
  let orgAttempted = 0
  let orgCorrected = 0
  let orgFailed = 0
  let budgetExhaustedDuringReconcile = false
  let secondCandidateBlockedByBudgetGuard = false
  const perLeadElapsedMs: number[] = []

  for (const { row, need, metadata } of violationRows.slice(0, REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG)) {
    const budgetBeforeAttemptMs = remainingDueTickBudgetMs(input.startedAt, input.maxRuntimeMs)
    if (budgetBeforeAttemptMs <= 0) {
      budgetExhaustedDuringReconcile = true
      if (orgAttempted === 1) secondCandidateBlockedByBudgetGuard = true
      break
    }

    orgAttempted += 1
    const perLeadStartedAt = Date.now()
    let evidenceBuildMs = 0
    let advanceMs = 0

    try {
      const evidenceStartedAt = Date.now()
      const evidence = buildAdmissionIntegrityReconcileEvidenceFromMetadata(metadata)
      evidenceBuildMs = Date.now() - evidenceStartedAt

      const advanceStartedAt = Date.now()
      const result = await advanceDraftFactoryForLead({
        organizationId: input.organizationId,
        leadId: row.leadId,
        wake: {
          type: "scheduled_resume",
          sourceId: `reconcile:admission:${input.organizationId}:${row.leadId}:${input.now}`,
        },
        now: input.now,
        evidence,
        workerId: `df-admission-reconcile:${input.organizationId}`,
        repository: input.repository,
        completionHints: { admissionIntegrityReconcile: true },
      })
      advanceMs = Date.now() - advanceStartedAt

      const corrected = isAdmissionReconcileCorrectedOutcome({
        outcome: result.outcome,
        nextState: result.nextState,
      })
      if (corrected) orgCorrected += 1

      const perLeadElapsed = Date.now() - perLeadStartedAt
      perLeadElapsedMs.push(perLeadElapsed)

      logGrowthEngine("draft_factory_admission_downstream_reconciled", {
        qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
        hotfix_3_qa_marker: GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
        hotfix_2_qa_marker: GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
        organization_id: input.organizationId,
        lead_id: row.leadId,
        previous_state: row.state,
        outcome: result.outcome,
        next_state: result.nextState,
        admission_state: need.admissionState,
        dm_violation: need.dmViolation,
        package_violation: need.packageViolation,
        corrected,
        evidence_build_ms: evidenceBuildMs,
        advance_ms: advanceMs,
        per_lead_elapsed_ms: perLeadElapsed,
        budget_before_ms: budgetBeforeAttemptMs,
        budget_after_ms: remainingDueTickBudgetMs(input.startedAt, input.maxRuntimeMs),
      })
    } catch (error) {
      orgFailed += 1
      perLeadElapsedMs.push(Date.now() - perLeadStartedAt)
      logGrowthEngine("draft_factory_admission_downstream_reconcile_failed", {
        qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
        organization_id: input.organizationId,
        lead_id: row.leadId,
        previous_state: row.state,
        evidence_build_ms: evidenceBuildMs,
        advance_ms: advanceMs,
        per_lead_elapsed_ms: Date.now() - perLeadStartedAt,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  const orgRemainingViolations = Math.max(0, orgCandidatesFound - orgCorrected)
  const reconcileElapsedMs = Date.now() - reconcileStartedAt
  const budgetRemainingAfterMs = remainingDueTickBudgetMs(input.startedAt, input.maxRuntimeMs)
  const avgPerLeadElapsedMs =
    perLeadElapsedMs.length > 0
      ? Math.round(perLeadElapsedMs.reduce((sum, value) => sum + value, 0) / perLeadElapsedMs.length)
      : null
  const maxPerLeadElapsedMs = perLeadElapsedMs.length > 0 ? Math.max(...perLeadElapsedMs) : null

  logGrowthEngine("draft_factory_admission_reconcile_batch", {
    qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
    hotfix_3_qa_marker: GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
    hotfix_2_qa_marker: GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
    hotfix_1_qa_marker: GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER,
    organization_id: input.organizationId,
    limit_per_org: REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
    scan_pool_limit: GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT,
    scan_pool_rows: reconcileScanStates.length,
    candidates_found: orgCandidatesFound,
    attempted: orgAttempted,
    corrected: orgCorrected,
    skipped: orgSkipped,
    failed: orgFailed,
    remaining_violations: orgRemainingViolations,
    elapsed_ms: reconcileElapsedMs,
    candidate_load_ms: candidateLoadMs,
    lead_fetch_ms: leadFetchMs,
    batch_elapsed_ms: reconcileElapsedMs,
    avg_per_lead_elapsed_ms: avgPerLeadElapsedMs,
    max_per_lead_elapsed_ms: maxPerLeadElapsedMs,
    budget_remaining_before_reconcile_ms: budgetRemainingBeforeMs,
    budget_remaining_after_reconcile_ms: budgetRemainingAfterMs,
    budget_before_ms: budgetRemainingBeforeMs,
    budget_after_ms: budgetRemainingAfterMs,
    budget_exhausted: budgetExhaustedDuringReconcile,
    second_candidate_blocked_by_budget_guard: secondCandidateBlockedByBudgetGuard,
    lightweight_reconcile_path: true,
  })

  logGrowthEngine("draft_factory_admission_reconcile_completed", {
    qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
    organization_id: input.organizationId,
    candidates_found: orgCandidatesFound,
    attempted: orgAttempted,
    corrected: orgCorrected,
    failed: orgFailed,
    remaining_violations: orgRemainingViolations,
    elapsed_ms: reconcileElapsedMs,
    batch_elapsed_ms: reconcileElapsedMs,
    budget_remaining_after_reconcile_ms: budgetRemainingAfterMs,
    budget_after_ms: budgetRemainingAfterMs,
    budget_exhausted: budgetExhaustedDuringReconcile,
    avg_per_lead_elapsed_ms: avgPerLeadElapsedMs,
    max_per_lead_elapsed_ms: maxPerLeadElapsedMs,
  })

  return {
    orgCandidatesFound,
    orgAttempted,
    orgCorrected,
    orgSkipped,
    orgFailed,
    orgRemainingViolations,
    reconcileElapsedMs,
    candidateLoadMs,
    leadFetchMs,
    batchElapsedMs: reconcileElapsedMs,
    avgPerLeadElapsedMs,
    maxPerLeadElapsedMs,
    budgetRemainingBeforeMs,
    budgetRemainingAfterMs,
    budgetExhaustedDuringReconcile,
    secondCandidateBlockedByBudgetGuard,
  }
}

export async function tickDraftFactoryDueStatesForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
    /** AUTONOMY-1E — due-tick local clock. Prefer omitting so the tick starts fresh. */
    startedAt?: number
    maxRuntimeMs?: number
    maxOrganizations?: number
  },
): Promise<DraftFactoryDueSchedulerTickResult> {
  ensureGrowthAiEventBusInProcessSubscribers()

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled) {
    return {
      qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
      organizations_attempted: 0,
      due_states_found: 0,
      due_advanced: 0,
      capacity_selected: 0,
      capacity_deferred: 0,
      failures: 0,
      skipped_reason: "Draft Factory due tick disabled by autonomy kill switch.",
    }
  }

  // AUTONOMY-1E — due-tick clock starts here (not shared with sales-loop start).
  const startedAt = input.startedAt ?? Date.now()
  const dueTickStartedAtIso = new Date(startedAt).toISOString()
  const maxRuntimeMs = input.maxRuntimeMs ?? 15_000
  const maxOrgs = input.maxOrganizations ?? GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS
  const organizationIds = [...new Set(input.organizationIds)].slice(0, maxOrgs)

  let dueStatesFound = 0
  let dueAdvanced = 0
  let capacitySelected = 0
  let capacityDeferred = 0
  let failures = 0
  let portfolioAwareSelected = 0
  let portfolioAwareClasses = 0
  let budgetExhaustedPhase: BudgetPhase = null
  const admissionReconcileAggregate: DraftFactoryAdmissionReconcileTickStats = {
    qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
    hotfix_3_qa_marker: GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
    hotfix_2_qa_marker: GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
    hotfix_1_qa_marker: GROWTH_REVENUE_2A_HOTFIX_1_QA_MARKER,
    limit_per_org: REVENUE_PROMOTION_RECONCILE_LIMIT_PER_ORG,
    scan_pool_limit: GROWTH_DRAFT_FACTORY_ADMISSION_RECONCILE_POOL_LIMIT,
    candidates_found: 0,
    attempted: 0,
    corrected: 0,
    skipped: 0,
    failed: 0,
    remaining_violations: 0,
    elapsed_ms: 0,
    candidate_load_ms: null,
    lead_fetch_ms: null,
    batch_elapsed_ms: null,
    avg_per_lead_elapsed_ms: null,
    max_per_lead_elapsed_ms: null,
    budget_remaining_before_reconcile_ms: null,
    budget_remaining_after_reconcile_ms: null,
    reconcile_started: false,
    reconcile_completed: false,
  }

  for (const organizationId of organizationIds) {
    if (Date.now() - startedAt >= maxRuntimeMs) {
      budgetExhaustedPhase = budgetExhaustedPhase ?? "advancement"
      break
    }

    try {
      const resolved = await resolveDraftFactoryDurableRepository({
        runtime: "production",
        admin,
      })
      if (resolved.kind !== "postgres") {
        failures += 1
        continue
      }
      const repository = resolved.repository
      const now = new Date().toISOString()

      const dueStates = await listDueDraftFactoryStates({
        organizationId,
        now,
        limit: GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
        repository,
      })
      dueStatesFound += dueStates.length

      // HOTFIX-3 — integrity reconcile runs first while budget is fresh (no provider/package work).
      admissionReconcileAggregate.reconcile_started = true
      const reconcileResult = await runAdmissionIntegrityReconcileForOrganization(admin, {
        organizationId,
        repository,
        now,
        startedAt,
        maxRuntimeMs,
      })
      admissionReconcileAggregate.candidates_found += reconcileResult.orgCandidatesFound
      admissionReconcileAggregate.attempted += reconcileResult.orgAttempted
      admissionReconcileAggregate.corrected += reconcileResult.orgCorrected
      admissionReconcileAggregate.skipped += reconcileResult.orgSkipped
      admissionReconcileAggregate.failed += reconcileResult.orgFailed
      admissionReconcileAggregate.remaining_violations += reconcileResult.orgRemainingViolations
      admissionReconcileAggregate.elapsed_ms += reconcileResult.reconcileElapsedMs
      admissionReconcileAggregate.candidate_load_ms = reconcileResult.candidateLoadMs
      admissionReconcileAggregate.lead_fetch_ms = reconcileResult.leadFetchMs
      admissionReconcileAggregate.batch_elapsed_ms = reconcileResult.batchElapsedMs
      admissionReconcileAggregate.avg_per_lead_elapsed_ms = reconcileResult.avgPerLeadElapsedMs
      admissionReconcileAggregate.max_per_lead_elapsed_ms = reconcileResult.maxPerLeadElapsedMs
      admissionReconcileAggregate.budget_remaining_before_reconcile_ms =
        reconcileResult.budgetRemainingBeforeMs
      admissionReconcileAggregate.budget_remaining_after_reconcile_ms =
        reconcileResult.budgetRemainingAfterMs
      admissionReconcileAggregate.reconcile_completed = true
      if (reconcileResult.budgetExhaustedDuringReconcile) {
        budgetExhaustedPhase = budgetExhaustedPhase ?? "admission_reconcile"
      }

      // GE-AIOS-CONTACT-1B — resume pending DataMoon DM discovery polls (no new cron).
      try {
        const { pollDueDatamoonDmDiscoveriesForOrganization } = await import(
          "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-poll-tick"
        )
        await pollDueDatamoonDmDiscoveriesForOrganization(admin, {
          organizationId,
          now,
          limit: 10,
          portfolioSelected: true,
        })
      } catch {
        // Poll tick must not abort DF due advances.
      }

      // AUTONOMY-1E — eager class discovery from the full due pool (pure, no SV1-1).
      const admission = planFairDueCapacityClassAdmission({
        dueStates: dueStates.map((state) => ({
          leadId: state.leadId,
          state: state.state,
          updatedAt: state.updatedAt,
          earliestIncompleteStage: state.earliestIncompleteStage,
        })),
        totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
        perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
      })

      const enriched: DuePortfolioSelectionCandidate[] = []
      const enrichedCountByClass: Record<string, number> = {}
      let enrichmentFailureCount = 0
      let enrichmentBudgetExhausted = false
      const dueStateByLead = new Map(dueStates.map((row) => [row.leadId, row]))

      for (const candidate of admission.sampledCandidates) {
        if (Date.now() - startedAt >= maxRuntimeMs) {
          enrichmentBudgetExhausted = true
          budgetExhaustedPhase = "enrichment"
          break
        }

        const investment = await projectInvestmentForDueLead(
          admin,
          organizationId,
          candidate.leadId,
          candidate.capacityClass,
        )

        if (investment.enrichmentFailed) {
          enrichmentFailureCount += 1
          logGrowthEngine("draft_factory_due_enrichment_failed", {
            qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
            organization_id: organizationId,
            lead_id: candidate.leadId,
            capacity_class: candidate.capacityClass,
            reason: investment.enrichmentFailureReason,
          })
          // Fail closed for this lead — still include stop so SV1-2 can skip consistently.
        } else {
          const dueRow = dueStateByLead.get(candidate.leadId)
          const lead = await fetchGrowthLeadById(admin, candidate.leadId).catch(() => null)
          if (lead) {
            const portfolioEligibility = evaluateGrowthPortfolioLeadEligibility({
              lead,
              organizationId,
            })
            if (!portfolioEligibility.eligible) {
              logGrowthEngine("draft_factory_due_admission_excluded", {
                qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
                organization_id: organizationId,
                lead_id: candidate.leadId,
                capacity_class: candidate.capacityClass,
                reason: portfolioEligibility.reasonCode,
              })
              continue
            }
          }

          enriched.push({
            leadId: candidate.leadId,
            state: candidate.state,
            updatedAt: candidate.updatedAt,
            earliestIncompleteStage: dueRow?.earliestIncompleteStage ?? null,
            investmentState: investment.investmentState,
            spendAuthorized: investment.spendAuthorized,
            companyName: investment.companyName,
            researchFresh: investment.researchFresh,
            researchStale: investment.researchStale,
          })
          enrichedCountByClass[candidate.capacityClass] =
            (enrichedCountByClass[candidate.capacityClass] ?? 0) + 1
        }
      }

      // Portfolio selection runs on whatever was enriched; discovered classes already logged.
      const selection = selectPortfolioAwareDueDraftFactoryStates({
        organizationId,
        dueStates: enriched,
        totalAdvanceBudget: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
        perClassCandidateCap: GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP,
        decidedAt: now,
      })
      portfolioAwareSelected += selection.selectedLeadIds.length
      portfolioAwareClasses += selection.classSelections.length

      const selectedCountByClass: Record<string, number> = {}
      for (const row of selection.classSelections) {
        selectedCountByClass[row.capacityClass] = row.selectedLeadIds.length
      }

      logGrowthEngine("draft_factory_due_portfolio_selection", {
        qa_marker: selection.qa_marker,
        autonomy_1e_qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
        organization_id: organizationId,
        due_pool: dueStates.length,
        due_pool_count: admission.duePoolCount,
        selected: selection.selectedLeadIds.length,
        active_capacity_classes: admission.activeCapacityClasses,
        raw_count_by_class: admission.rawCountByClass,
        candidate_cap_by_class: admission.candidateCapByClass,
        sampled_count_by_class: admission.sampledCountByClass,
        enriched_count_by_class: enrichedCountByClass,
        selected_count_by_class: selectedCountByClass,
        skipped_stop_count: selection.classSelections.reduce(
          (sum, row) => sum + row.skippedStopInvestment,
          0,
        ),
        enrichment_failure_count: enrichmentFailureCount,
        budget_exhausted_phase: enrichmentBudgetExhausted ? "enrichment" : null,
        due_tick_started_at: dueTickStartedAtIso,
        classes: selection.classSelections.map((row) => ({
          capacity_class: row.capacityClass,
          slots: row.slotsAllocated,
          candidates: row.candidateCount,
          selected: row.selectedLeadIds.length,
          stop_skipped: row.skippedStopInvestment,
        })),
      })

      for (const leadId of selection.selectedLeadIds) {
        const capacityClass = selection.selectedByClass[leadId]
        const candidate = enriched.find((row) => row.leadId === leadId)
        logGrowthEngine("draft_factory_due_lead_selection_explain", {
          qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
          organization_id: organizationId,
          lead_id: leadId,
          capacity_class: capacityClass ?? null,
          sampled: true,
          investment: candidate?.investmentState ?? null,
          portfolio: "selected",
          advanced: false,
          reason: "portfolio_selected_pending_advance",
        })
      }

      const dueBatch = planWakeEvaluationBatch({
        totalWaits: selection.selectedLeadIds.length,
        perRunCap: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
      })

      if (dueBatch.wakeExecutionEnabled && dueBatch.effectiveLimit > 0) {
        for (const leadId of selection.selectedLeadIds.slice(0, dueBatch.effectiveLimit)) {
          if (Date.now() - startedAt >= maxRuntimeMs) {
            budgetExhaustedPhase = "advancement"
            break
          }
          const capacityClass = selection.selectedByClass[leadId]
          const candidate = enriched.find((row) => row.leadId === leadId)
          const durableState = dueStateByLead.get(leadId)?.state

          // AUTONOMY-1F — generation-ready leads are owned by the capacity wake + Growth 5F.
          if (
            capacityClass === "llm_drafting" &&
            isWaitingForGenerationDurableState(durableState)
          ) {
            logGrowthEngine("draft_factory_due_lead_selection_explain", {
              qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
              organization_id: organizationId,
              lead_id: leadId,
              capacity_class: capacityClass,
              sampled: true,
              investment: candidate?.investmentState ?? null,
              portfolio: "selected",
              advanced: false,
              reason: "routed_to_generation_capacity_wake",
            })
            continue
          }

          const result = await advanceDraftFactoryForLeadLive(admin, {
            organizationId,
            leadId,
            wake: {
              type: "scheduled_resume",
              sourceId: `due:${organizationId}:${leadId}:${now}:${capacityClass ?? "unknown"}`,
            },
            portfolioSelected: true,
            // Intentional: due advances never generate packages.
            allowGeneration: false,
            workerId: `df-due-scheduler:${organizationId}`,
          })
          const advanced = result.outcome !== "duplicate_noop"
          if (advanced) dueAdvanced += 1
          logGrowthEngine("draft_factory_due_lead_selection_explain", {
            qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
            organization_id: organizationId,
            lead_id: leadId,
            capacity_class: capacityClass ?? null,
            sampled: true,
            investment: candidate?.investmentState ?? null,
            portfolio: "selected",
            advanced,
            reason: advanced ? "advanced" : "duplicate_noop",
            outcome: result.outcome,
          })
        }
      }

      // AUTONOMY-1F — capacity wake discovers waiting_for_generation + deferred.
      const deferred = await getDeferredDraftFactoryStates(organizationId, repository)
      const generationPool = collectGenerationCapacityCandidates({
        deferredStates: deferred.map((row) => ({
          leadId: row.leadId,
          state: row.state,
          updatedAt: row.updatedAt,
        })),
        dueStates: dueStates.map((row) => ({
          leadId: row.leadId,
          state: row.state,
          updatedAt: row.updatedAt,
        })),
        limit: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
      })
      const capacityCandidates = generationPool.candidates
      const capacityBatch = planWakeEvaluationBatch({
        totalWaits: capacityCandidates.length,
        perRunCap: GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG,
      })

      logGrowthEngine("draft_factory_generation_capacity_pool", {
        qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
        organization_id: organizationId,
        deferred_count: generationPool.deferredCount,
        waiting_for_generation_count: generationPool.waitingForGenerationCount,
        capacity_candidate_count: capacityCandidates.length,
        capacity_slots: capacityBatch.effectiveLimit,
        wake_execution_enabled: capacityBatch.wakeExecutionEnabled,
      })

      if (capacityBatch.wakeExecutionEnabled && capacityBatch.effectiveLimit > 0 && capacityCandidates.length > 0) {
        const capacityEnriched: Array<{
          leadId: string
          investmentState: AiOsInvestmentState
          spendAuthorized: boolean
          evidence: AiOsDraftFactoryCanonicalEvidence
          signals: { missionPriorityOverall: number; priorityBindingRank: number }
        }> = []

        for (const [index, row] of capacityCandidates.entries()) {
          if (Date.now() - startedAt >= maxRuntimeMs) {
            budgetExhaustedPhase = budgetExhaustedPhase ?? "capacity_wake"
            break
          }
          const investment = await projectInvestmentForDueLead(
            admin,
            organizationId,
            row.leadId,
            "llm_drafting",
          )
          if (investment.investmentState === "stop_investment" || investment.enrichmentFailed) {
            logGrowthEngine("draft_factory_generation_capacity_skipped", {
              qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
              organization_id: organizationId,
              lead_id: row.leadId,
              source: row.source,
              investment: investment.investmentState,
              reason: investment.enrichmentFailureReason ?? "stop_investment",
            })
            continue
          }
          const lead = await fetchGrowthLeadById(admin, row.leadId).catch(() => null)
          if (lead) {
            const portfolioEligibility = evaluateGrowthPortfolioLeadEligibility({
              lead,
              organizationId,
            })
            if (!portfolioEligibility.eligible) {
              logGrowthEngine("draft_factory_generation_capacity_admission_excluded", {
                qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
                organization_id: organizationId,
                lead_id: row.leadId,
                reason: portfolioEligibility.reasonCode,
              })
              continue
            }
          }
          const evidence = await buildCanonicalEvidenceForLead(admin, {
            organizationId,
            leadId: row.leadId,
            portfolioSelected: true,
          })
          capacityEnriched.push({
            leadId: row.leadId,
            investmentState: (investment.investmentState ?? "maintain_investment") as AiOsInvestmentState,
            spendAuthorized: investment.spendAuthorized,
            evidence,
            signals: {
              missionPriorityOverall: 100 - index,
              priorityBindingRank: index + 1,
            },
          })
        }

        if (capacityEnriched.length > 0) {
          const capacity = await advanceDraftFactoryCapacityWake({
            organizationId,
            capacityClass: "llm_drafting",
            capacitySlotsAvailable: capacityBatch.effectiveLimit,
            now,
            workerId: `df-capacity-scheduler:${organizationId}`,
            repository,
            candidates: capacityEnriched,
            generateViaGrowth5F: async ({ organizationId: orgId, leadId, now: generatedAt }) => {
              const persisted = await generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(
                admin,
                {
                  organizationId: orgId,
                  leadId,
                  generatedAt,
                },
              )
              if (!persisted) return null
              return {
                packageId: persisted.packageId,
                pendingHumanApproval: true as const,
                transportBlocked: true as const,
              }
            },
          })
          capacitySelected += capacity.selectedLeadIds.length
          capacityDeferred += capacity.deferredLeadIds.length

          for (const leadId of capacity.selectedLeadIds) {
            const result = capacity.results.find((row) => row.leadId === leadId)
            logGrowthEngine("draft_factory_generation_capacity_selected", {
              qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
              organization_id: organizationId,
              lead_id: leadId,
              capacity_class: "llm_drafting",
              allow_generation: true,
              package_id: result?.packageId ?? null,
              next_state: result?.nextState ?? null,
              outcome: result?.outcome ?? null,
              pending_human_approval: true,
              transport_blocked: true,
            })
          }
        }
      }
    } catch (error) {
      failures += 1
      logGrowthEngine("draft_factory_due_scheduler_org_failed", {
        qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
        organization_id: organizationId,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  const dueTickRuntimeMs = Date.now() - startedAt
  logGrowthEngine("draft_factory_due_scheduler_tick", {
    qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
    autonomy_1e_qa_marker: GROWTH_AIOS_AUTONOMY_1E_QA_MARKER,
    autonomy_1f_qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
    revenue_2a_hotfix_4_qa_marker: GROWTH_REVENUE_2A_HOTFIX_4_QA_MARKER,
    revenue_2a_hotfix_3_qa_marker: GROWTH_REVENUE_2A_HOTFIX_3_QA_MARKER,
    revenue_2a_hotfix_2_qa_marker: GROWTH_REVENUE_2A_HOTFIX_2_QA_MARKER,
    organizations_attempted: organizationIds.length,
    due_states_found: dueStatesFound,
    due_advanced: dueAdvanced,
    capacity_selected: capacitySelected,
    capacity_deferred: capacityDeferred,
    portfolio_aware_selected: portfolioAwareSelected,
    portfolio_aware_classes: portfolioAwareClasses,
    failures,
    due_tick_started_at: dueTickStartedAtIso,
    due_tick_runtime_ms: dueTickRuntimeMs,
    budget_exhausted_phase: budgetExhaustedPhase,
    runtime_ms: dueTickRuntimeMs,
    admission_reconcile: admissionReconcileAggregate,
  })

  return {
    qa_marker: GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
    organizations_attempted: organizationIds.length,
    due_states_found: dueStatesFound,
    due_advanced: dueAdvanced,
    capacity_selected: capacitySelected,
    capacity_deferred: capacityDeferred,
    failures,
    skipped_reason: null,
    portfolio_aware_selected: portfolioAwareSelected,
    portfolio_aware_classes: portfolioAwareClasses,
    due_tick_started_at: dueTickStartedAtIso,
    due_tick_runtime_ms: dueTickRuntimeMs,
    budget_exhausted_phase: budgetExhaustedPhase,
    admission_reconcile: admissionReconcileAggregate,
  }
}
