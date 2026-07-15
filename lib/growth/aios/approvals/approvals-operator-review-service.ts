/**
 * GE-AIOS-APPROVALS-2A — Compose operator review packet from existing stores (server-only).
 * Memory authority: resolveCanonicalHumanMemoryForLead via runtimeContext.getMemory().
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { findAutonomousOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  createGrowthAiOsRuntimeContext,
  type GrowthAiOsRuntimeContext,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"
import { resolveGrowthEngineWorkspaceOrganizationId } from "@/lib/growth/growth-engine-workspace-organization"
import { loadLatestCanonicalDecisionOperatorOverrideForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-override-loader"

export async function loadApprovals2AOperatorReviewPacket(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    leadId: string
    teammateName?: string | null
    now?: string
    runtimeContext?: GrowthAiOsRuntimeContext
  },
): Promise<Approvals2AOperatorReviewPacket | null> {
  const run = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    input.organizationId,
    input.packageId,
  )
  const pkg = run?.approvalPackage
  if (!pkg || pkg.packageId !== input.packageId) return null
  if (pkg.leadId !== input.leadId) return null

  const [lead, decisionMakers, snapshot] = await Promise.all([
    fetchGrowthLeadById(admin, input.leadId),
    listGrowthLeadDecisionMakers(admin, input.leadId).catch(() => []),
    fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    }).catch(() => null),
  ])

  const primary =
    decisionMakers.find((row) => row.id === lead?.primaryDecisionMakerId) ?? decisionMakers[0] ?? null

  const equipmentFromEvidence = (snapshot?.evidenceSummary?.verifiedEvidence ?? [])
    .filter((line) => /service indicator|equipment|mri|ct|imaging|fleet/i.test(line))
    .map((line) => line.replace(/^Service indicator:\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 4)

  const runtimeContext =
    input.runtimeContext ??
    createGrowthAiOsRuntimeContext(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      boundary: "approval_review",
      cacheScope: "operator-surface",
      packageSnapshot: { ...pkg, canonicalHumanMemory: pkg.canonicalHumanMemory },
      generatedAt: input.now,
      companyName: lead?.companyName ?? pkg.companyName,
    })

  const freshCanonicalHumanMemory = await runtimeContext.getMemory().catch(
    () => pkg.canonicalHumanMemory ?? null,
  )

  const pkgForProjection = {
    ...pkg,
    canonicalHumanMemory: freshCanonicalHumanMemory ?? pkg.canonicalHumanMemory ?? null,
  }

  const canonicalDecision = await runtimeContext.getDecision().catch(() => null)

  const canonicalDecisionOverride = await loadLatestCanonicalDecisionOperatorOverrideForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    packageId: input.packageId,
    decisionFingerprint: canonicalDecision?.decision.decisionFingerprint ?? null,
  }).catch(() => null)

  return projectApprovals2AOperatorReviewPacket({
    pkg: pkgForProjection,
    canonicalDecision,
    canonicalDecisionOverride,
    teammateName: input.teammateName,
    now: input.now,
    lead: lead
      ? {
          companyName: lead.companyName,
          website: lead.website,
          city: lead.city,
          state: lead.state,
          country: lead.country,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          estimatedEmployeeCount: lead.estimatedEmployeeCount,
          estimatedAnnualRevenue: lead.estimatedAnnualRevenue,
          fieldServiceStackDetected: lead.fieldServiceStackDetected,
          lastResearchedAt: lead.lastResearchedAt,
          sourceVendor: lead.sourceVendor,
          sourceChannel: lead.sourceChannel,
          relationshipStrengthTier: lead.relationshipStrengthTier,
          decisionMakerStatus: lead.decisionMakerStatus,
          metadata: lead.metadata,
        }
      : null,
    decisionMaker: primary
      ? {
          fullName: primary.fullName,
          title: primary.title,
          email: primary.email,
          phone: primary.phone,
          linkedinUrl: primary.linkedinUrl ?? null,
          confidence: primary.confidence ?? null,
          verificationStatus: primary.status ?? null,
          discoveredAt: primary.createdAt ?? null,
          source: primary.source ?? null,
        }
      : null,
    research: snapshot
      ? {
          updatedAt: snapshot.updatedAt,
          confidence: snapshot.qualification?.confidence ?? pkg.confidence,
          industry: null,
          equipmentServiced: equipmentFromEvidence,
          missingEvidence: snapshot.evidenceSummary?.missingEvidence ?? [],
          potentialRisks: snapshot.evidenceSummary?.potentialRisks ?? [],
          assumptions: snapshot.evidenceSummary?.assumptions ?? [],
          opportunitySummary: snapshot.opportunityAssessment?.summary ?? null,
        }
      : {
          updatedAt: pkg.preparedAt,
          confidence: pkg.confidence,
          industry: null,
          equipmentServiced: equipmentFromEvidence,
          missingEvidence: [],
          potentialRisks: [],
          assumptions: [],
          opportunitySummary: pkg.expectedOutcome,
        },
  })
}

export { GROWTH_AIOS_APPROVALS_2A_QA_MARKER }
