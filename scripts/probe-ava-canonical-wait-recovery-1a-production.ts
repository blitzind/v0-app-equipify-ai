/**
 * AVA-CANONICAL-WAIT-RECOVERY-1A — Production probe.
 *
 * Read-only:
 *   pnpm probe:ava-canonical-wait-recovery-1a:production
 *
 * Bounded scheduler execution:
 *   AVA_CANONICAL_WAIT_RECOVERY_1A_EXECUTE=true pnpm probe:ava-canonical-wait-recovery-1a:production
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import { containsProhibitedAvaOutboundStyleMarkers } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  buildSupervisedAvaHomeOperatorAttention,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { evaluateGrowth5fPackagePreparation } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import {
  isAuthoritativeCanonicalOutreachPackage,
  selectLatestAuthoritativeOutreachPackage,
} from "@/lib/growth/aios/growth/growth-canonical-outreach-package-authority-1a"
import { resolveGrowthCanonicalDecisionForLead } from "@/lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { createServiceRoleClient } from "@/lib/supabase/admin"

const CERT_ID = "ava-canonical-wait-recovery-1a-v1" as const
const EXECUTE = process.env.AVA_CANONICAL_WAIT_RECOVERY_1A_EXECUTE === "true"

const PROOF_CANDIDATES = [
  { name: "MD Equipment Services", leadId: "e7466319-9112-40a3-af46-d33c63f35823" },
  { name: "ClaimLinx", leadId: "4f443634-54bf-4eb9-a114-93a287712a83" },
  { name: "Diverse Power Foundation", leadId: "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5" },
] as const

async function inspectLead(admin: SupabaseClient, orgId: string, candidate: { name: string; leadId: string }) {
  const lead = await fetchGrowthLeadById(admin, candidate.leadId).catch(() => null)
  const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  const dfState =
    resolved.kind === "postgres"
      ? await resolved.repository.getLeadState(orgId, candidate.leadId)
      : null
  const evidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId: orgId,
    leadId: candidate.leadId,
    portfolioSelected: true,
  })
  const portfolio = lead
    ? evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId })
    : { eligible: false, reasonCode: "lead_not_found" }

  const runs = await listOutreachPreparationRunsForLead(admin, orgId, candidate.leadId).catch(() => [])
  const authoritativePackage = selectLatestAuthoritativeOutreachPackage({
    runs,
    draftFactoryPackageId: dfState?.packageId ?? null,
    draftFactoryState: dfState?.state ?? null,
  })
  const orphanRuns = runs.filter(
    (run) =>
      run.approvalPackage &&
      !isAuthoritativeCanonicalOutreachPackage({
        package: run.approvalPackage,
        draftFactoryPackageId: dfState?.packageId ?? null,
        draftFactoryState: dfState?.state ?? null,
      }),
  )

  const decision = await resolveGrowthCanonicalDecisionForLead(admin, {
    organizationId: orgId,
    leadId: candidate.leadId,
    generatedAt: new Date().toISOString(),
    packageSnapshot: authoritativePackage ?? undefined,
  })

  const gateBefore = evaluateGrowth5fPackagePreparation(decision, {
    proposedPurpose: "outreach-prep",
    wakeCondition: "execution_completed",
  })
  const gateAfter = evaluateGrowth5fPackagePreparation(decision, {
    proposedPurpose: "supervised_ava_outreach_generation",
    wakeCondition: "execution_completed",
    isDraftFactoryGenerationWake: true,
  })

  const gens = await listGrowthAiCopilotGenerationsForLead(admin, candidate.leadId).catch(() => [])
  const supervised = gens.filter((gen) => isAvaSupervisedOutboundGeneration(gen.metadata ?? {}))

  return {
    company: candidate.name,
    leadId: candidate.leadId,
    draftFactoryState: dfState?.state ?? null,
    draftFactoryPackageId: dfState?.packageId ?? null,
    admission: lead ? resolveLeadAdmissionStateFromMetadata(lead.metadata ?? {}) : null,
    contactEmail: lead?.contactEmail ?? null,
    portfolioEligible: portfolio.eligible,
    investmentState: evidence.investmentState ?? null,
    authoritativePackageId: authoritativePackage?.packageId ?? null,
    orphanPrepRunCount: orphanRuns.length,
    decision: decision
      ? {
          primaryAction: decision.decision.primaryAction,
          title: decision.decision.title,
          waitUntil: decision.decision.waitUntil,
          relationshipGoal: decision.decision.sourceSummary.relationshipGoal,
          revenueRecommendation: decision.decision.sourceSummary.revenueRecommendation,
          packageStatus: decision.decision.sourceSummary.packageStatus,
          approvalStatus: decision.decision.sourceSummary.approvalStatus,
          fingerprint: decision.decision.decisionFingerprint,
          generatedAt: decision.generatedAt,
        }
      : null,
    growth5fGateNormal: gateBefore,
    growth5fGateDraftFactoryWake: gateAfter,
    supervisedGenerationCount: supervised.length,
  }
}

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = createServiceRoleClient()
  if (!admin) throw new Error("Service role client unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const proofStartedAt = new Date().toISOString()

  const before = await Promise.all(PROOF_CANDIDATES.map((row) => inspectLead(admin, orgId, row)))

  let tickResult = null
  if (EXECUTE) {
    tickResult = await tickDraftFactoryDueStatesForScheduler(admin, {
      organizationIds: [orgId],
      maxRuntimeMs: 180_000,
    })
  }

  const after = await Promise.all(PROOF_CANDIDATES.map((row) => inspectLead(admin, orgId, row)))

  const freshGenerations = []
  for (const candidate of PROOF_CANDIDATES) {
    const gens = await listGrowthAiCopilotGenerationsForLead(admin, candidate.leadId).catch(() => [])
    for (const gen of gens) {
      if (!isAvaSupervisedOutboundGeneration(gen.metadata ?? {})) continue
      if (gen.created_at && gen.created_at >= proofStartedAt) {
        freshGenerations.push({
          company: candidate.name,
          leadId: candidate.leadId,
          generationId: gen.id,
          createdAt: gen.created_at,
          recommendation: (gen.metadata as Record<string, unknown>)?.recommendation ?? null,
          hasEmDash: containsProhibitedAvaOutboundStyleMarkers(gen.body ?? ""),
          hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(gen),
          presentation: resolveAvaSupervisedOutboundApprovalPresentation(gen.metadata ?? {}),
          status: gen.status,
        })
      }
    }
  }

  const portfolioLeads = []
  for (const candidate of PROOF_CANDIDATES) {
    const lead = await fetchGrowthLeadById(admin, candidate.leadId).catch(() => null)
    if (lead) portfolioLeads.push(lead)
  }
  const supervisedGens = await loadSupervisedAvaGenerationsForHome(
    admin,
    portfolioLeads.map((lead) => lead.id),
  )
  const homeAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGens,
    leadsById: new Map(portfolioLeads.map((lead) => [lead.id, lead])),
  })

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        execute: EXECUTE,
        organizationId: orgId,
        before,
        tickResult,
        after,
        freshGenerations,
        homeAwaitingReview: homeAttention.readyForReview.length,
        invariants: { approved: false, sent: false },
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
