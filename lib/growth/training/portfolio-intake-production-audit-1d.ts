/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Production survivor → lead promotion audit (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isLeadInPortfolioOrganizationScope } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import {
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  BATCH_RANK_CUTOFF_TRACE,
  BUILDING_RUN_DEFERRED_PUSH_TRACE,
  COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
  INTAKE_PENDING_RESUME_TRACE,
  REPLENISHMENT_SKIP_TRACE,
  assertAllNonPromotedClassified,
  buildClassificationSummary,
  projectIntakeThroughputFromEvidence,
  splitPromotionCorrectness,
} from "@/lib/growth/training/portfolio-intake-survivor-classification-1d"
import {
  loadPortfolioIntakeSurvivorsFromProduction,
  type LoadedPortfolioIntakeSurvivor,
} from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"
import {
  GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER,
  type PortfolioIntakeDecisionTrace,
  type PortfolioIntakeSurvivorClassification,
  type PortfolioIntakeSurvivorInventoryRow,
} from "@/lib/growth/training/portfolio-intake-survivor-types-1d"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"

type OrgLeadRow = {
  id: string
  company_name: string | null
  website: string | null
  status: string | null
  metadata: Record<string, unknown>
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
  sourceIds: string[]
  dedupeHashes: string[]
  domains: string[]
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? ""
}

function extractLeadIndexes(lead: OrgLeadRow) {
  const metadata = lead.metadata
  const prospectSearch =
    metadata.prospect_search && typeof metadata.prospect_search === "object"
      ? (metadata.prospect_search as Record<string, unknown>)
      : null
  const sourceId = typeof prospectSearch?.source_id === "string" ? prospectSearch.source_id.trim() : null
  if (sourceId) lead.sourceIds.push(sourceId)

  const dedupeHash =
    typeof metadata.leadInboxDedupeHash === "string" ? metadata.leadInboxDedupeHash.trim() : null
  if (dedupeHash) lead.dedupeHashes.push(dedupeHash)

  const domain = normalizeDomain(lead.website)
  if (domain) lead.domains.push(domain)
}

function normalizeCompanyName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function buildLeadMatchIndex(leads: OrgLeadRow[]) {
  const bySourceId = new Map<string, OrgLeadRow>()
  const byDedupeHash = new Map<string, OrgLeadRow>()
  const byDomain = new Map<string, OrgLeadRow>()
  const byCompanyName = new Map<string, OrgLeadRow>()
  for (const lead of leads) {
    for (const sourceId of lead.sourceIds) {
      if (!bySourceId.has(sourceId)) bySourceId.set(sourceId, lead)
    }
    for (const hash of lead.dedupeHashes) {
      if (!byDedupeHash.has(hash)) byDedupeHash.set(hash, lead)
    }
    for (const domain of lead.domains) {
      if (!byDomain.has(domain)) byDomain.set(domain, lead)
    }
    const companyName = normalizeCompanyName(lead.company_name)
    if (companyName && !byCompanyName.has(companyName)) {
      byCompanyName.set(companyName, lead)
    }
  }
  return { bySourceId, byDedupeHash, byDomain, byCompanyName }
}

function resolveLeadForSurvivor(
  survivor: LoadedPortfolioIntakeSurvivor,
  index: ReturnType<typeof buildLeadMatchIndex>,
): OrgLeadRow | null {
  return (
    index.bySourceId.get(survivor.canonicalCompanyKey) ??
    index.byDedupeHash.get(survivor.dedupeHash) ??
    index.byDomain.get(normalizeDomain(survivor.company.website)) ??
    index.byCompanyName.get(normalizeCompanyName(survivor.company.company_name)) ??
    null
  )
}

function resolveResearchStatus(lead: OrgLeadRow | null): "complete" | "started" | "none" {
  if (!lead) return "none"
  if (lead.latest_prospect_research_run_id || lead.last_prospect_researched_at) {
    return lead.latest_prospect_research_run_id ? "complete" : "started"
  }
  return "none"
}

function classifySurvivor(input: {
  survivor: LoadedPortfolioIntakeSurvivor
  lead: OrgLeadRow | null
  admissionStatus: string | null
  canonicalFirstSeenRunId: string | null
  runHadAnyPromotion: boolean
  isFirstCanonicalInstance: boolean
  runEligibleForIntakePromotion: boolean
  runIntakeCompleted: boolean
}): {
  classification: PortfolioIntakeSurvivorClassification | "promoted_to_lead"
  promotionCorrect: boolean | null
  leadStatus: "promoted" | "not_promoted"
  decisionTrace: PortfolioIntakeDecisionTrace
  notes: string
} {
  const { survivor, lead, runHadAnyPromotion, isFirstCanonicalInstance } = input

  if (lead) {
    const directMatch =
      input.lead!.sourceIds.includes(survivor.canonicalCompanyKey) ||
      input.lead!.dedupeHashes.includes(survivor.dedupeHash)
    if (directMatch && isFirstCanonicalInstance) {
      return {
        classification: "promoted_to_lead",
        promotionCorrect: null,
        leadStatus: "promoted",
        decisionTrace: {
          function: "executeBulkPushToLeadInbox",
          file: "lib/growth/prospect-search/prospect-search-push-to-inbox.ts",
          condition: "pushProspectSearchCompanyToLeadInbox → createLeadCandidate → pushed",
          returnPath: "runUnifiedRevenueWorkflowAfterIntake",
          stoppingReason: "Survivor promoted to growth.leads via autonomous portfolio batch push",
        },
        notes: `Lead ${lead.id}`,
      }
    }
    return {
      classification: "already_existing_lead",
      promotionCorrect: true,
      leadStatus: "not_promoted",
      decisionTrace: {
        function: "pushProspectSearchCompanyToLeadInbox",
        file: "lib/growth/prospect-search/prospect-search-push-to-inbox.ts",
        condition: "createLeadCandidate → duplicate / existing_lead_match",
        returnPath: 'outcome: "already_exists"',
        stoppingReason: "Lead already exists in Revenue Queue — duplicate promotion correctly withheld",
      },
      notes: `Existing lead ${lead.id}`,
    }
  }

  if (!isFirstCanonicalInstance) {
    return {
      classification: "duplicate_company",
      promotionCorrect: true,
      leadStatus: "not_promoted",
      decisionTrace: {
        function: "loadPortfolioIntakeSurvivorsFromProduction",
        file: "lib/growth/training/portfolio-intake-survivor-loader-1d.ts",
        condition: "canonicalCompanyKey seen in prior completed discovery run",
        returnPath: "Rediscovery instance — no second promotion attempted",
        stoppingReason: "Same company rediscovered across autonomous runs — correctly not re-promoted",
      },
      notes: `Prior run ${input.canonicalFirstSeenRunId}`,
    }
  }

  if (!runHadAnyPromotion) {
    if (input.runIntakeCompleted) {
      if (survivor.runRank > (survivor.batchSizeAtRun ?? 25)) {
        return {
          classification: "waiting_for_batch_promotion",
          promotionCorrect: true,
          leadStatus: "not_promoted",
          decisionTrace: BATCH_RANK_CUTOFF_TRACE,
          notes: `Rank ${survivor.runRank} > batchSize ${survivor.batchSizeAtRun}`,
        }
      }
      return {
        classification: "bug",
        promotionCorrect: false,
        leadStatus: "not_promoted",
        decisionTrace: {
          function: "runAutonomousPortfolioDiscoveryBatch",
          file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
          condition: "intake_completed === true but survivor not promoted",
          returnPath: "markAutonomousRunIntakeCompleted without matching lead disposition",
          stoppingReason: "Run terminalized but survivor lacks lead — post-intake gap",
        },
        notes: `Run ${survivor.runId} intake_completed with ${survivor.runSurvivorCount} survivor(s)`,
      }
    }

    if (input.runEligibleForIntakePromotion) {
      return {
        classification: "waiting_for_scheduler",
        promotionCorrect: true,
        leadStatus: "not_promoted",
        decisionTrace: INTAKE_PENDING_RESUME_TRACE,
        notes: `Run ${survivor.runId} eligible for intake resume — ${survivor.runSurvivorCount} survivor(s)`,
      }
    }

    return {
      classification: "bug",
      promotionCorrect: false,
      leadStatus: "not_promoted",
      decisionTrace: COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
      notes: `Run ${survivor.runId} completed with ${survivor.runSurvivorCount} survivor(s) — zero promotions recorded`,
    }
  }

  if (survivor.runRank > (survivor.batchSizeAtRun ?? 25)) {
    return {
      classification: "waiting_for_batch_promotion",
      promotionCorrect: true,
      leadStatus: "not_promoted",
      decisionTrace: BATCH_RANK_CUTOFF_TRACE,
      notes: `Rank ${survivor.runRank} > batchSize ${survivor.batchSizeAtRun}`,
    }
  }

  return {
    classification: "bug",
    promotionCorrect: false,
    leadStatus: "not_promoted",
    decisionTrace: {
      function: "runAutonomousPortfolioDiscoveryBatch",
      file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
      condition: "runRank <= batchSize but survivor not in executeBulkPushToLeadInbox items",
      returnPath: "push skipped despite eligible rank — intake gap within promoted run",
      stoppingReason: "Survivor within batch window but not pushed — requires intake trace follow-up",
    },
    notes: `Run had partial promotion; rank ${survivor.runRank}/${survivor.runSurvivorCount}`,
  }
}

export async function runPortfolioIntakeProductionAudit(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt?: string
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const [survivorLoad, admissionContext, killSwitches] = await Promise.all([
    loadPortfolioIntakeSurvivorsFromProduction(input),
    loadGrowthLeadAdmissionContext(input.admin, input.organizationId),
    getRuntimeKillSwitchStates(input.admin),
  ])

  const { data: leadRows } = await input.admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, contact_email, website, status, metadata, source_channel, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .not("status", "in", '("archived","converted")')
    .order("created_at", { ascending: false })

  const orgLeads: OrgLeadRow[] = []
  for (const row of leadRows ?? []) {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    if (
      !isLeadInPortfolioOrganizationScope(
        { id: row.id, status: row.status, metadata },
        input.organizationId,
      )
    ) {
      continue
    }
    const lead: OrgLeadRow = {
      id: row.id,
      company_name: row.company_name,
      website: row.website,
      status: row.status,
      metadata,
      latest_prospect_research_run_id: row.latest_prospect_research_run_id,
      last_prospect_researched_at: row.last_prospect_researched_at,
      sourceIds: [],
      dedupeHashes: [],
      domains: [],
    }
    extractLeadIndexes(lead)
    orgLeads.push(lead)
  }

  const leadIndex = buildLeadMatchIndex(orgLeads)
  const runsWithPromotion = new Set<string>()
  for (const survivor of survivorLoad.survivors) {
    const lead = resolveLeadForSurvivor(survivor, leadIndex)
    if (
      lead &&
      (lead.sourceIds.includes(survivor.canonicalCompanyKey) ||
        lead.dedupeHashes.includes(survivor.dedupeHash))
    ) {
      runsWithPromotion.add(survivor.runId)
    }
  }

  const canonicalFirstRun = new Map<string, string>()
  for (const survivor of survivorLoad.survivors) {
    if (!canonicalFirstRun.has(survivor.canonicalCompanyKey)) {
      canonicalFirstRun.set(survivor.canonicalCompanyKey, survivor.runId)
    }
  }

  const firstInstanceByCanonical = new Map<string, string>()
  for (const survivor of survivorLoad.survivors) {
    if (!firstInstanceByCanonical.has(survivor.canonicalCompanyKey)) {
      firstInstanceByCanonical.set(survivor.canonicalCompanyKey, survivor.survivorKey)
    }
  }

  const inventory: PortfolioIntakeSurvivorInventoryRow[] = []
  for (const survivor of survivorLoad.survivors) {
    const lead = resolveLeadForSurvivor(survivor, leadIndex)
    let admissionStatus: string | null = null
    if (lead) {
      const intake = buildGrowthLeadAdmissionIntakeFromLead({
        id: lead.id,
        company_name: lead.company_name,
        contact_name: null,
        contact_email: null,
        website: lead.website,
        status: lead.status,
        metadata: lead.metadata,
        latest_prospect_research_run_id: lead.latest_prospect_research_run_id,
        last_prospect_researched_at: lead.last_prospect_researched_at,
      })
      admissionStatus = evaluateGrowthLeadAdmission(intake, admissionContext).state
    }

    const isFirstCanonicalInstance =
      firstInstanceByCanonical.get(survivor.canonicalCompanyKey) === survivor.survivorKey

    const classified = classifySurvivor({
      survivor,
      lead,
      admissionStatus,
      canonicalFirstSeenRunId: canonicalFirstRun.get(survivor.canonicalCompanyKey) ?? null,
      runHadAnyPromotion: runsWithPromotion.has(survivor.runId),
      isFirstCanonicalInstance,
      runEligibleForIntakePromotion: survivor.runEligibleForIntakePromotion,
      runIntakeCompleted: survivor.runIntake.intake_completed === true,
    })

    inventory.push({
      survivorKey: survivor.survivorKey,
      canonicalCompanyKey: survivor.canonicalCompanyKey,
      company: survivor.company.company_name ?? survivor.canonicalCompanyKey,
      website: survivor.company.website ?? null,
      runId: survivor.runId,
      audienceId: survivor.audienceId,
      discoveryDate: survivor.discoveryDate,
      score: survivor.company.rank_score ?? survivor.company.confidence ?? 0,
      runRank: survivor.runRank,
      runSurvivorCount: survivor.runSurvivorCount,
      batchSizeAtRun: survivor.batchSizeAtRun,
      researchStatus: resolveResearchStatus(lead),
      leadStatus: classified.leadStatus,
      leadId: lead?.id ?? null,
      admissionStatus,
      classification: classified.classification,
      promotionCorrect: classified.promotionCorrect,
      decisionTrace: classified.decisionTrace,
      notes: classified.notes,
    })
  }

  const classificationSummary = buildClassificationSummary(inventory)
  const classificationCheck = assertAllNonPromotedClassified(inventory)
  const { correctlyNotPromoted, incorrectlyNotPromoted } = splitPromotionCorrectness(inventory)
  const promotedCount = inventory.filter((row) => row.leadStatus === "promoted").length
  const nonPromotedCount = inventory.filter((row) => row.leadStatus === "not_promoted").length
  const bugCount = incorrectlyNotPromoted.filter((row) => row.classification === "bug").length

  let packagesReady = 0
  let outreachEligible = 0
  let researchStarted = 0
  for (const lead of orgLeads) {
    if (lead.latest_prospect_research_run_id || lead.last_prospect_researched_at) {
      researchStarted += 1
    }
    const intake = buildGrowthLeadAdmissionIntakeFromLead({
      id: lead.id,
      company_name: lead.company_name,
      contact_name: null,
      contact_email: null,
      website: lead.website,
      status: lead.status,
      metadata: lead.metadata,
      latest_prospect_research_run_id: lead.latest_prospect_research_run_id,
      last_prospect_researched_at: lead.last_prospect_researched_at,
    })
    const evaluation = evaluateGrowthLeadAdmission(intake, admissionContext)
    const stored = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (evaluation.state === "accepted" && stored !== "rejected") {
      outreachEligible += 1
    }
    const runs = await listOutreachPreparationRunsForLead(
      input.admin,
      input.organizationId,
      lead.id,
    ).catch(() => [])
    if (runs.some((row) => row.approvalPackage?.pendingHumanApproval)) {
      packagesReady += 1
    }
  }

  const throughputProjection = projectIntakeThroughputFromEvidence({
    uniqueCanonicalSurvivors: survivorLoad.uniqueCanonicalSurvivors,
    promotedLeads: orgLeads.length,
    incorrectlyNotPromoted: incorrectlyNotPromoted.length,
    currentResearchStarted: researchStarted,
    currentOutreachEligible: outreachEligible,
    currentPackagesReady: packagesReady,
    incorrectBugCount: bugCount,
  })

  const survivorLinkedLeadIds = new Set(
    inventory.filter((row) => row.leadStatus === "promoted").map((row) => row.leadId).filter(Boolean),
  )
  const existingLeadsOutsideSurvivorInventory = orgLeads
    .filter((lead) => !survivorLinkedLeadIds.has(lead.id))
    .map((lead) => ({
      leadId: lead.id,
      company: lead.company_name,
      website: lead.website,
      sourceChannel:
        typeof lead.metadata.source_channel === "string" ? lead.metadata.source_channel : null,
      prospectSearchSourceId:
        lead.sourceIds[0] ??
        (lead.metadata.prospect_search &&
        typeof lead.metadata.prospect_search === "object" &&
        typeof (lead.metadata.prospect_search as { source_id?: unknown }).source_id === "string"
          ? (lead.metadata.prospect_search as { source_id: string }).source_id
          : null),
      note: "Org lead not matched to audited survivor inventory — separate intake path from current autonomous run replay",
    }))

  const rootCauses = [
    ...(bugCount > 0
      ? [
          {
            id: "completed_run_orphan_intake",
            severity: "high" as const,
            description:
              "Completed DataMoon discovery runs lack durable intake resume or terminal disposition",
            productionEvidence: `${bugCount} survivor instance(s) without eligible intake resume path`,
            smallestFix:
              "Ensure findLatestIntakePendingAutonomousProspectSearchDatamoonRun resumes before start_new (GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F)",
            file: "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
          },
        ]
      : []),
  ]

  return {
    qaMarker: GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt,
    outboundKillSwitchEnabled: killSwitches.autonomy_outbound_enabled === true,
    survivorStats: {
      cumulativeInstances: survivorLoad.cumulativeSurvivorInstances,
      uniqueCanonical: survivorLoad.uniqueCanonicalSurvivors,
      completedRuns: survivorLoad.completedRunCount,
      runsWithPromotion: runsWithPromotion.size,
      runsOrphaned: survivorLoad.completedRunCount - runsWithPromotion.size,
      promotedInstances: promotedCount,
      nonPromotedInstances: nonPromotedCount,
    },
    inventory,
    classificationSummary,
    classificationCheck,
    correctlyNotPromoted: correctlyNotPromoted.length,
    incorrectlyNotPromoted: incorrectlyNotPromoted.length,
    incorrectlyNotPromotedSamples: incorrectlyNotPromoted.slice(0, 10),
    rootCauses,
    throughputProjection,
    existingLeadsOutsideSurvivorInventory,
    architectureAudit: {
      businessProfileChanged: false,
      ssvChanged: false,
      omtChanged: false,
      providerBridgeChanged: false,
      prospectSearchChanged: false,
      operationalKeywordValidationChanged: false,
      admissionChanged: false,
      sellerTruthChanged: false,
      icpWeakened: false,
      note: "Audit-only milestone — canonical gates unchanged",
    },
    decisionTraceReferences: [
      COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
      INTAKE_PENDING_RESUME_TRACE,
      BUILDING_RUN_DEFERRED_PUSH_TRACE,
      BATCH_RANK_CUTOFF_TRACE,
      REPLENISHMENT_SKIP_TRACE,
    ],
    recommendedNextMilestone:
      bugCount > 0
        ? "GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F (verify intake resume on production tick)"
        : "GE-AIOS-FIRST-CUSTOMER-PIPELINE-SCALING-1C (re-probe after intake fix)",
  }
}

export {
  COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
  BUILDING_RUN_DEFERRED_PUSH_TRACE,
} from "@/lib/growth/training/portfolio-intake-survivor-classification-1d"
