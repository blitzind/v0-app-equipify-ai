/**
 * GE-AIOS-OPERATOR-PACKAGE-1A — Production operator package validation (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { advanceDraftFactoryForLeadLive } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  evaluateOutreachPreparationPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  findAutonomousOutreachPreparationRunByPackageId,
  listOutreachPreparationRunsForLead,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { recoverAutonomousOutreachApprovalPackagePayload } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  evaluateResourceAllocationFacade,
  authorizeSpendForInvestmentState,
  costTierForResource,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { projectSupervisedSalesOperatorPackage } from "@/lib/growth/training/supervised-sales-operator-package-projection-1b"
import { loadApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-service"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export const GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER =
  "ge-aios-operator-package-1a-v1" as const

export const CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR =
  "CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR" as const

const OUTREACH_READY_ACTIONS = new Set([
  "call_prospect",
  "enroll_sequence",
  "schedule_demo",
  "follow_up",
  "call prospect",
  "enroll sequence",
  "schedule demo",
  "follow up",
  "call_decision_maker",
  "call_immediately",
  "call_now",
  "call_primary_contact",
  "immediate_sales_action",
])

export type OperatorPackageLeadTrace = {
  leadId: string
  companyName: string | null
  readyForOutreachReview: boolean
  admissionState: string | null
  workflowStatus: string | null
  nextBestAction: string | null
  decisionMakerStatus: string | null
  primaryDecisionMakerId: string | null
  contactEmail: string | null
  emailDraftingInvestment: {
    investmentState: string
    spendAuthorized: boolean
    reason: string
    billableAuthorized: boolean
  }
  outreachPolicyGate: ReturnType<typeof evaluateOutreachPreparationPilotAutonomyPolicyGate>
  draftFactoryBefore: {
    state: string | null
    packageId: string | null
    pausedReason: string | null
  }
  draftFactoryAdvance: {
    outcome: string | null
    nextState: string | null
    reason: string | null
    packageId: string | null
    stageEvaluated: string | null
  } | null
  existingPackageId: string | null
  persistedPackageBody: boolean
  orphanPackagePointer: boolean
  firstBlocker: string | null
  blockerCategory: "configuration" | "policy" | "runtime_bug" | "missing_data" | "draft_factory_state" | "safeguard" | null
}

export type OperatorPackageValidationReport = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER
  organizationId: string
  outboundEnabled: boolean
  autonomyEnabled: boolean
  outreachAutonomyEnabled: boolean
  traces: OperatorPackageLeadTrace[]
  readyLeadCount: number
  packagesBefore: number
  packagesAfter: number
  newPackageIds: string[]
  samplePackage: {
    packageId: string
    leadId: string
    preparationRunId: string | null
    draftAssetChannels: string[]
    operatorApprovalVisible: boolean
    hasQualificationRationale: boolean
    hasResearchEvidence: boolean
    hasOutreachDraft: boolean
    executiveSummary: string | null
  } | null
  repairApplied: boolean
  repairDescription: string | null
  executiveVerdict: "PASS" | "PASS WITH LIMITATIONS" | "FAIL"
  verdictReasons: string[]
  firstRemainingBlocker: string | null
  recommendedNextAction: string
}

function isReadyForOutreachReview(input: {
  nextBestAction: string | null
  prospectRecommendedNextAction: string | null
  workflowStatus: string | null
  score: number | null
  workflowHealth: string | null
}): boolean {
  const status = input.workflowStatus
  if (status === "assessed" || status === "qualified") return true
  const nba = `${input.nextBestAction ?? ""} ${input.prospectRecommendedNextAction ?? ""}`.toLowerCase()
  if ([...OUTREACH_READY_ACTIONS].some((action) => nba.includes(action))) return true
  if ((input.score ?? 0) >= 70 && input.workflowHealth === "healthy") return true
  return false
}

async function readDraftFactoryState(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<OperatorPackageLeadTrace["draftFactoryBefore"]> {
  const { data } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, package_id, paused_reason")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle()
  return {
    state: data?.state ?? null,
    packageId: data?.package_id ?? null,
    pausedReason: data?.paused_reason ?? null,
  }
}

async function countPersistedPackages(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .not("approval_package", "is", null)
  return count ?? 0
}

async function loadPersistedPackageBody(
  admin: SupabaseClient,
  organizationId: string,
  packageId: string | null,
): Promise<Record<string, unknown> | null> {
  if (!packageId) return null
  const run = await findAutonomousOutreachPreparationRunByPackageId(admin, organizationId, packageId).catch(
    () => null,
  )
  const body = run?.approvalPackage
  if (!body || body.packageId !== packageId) return null
  if ((body.generatedAssets?.length ?? 0) === 0) return null
  return body as unknown as Record<string, unknown>
}

function classifyBlocker(input: {
  outreachGate: ReturnType<typeof evaluateOutreachPreparationPilotAutonomyPolicyGate>
  emailDrafting: OperatorPackageLeadTrace["emailDraftingInvestment"]
  advance: OperatorPackageLeadTrace["draftFactoryAdvance"]
  admissionState: string | null
  orphanPackagePointer: boolean
  persistedPackageBody: boolean
}): { firstBlocker: string | null; category: OperatorPackageLeadTrace["blockerCategory"] } {
  if (input.orphanPackagePointer) {
    return {
      firstBlocker: "draft_factory_package_id_without_autonomous_outreach_preparation_run_body",
      category: "runtime_bug",
    }
  }
  if (input.persistedPackageBody) {
    return { firstBlocker: null, category: null }
  }
  if (!input.outreachGate.allowed) {
    return {
      firstBlocker: input.outreachGate.policyKey ?? input.outreachGate.blockReason,
      category: "policy",
    }
  }
  if (input.emailDrafting.investmentState === "stop_investment") {
    return { firstBlocker: `stop_investment:${input.emailDrafting.reason}`, category: "policy" }
  }
  if (!input.emailDrafting.billableAuthorized && input.admissionState === "review") {
    return {
      firstBlocker: "pending_investment_blocks_billable_email_drafting_for_review_admission",
      category: "policy",
    }
  }
  if (!input.emailDrafting.billableAuthorized) {
    return {
      firstBlocker: `billable_email_drafting_not_authorized:${input.emailDrafting.investmentState}`,
      category: "policy",
    }
  }
  if (input.advance?.outcome === "stopped") {
    return { firstBlocker: input.advance.reason ?? "draft_factory_stop_investment", category: "draft_factory_state" }
  }
  if (input.advance?.outcome && !input.advance.packageId && input.advance.outcome !== "completed") {
    return { firstBlocker: input.advance.reason ?? input.advance.outcome, category: "draft_factory_state" }
  }
  return { firstBlocker: null, category: null }
}

export async function traceOperatorPackageLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    evaluationContext: Awaited<ReturnType<typeof fetchGrowthAiOsAutonomyPolicyEvaluationContext>>
    attemptAdvance?: boolean
    generatedAt?: string
  },
): Promise<OperatorPackageLeadTrace> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  }).catch(() => null)
  const admissionState = resolveLeadAdmissionStateFromMetadata(lead?.metadata)
  const resource = evaluateResourceAllocationFacade({
    organizationId: input.organizationId,
    accountId: input.leadId,
    resourceClass: "email_drafting",
    signals: buildResourceAllocationSignalsFromLead(lead ?? { metadata: {} }, {
      approvalRequired: true,
      approvalGranted: false,
      budgetAvailable: true,
    }),
  })
  const billableAuthorized = authorizeSpendForInvestmentState(
    resource.investment_state,
    costTierForResource("email_drafting"),
  )
  const outreachPolicyGate = evaluateOutreachPreparationPilotAutonomyPolicyGate(input.evaluationContext)
  const draftFactoryBefore = await readDraftFactoryState(admin, input.organizationId, input.leadId)
  const existingRuns = await listOutreachPreparationRunsForLead(admin, input.leadId).catch(() => [])
  const existingPackageId =
    draftFactoryBefore.packageId ??
    existingRuns.find((row) => row.approvalPackage?.packageId)?.approvalPackage?.packageId ??
    null
  const persistedBody = await loadPersistedPackageBody(admin, input.organizationId, existingPackageId)
  const persistedPackageBody = persistedBody != null
  const orphanPackagePointer = Boolean(existingPackageId && !persistedPackageBody)

  let draftFactoryAdvance: OperatorPackageLeadTrace["draftFactoryAdvance"] = null
  if (input.attemptAdvance) {
    const advance = await advanceDraftFactoryForLeadLive(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      wake: { type: "outreach_preparation_wake", sourceId: `operator-package-1a:${generatedAt}` },
      portfolioSelected: true,
      allowGeneration: true,
      now: generatedAt,
    })
    draftFactoryAdvance = {
      outcome: advance.outcome,
      nextState: advance.nextState,
      reason: advance.reason,
      packageId: advance.packageId,
      stageEvaluated: advance.stageEvaluated,
    }
  }

  const readyForOutreachReview = lead
    ? isReadyForOutreachReview({
        nextBestAction: lead.nextBestAction ?? null,
        prospectRecommendedNextAction: lead.prospectRecommendedNextAction ?? null,
        workflowStatus: snapshot?.workflowStatus ?? null,
        score: lead.score ?? null,
        workflowHealth: lead.workflowHealth ?? null,
      })
    : false

  const { firstBlocker, category } = classifyBlocker({
    outreachGate: outreachPolicyGate,
    emailDrafting: {
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      reason: resource.reason,
      billableAuthorized,
    },
    advance: draftFactoryAdvance,
    admissionState,
    orphanPackagePointer,
    persistedPackageBody,
  })

  return {
    leadId: input.leadId,
    companyName: lead?.companyName ?? null,
    readyForOutreachReview,
    admissionState,
    workflowStatus: snapshot?.workflowStatus ?? null,
    nextBestAction: lead?.nextBestAction ?? null,
    decisionMakerStatus: lead?.decisionMakerStatus ?? null,
    primaryDecisionMakerId: lead?.primaryDecisionMakerId ?? null,
    contactEmail: lead?.contactEmail ?? null,
    emailDraftingInvestment: {
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
      reason: resource.reason,
      billableAuthorized,
    },
    outreachPolicyGate,
    draftFactoryBefore,
    draftFactoryAdvance,
    existingPackageId,
    persistedPackageBody,
    orphanPackagePointer,
    firstBlocker,
    blockerCategory: category,
  }
}

export async function recoverOrphanOperatorPackagePointers(
  admin: SupabaseClient,
  input: {
    organizationId: string
    traces: OperatorPackageLeadTrace[]
  },
): Promise<{ recovered: string[]; failures: Array<{ packageId: string; reason: string }> }> {
  const recovered: string[] = []
  const failures: Array<{ packageId: string; reason: string }> = []

  for (const trace of input.traces) {
    if (!trace.orphanPackagePointer || !trace.existingPackageId) continue
    const result = await recoverAutonomousOutreachApprovalPackagePayload(admin, {
      organizationId: input.organizationId,
      packageId: trace.existingPackageId,
      wakeCondition: "execution_completed",
    }).catch((error) => {
      failures.push({
        packageId: trace.existingPackageId!,
        reason: error instanceof Error ? error.message : String(error),
      })
      return null
    })
    if (result?.approvalPackage?.packageId) {
      recovered.push(result.packageId)
    } else if (!failures.some((row) => row.packageId === trace.existingPackageId)) {
      failures.push({
        packageId: trace.existingPackageId,
        reason: "recovery_returned_null",
      })
    }
  }

  return { recovered, failures }
}

export async function applyOperatorPackageAutonomyRepair(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ applied: boolean; description: string | null }> {
  const { upsertGrowthAutonomySettings, fetchGrowthAutonomySettings } = await import(
    "@/lib/growth/autonomy/growth-autonomy-settings-repository"
  )
  const current = await fetchGrowthAutonomySettings(admin, organizationId)
  const toggles = { ...current.capabilityToggles }
  let changed = false

  if (current.masterMode !== "objective") {
    changed = true
  }
  if (!toggles.page_generation) {
    toggles.page_generation = true
    changed = true
  }
  if (!toggles.recommendations) {
    toggles.recommendations = true
    changed = true
  }
  // Preparation-only: enable email_execution capability for outreach_agent policy gate.
  // Outbound transport remains kill-switched off separately.
  if (!toggles.email_execution) {
    toggles.email_execution = true
    changed = true
  }

  if (!changed) {
    return { applied: false, description: null }
  }

  await upsertGrowthAutonomySettings(admin, organizationId, {
    masterMode: "objective",
    capabilityToggles: toggles,
  })

  return {
    applied: true,
    description:
      "Enabled objective mode plus page_generation, recommendations, and email_execution capabilities for outreach preparation (transport remains kill-switched).",
  }
}

export async function runOperatorPackageProductionValidation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    applyRepair?: boolean
    attemptAdvance?: boolean
    leadIds?: string[]
  },
): Promise<OperatorPackageValidationReport> {
  const kill = await getRuntimeKillSwitchStates(admin)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
  })

  let repairApplied = false
  let repairDescription: string | null = null
  if (input.applyRepair) {
    const repair = await applyOperatorPackageAutonomyRepair(admin, input.organizationId)
    repairApplied = repair.applied
    repairDescription = repair.description
    if (repairApplied) {
      evaluationContext.policy = (
        await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
          organizationId: input.organizationId,
        })
      ).policy
    }
  }

  const packagesBefore = await countPersistedPackages(admin, input.organizationId)

  const defaultLeadIds = [
    "6d9220f0-2960-468c-b4be-5d7595d292c3",
    "5f2cee9f-cb6a-4044-b093-fbe37292423e",
    "cc6fdfb2-3f21-444f-aaf6-78e45481d7f9",
  ]
  const leadIds = input.leadIds ?? defaultLeadIds

  const traces: OperatorPackageLeadTrace[] = []
  for (const leadId of leadIds) {
    traces.push(
      await traceOperatorPackageLead(admin, {
        organizationId: input.organizationId,
        leadId,
        evaluationContext,
        attemptAdvance: input.attemptAdvance ?? true,
      }),
    )
  }

  let orphanRecovery: { recovered: string[]; failures: Array<{ packageId: string; reason: string }> } | null =
    null
  if (input.applyRepair) {
    orphanRecovery = await recoverOrphanOperatorPackagePointers(admin, {
      organizationId: input.organizationId,
      traces,
    })
    if (orphanRecovery.recovered.length > 0) {
      repairApplied = true
      repairDescription = [
        repairDescription,
        `Recovered ${orphanRecovery.recovered.length} orphan package pointer(s) into autonomous_outreach_preparation_runs.`,
      ]
        .filter(Boolean)
        .join(" ")
    }
  }

  const packagesAfter = await countPersistedPackages(admin, input.organizationId)
  const { data: packageRows } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("id, lead_id, package_id, approval_package, completed_at")
    .eq("organization_id", input.organizationId)
    .not("approval_package", "is", null)
    .order("completed_at", { ascending: false })
    .limit(5)

  const readyTraces = traces.filter((row) => row.readyForOutreachReview)

  const newPackageIds = [
    ...(orphanRecovery?.recovered ?? []),
    ...readyTraces
      .filter((row) => row.persistedPackageBody && row.existingPackageId)
      .map((row) => row.existingPackageId as string),
  ]

  let samplePackage: OperatorPackageValidationReport["samplePackage"] = null
  const focusTrace =
    readyTraces.find((row) => row.persistedPackageBody && row.existingPackageId) ??
    readyTraces.find((row) => row.existingPackageId) ??
    readyTraces[0] ??
    null

  if (focusTrace?.existingPackageId) {
    const body = await loadPersistedPackageBody(admin, input.organizationId, focusTrace.existingPackageId)
    if (body) {
      const pkg = body as unknown as GrowthAutonomousOutreachApprovalPackage
      const run = await findAutonomousOutreachPreparationRunByPackageId(
        admin,
        input.organizationId,
        focusTrace.existingPackageId,
      ).catch(() => null)
      const approvalPacket = await loadApprovals2AOperatorReviewPacket(admin, {
        organizationId: input.organizationId,
        packageId: focusTrace.existingPackageId,
        leadId: focusTrace.leadId,
      }).catch(() => null)
      const projected = projectSupervisedSalesOperatorPackage({ pkg })
      samplePackage = {
        packageId: focusTrace.existingPackageId,
        leadId: focusTrace.leadId,
        preparationRunId: run?.runId ?? null,
        draftAssetChannels: pkg.generatedAssets.map((asset) => asset.channel),
        operatorApprovalVisible: approvalPacket != null && approvalPacket.packageId === focusTrace.existingPackageId,
        hasQualificationRationale: projected.whyBuy.length > 20 || projected.approvalSummary.length > 0,
        hasResearchEvidence:
          projected.painPoints.length > 0 ||
          projected.operations.length > 0 ||
          ((body as { supportingResearch?: unknown[] }).supportingResearch?.length ?? 0) > 0,
        hasOutreachDraft: Boolean(projected.outreach.email || projected.outreach.linkedIn),
        executiveSummary: projected.executiveSummary.slice(0, 240),
      }
    }
  }

  const firstRemainingBlocker =
    readyTraces.find((row) => row.firstBlocker && !row.persistedPackageBody)?.firstBlocker ??
    readyTraces.find((row) => row.firstBlocker)?.firstBlocker ??
    null

  const verdictReasons: string[] = []
  if (kill.autonomy_outbound_enabled) verdictReasons.push("Outbound kill switch ON")
  const readyWithCompletePackage = readyTraces.filter((row) => row.persistedPackageBody).length
  if (readyWithCompletePackage === 0) verdictReasons.push("No ready lead has a persisted operator package body")
  if (input.applyRepair && packagesAfter <= packagesBefore && readyWithCompletePackage === 0) {
    verdictReasons.push("No new operator packages persisted after repair")
  }
  if (samplePackage && !samplePackage.hasOutreachDraft) {
    verdictReasons.push("Package missing outreach draft content")
  }

  let executiveVerdict: OperatorPackageValidationReport["executiveVerdict"] = "FAIL"
  if (
    !kill.autonomy_outbound_enabled &&
    readyWithCompletePackage > 0 &&
    samplePackage?.hasQualificationRationale &&
    samplePackage.hasResearchEvidence &&
    samplePackage.hasOutreachDraft &&
    samplePackage.operatorApprovalVisible
  ) {
    executiveVerdict =
      firstRemainingBlocker && readyTraces.some((row) => !row.persistedPackageBody)
        ? "PASS WITH LIMITATIONS"
        : "PASS"
  } else if (readyWithCompletePackage > 0) {
    executiveVerdict = "PASS WITH LIMITATIONS"
  }

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER,
    organizationId: input.organizationId,
    outboundEnabled: kill.autonomy_outbound_enabled,
    autonomyEnabled: kill.autonomy_enabled,
    outreachAutonomyEnabled: evaluationContext.policy.outreachAutonomyEnabled,
    traces,
    readyLeadCount: readyTraces.length,
    packagesBefore,
    packagesAfter,
    newPackageIds,
    samplePackage,
    repairApplied,
    repairDescription,
    executiveVerdict,
    verdictReasons,
    firstRemainingBlocker,
    recommendedNextAction:
      executiveVerdict === "PASS"
        ? "Operator packages visible for approval — proceed to supervised send validation when authorized."
        : firstRemainingBlocker?.includes("pending_investment")
          ? "Reconcile review admission to accepted for keyword-validated leads, or authorize supervised prep for qualified review cohort."
          : "Apply outreach preparation autonomy repair and rerun draft factory advance.",
  }
}
