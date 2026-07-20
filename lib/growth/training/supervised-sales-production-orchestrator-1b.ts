/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Production supervised sales orchestrator (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import {
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { classifyGrowthLeadAdmissionDrift } from "@/lib/growth/revenue-workflow/growth-lead-admission-drift"
import { loadSuppressedLeadIds } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"
import { auditSupervisedSalesRuntimeComponents } from "@/lib/growth/training/supervised-sales-workflow-readiness-audit-1b"
import {
  auditSupervisedSalesApprovalWorkflow,
  deriveSupervisedSalesBlockers,
} from "@/lib/growth/training/supervised-sales-approval-workflow-audit-1b"
import {
  rankSupervisedSalesLeadCandidates,
  type SupervisedSalesLeadSelectionInput,
} from "@/lib/growth/training/supervised-sales-production-lead-selection-1b"
import { projectSupervisedSalesOperatorPackage } from "@/lib/growth/training/supervised-sales-operator-package-projection-1b"
import { scoreSupervisedSalesWorkflow } from "@/lib/growth/training/supervised-sales-workflow-scoring-1b"
import {
  GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER,
  type SupervisedSalesProductionReport,
} from "@/lib/growth/training/supervised-sales-workflow-1b-types"

export async function runSupervisedSalesProductionEvaluation(input: {
  admin: SupabaseClient
  organizationId: string
  leadLimit?: number
  packageLimit?: number
  generatedAt?: string
}): Promise<SupervisedSalesProductionReport> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const runtimeAudit = auditSupervisedSalesRuntimeComponents()
  const killSwitches = await getRuntimeKillSwitchStates(input.admin)
  const outboundKillSwitchEnabled = killSwitches.autonomy_outbound_enabled === true

  const [admissionPool, approvedProfile, admissionContext, suppressedLeadIds] = await Promise.all([
    analyzeGrowthLeadAdmissionProductionPool({
      admin: input.admin,
      organizationId: input.organizationId,
      limit: input.leadLimit ?? 500,
    }),
    getActiveApprovedBusinessProfile(input.admin, input.organizationId),
    loadGrowthLeadAdmissionContext(input.admin, input.organizationId),
    loadSuppressedLeadIds(input.admin),
  ])

  const sellerKnowledgeReady = isCanonicalSellerKnowledgeEnriched(approvedProfile?.profile)

  const { data: leadRows, error } = await input.admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, contact_email, website, status, metadata, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .not("status", "in", '("archived","converted")')
    .order("last_prospect_researched_at", { ascending: false, nullsFirst: false })
    .limit(input.leadLimit ?? 500)

  if (error) throw new Error(error.message)

  const selectionInputs: SupervisedSalesLeadSelectionInput[] = []

  for (const row of leadRows ?? []) {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    const intake = buildGrowthLeadAdmissionIntakeFromLead({
      id: row.id,
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      website: row.website,
      status: row.status,
      metadata,
      latest_prospect_research_run_id: row.latest_prospect_research_run_id,
      last_prospect_researched_at: row.last_prospect_researched_at,
    })
    const evaluation = evaluateGrowthLeadAdmission(intake, admissionContext)
    const storedState = resolveLeadAdmissionStateFromMetadata(metadata)
    const suppressed = suppressedLeadIds.has(row.id)
    const drift = classifyGrowthLeadAdmissionDrift({
      storedState,
      evaluation,
      currentWebsite: row.website,
      currentCompanyName: row.company_name,
      status: row.status,
      suppressed,
    })

    let evidenceCount = 0
    let researchConfidence: number | null = null
    if (row.latest_prospect_research_run_id) {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(input.admin, {
        organizationId: input.organizationId,
        leadId: row.id,
      }).catch(() => null)
      evidenceCount = snapshot?.evidenceSummary?.verifiedEvidence?.length ?? 0
      researchConfidence =
        snapshot?.qualification?.confidence ??
        snapshot?.opportunityAssessment?.confidence ??
        null
    }

    const decisionMakers = row.latest_prospect_research_run_id
      ? await listGrowthLeadDecisionMakers(input.admin, row.id).catch(() => [])
      : []

    const runs = await listOutreachPreparationRunsForLead(input.admin, input.organizationId, row.id).catch(
      () => [],
    )
    const pendingRun = runs.find(
      (run) =>
        run.approvalPackage?.pendingHumanApproval === true &&
        run.approvalPackage.transportBlocked === true,
    )

    selectionInputs.push({
      leadId: row.id,
      companyName: row.company_name,
      admissionState: evaluation.state,
      outreachEligible: drift.outreachEligibility,
      hasResearch: Boolean(row.latest_prospect_research_run_id || row.last_prospect_researched_at),
      researchRunId: row.latest_prospect_research_run_id,
      lastResearchedAt: row.last_prospect_researched_at,
      contactName: row.contact_name,
      industry:
        typeof metadata.industry === "string"
          ? metadata.industry
          : typeof metadata.primary_industry === "string"
            ? metadata.primary_industry
            : null,
      website: row.website,
      evidenceCount,
      researchConfidence,
      hasDecisionMaker: decisionMakers.length > 0,
      hasExistingPackage: Boolean(pendingRun?.approvalPackage),
      sellerKnowledgeReady,
    })

    if (pendingRun?.approvalPackage?.packageId) {
      const rankedIndex = selectionInputs.length - 1
      selectionInputs[rankedIndex] = {
        ...selectionInputs[rankedIndex],
        hasExistingPackage: true,
      }
    }
  }

  const selectedLeads = rankSupervisedSalesLeadCandidates(selectionInputs, input.packageLimit ?? 3)

  for (const lead of selectedLeads) {
    const runs = await listOutreachPreparationRunsForLead(
      input.admin,
      input.organizationId,
      lead.leadId,
    ).catch(() => [])
    const pending = runs.find((run) => run.approvalPackage?.pendingHumanApproval)
    lead.existingPackageId = pending?.approvalPackage?.packageId ?? null
  }

  const packages: SupervisedSalesProductionReport["packages"] = []

  for (const lead of selectedLeads) {
    let approvalPackage =
      (
        await listOutreachPreparationRunsForLead(input.admin, input.organizationId, lead.leadId).catch(
          () => [],
        )
      ).find((run) => run.approvalPackage?.pendingHumanApproval)?.approvalPackage ?? null

    let source: "existing" | "preview_generated" = "existing"

    if (!approvalPackage) {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(input.admin, {
        organizationId: input.organizationId,
        leadId: lead.leadId,
      })
      if (!snapshot) continue
      const leadRecord = await fetchGrowthLeadById(input.admin, lead.leadId)
      approvalPackage = await buildAutonomousOutreachApprovalPackage(input.admin, {
        organizationId: input.organizationId,
        leadId: lead.leadId,
        companyName: leadRecord?.companyName ?? lead.companyName,
        snapshot,
        generatedAt,
        buildMode: "preview_only",
      })
      source = "preview_generated"
    }

    packages.push({
      leadId: lead.leadId,
      companyName: lead.companyName,
      packageId: approvalPackage.packageId,
      source,
      operatorPackage: projectSupervisedSalesOperatorPackage({ pkg: approvalPackage }),
    })
  }

  const workflowScoresResult = scoreSupervisedSalesWorkflow({
    runtimeAudit,
    selectedLeads,
    packages: packages.map((row) => row.operatorPackage),
    outboundKillSwitchOff: !outboundKillSwitchEnabled,
  })

  const approvalAudit = auditSupervisedSalesApprovalWorkflow()
  const blockers = deriveSupervisedSalesBlockers({
    runtimeMissing: runtimeAudit.filter((row) => row.status === "missing").length,
    outboundKillSwitchEnabled,
    qualifiedLeadCount: selectedLeads.length,
    packagesGenerated: packages.length,
    approvalActionsPartial: approvalAudit.filter((row) => row.status === "partial").length,
  })

  const criticalBlockers = blockers.filter((row) => row.severity === "critical")

  return {
    qaMarker: GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt,
    runtimeAudit,
    outboundKillSwitchEnabled,
    selectedLeads,
    packages,
    workflowScores: workflowScoresResult.dimensions,
    overallReadinessScore: workflowScoresResult.overallReadinessScore,
    blockers,
    supervisedCycleReady:
      criticalBlockers.length === 0 &&
      workflowScoresResult.overallReadinessScore >= 0.7 &&
      packages.length > 0 &&
      !outboundKillSwitchEnabled,
    admissionPoolSummary: {
      totalActiveLeads: admissionPool.counts.totalActiveLeads,
      outreachEligible: admissionPool.counts.outreachEligible,
      accepted: admissionPool.counts.accepted,
      review: admissionPool.counts.review,
    },
  }
}
