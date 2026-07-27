/**
 * AVA-DRAFT-FACTORY-GENERATION-RECOVERY-1A — Production probe.
 *
 * Read-only:
 *   pnpm probe:ava-draft-factory-generation-recovery-1a:production
 *
 * Bounded scheduler execution (no approval/send):
 *   AVA_DRAFT_FACTORY_GENERATION_RECOVERY_1A_EXECUTE=true pnpm probe:ava-draft-factory-generation-recovery-1a:production
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
import { collectGenerationCapacityCandidates } from "@/lib/growth/draft-factory/draft-factory-generation-capacity"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import {
  listDueDraftFactoryStates,
  listWaitingForGenerationDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { createServiceRoleClient } from "@/lib/supabase/admin"

const CERT_ID = "ava-draft-factory-generation-recovery-1a-v1" as const
const EXECUTE = process.env.AVA_DRAFT_FACTORY_GENERATION_RECOVERY_1A_EXECUTE === "true"

const PROOF_CANDIDATES = [
  { name: "MD Equipment Services", leadId: "e7466319-9112-40a3-af46-d33c63f35823" },
  { name: "ClaimLinx", leadId: "4f443634-54bf-4eb9-a114-93a287712a83" },
  { name: "Diverse Power Foundation", leadId: "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5" },
] as const

async function classifyDueStates(admin: SupabaseClient, orgId: string) {
  const { data } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, paused_reason")
    .eq("organization_id", orgId)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key =
      row.state === "paused" && row.paused_reason === "stop_investment"
        ? "paused_stop_investment"
        : String(row.state)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

async function inspectCandidate(
  admin: SupabaseClient,
  orgId: string,
  input: { name: string; leadId: string },
  dueLeadIds: Set<string>,
  dedicatedLeadIds: Set<string>,
  now: string,
) {
  const { data: dfRow } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", orgId)
    .eq("lead_id", input.leadId)
    .maybeSingle()
  const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
  const evidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId: orgId,
    leadId: input.leadId,
    portfolioSelected: true,
  })
  const portfolio = lead
    ? evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId })
    : { eligible: false, reasonCode: "lead_not_found" }
  const gens = await listGrowthAiCopilotGenerationsForLead(admin, input.leadId).catch(() => [])
  const supervised = gens.filter((gen) => isAvaSupervisedOutboundGeneration(gen.metadata ?? {}))

  let exclusionReason = "eligible_pending_selection"
  if (!dfRow) exclusionReason = "no_draft_factory_state"
  else if (dfRow.state !== "waiting_for_generation") exclusionReason = `state_${dfRow.state}`
  else if (!dedicatedLeadIds.has(input.leadId)) exclusionReason = "not_in_generation_dedicated_pool"
  else if (!evidence.admitted) exclusionReason = "not_admitted"
  else if (!evidence.contactVerifiedForEmail) exclusionReason = "contact_not_ready"
  else if (!evidence.researchCurrent) exclusionReason = "research_not_current"
  else if (evidence.stopInvestment) exclusionReason = "stop_investment"
  else if (!portfolio.eligible) exclusionReason = portfolio.reasonCode

  const inDuePool = dueLeadIds.has(input.leadId)
  const inDedicatedPool = dedicatedLeadIds.has(input.leadId)

  return {
    company: input.name,
    leadId: input.leadId,
    state: dfRow?.state ?? null,
    stateUpdatedAt: dfRow?.updated_at ?? null,
    nextEligibleWakeAt: dfRow?.next_eligible_wake_at ?? null,
    attemptCounts: dfRow?.attempt_counts ?? null,
    lastErrorCode: dfRow?.last_error_code ?? null,
    leaseOwner: dfRow?.lease_owner ?? null,
    admission: lead ? resolveLeadAdmissionStateFromMetadata(lead.metadata ?? {}) : null,
    contactEmail: lead?.contactEmail ?? null,
    portfolioEligible: portfolio.eligible,
    inDuePool,
    inDedicatedPool,
    capacityCandidate: inDedicatedPool && dfRow?.state === "waiting_for_generation",
    exclusionReason,
    supervisedGenerationCount: supervised.length,
  }
}

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = createServiceRoleClient()
  if (!admin) throw new Error("Service role client unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const now = new Date().toISOString()
  const proofStartedAt = now

  const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  if (resolved.kind !== "postgres") throw new Error(`Expected postgres repository, got ${resolved.kind}`)
  const repository = resolved.repository

  const dueStates = await listDueDraftFactoryStates({
    organizationId: orgId,
    now,
    limit: GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
    repository,
  })
  const generationReadyStates = await listWaitingForGenerationDraftFactoryStates({
    organizationId: orgId,
    now,
    repository,
  })
  const dueLeadIds = new Set(dueStates.map((row) => row.leadId))
  const dedicatedLeadIds = new Set(generationReadyStates.map((row) => row.leadId))

  const generationPool = collectGenerationCapacityCandidates({
    deferredStates: [],
    generationReadyStates: generationReadyStates.map((row) => ({
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
    })),
    limit: 10,
  })

  const before = {
    dueStateClassification: await classifyDueStates(admin, orgId),
    dueStatesFound: dueStates.length,
    waitingForGenerationDedicated: generationReadyStates.length,
    waitingForGenerationInDuePool: dueStates.filter((row) => row.state === "waiting_for_generation").length,
    generativeCandidates: generationPool.waitingForGenerationCount,
    capacityCandidateCount: generationPool.candidates.length,
    candidates: await Promise.all(
      PROOF_CANDIDATES.map((row) => inspectCandidate(admin, orgId, row, dueLeadIds, dedicatedLeadIds, now)),
    ),
  }

  let tickResult = null
  if (EXECUTE) {
    tickResult = await tickDraftFactoryDueStatesForScheduler(admin, {
      organizationIds: [orgId],
      maxRuntimeMs: 120_000,
    })
  }

  const afterDueStates = await listDueDraftFactoryStates({
    organizationId: orgId,
    now: new Date().toISOString(),
    limit: GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
    repository,
  })
  const afterGenerationReady = await listWaitingForGenerationDraftFactoryStates({
    organizationId: orgId,
    now: new Date().toISOString(),
    repository,
  })

  const freshGenerations = []
  for (const candidate of PROOF_CANDIDATES) {
    const gens = await listGrowthAiCopilotGenerationsForLead(admin, candidate.leadId).catch(() => [])
    for (const gen of gens) {
      if (!isAvaSupervisedOutboundGeneration(gen.metadata ?? {})) continue
      if (gen.created_at && gen.created_at >= proofStartedAt) {
        freshGenerations.push({
          leadId: candidate.leadId,
          company: candidate.name,
          generationId: gen.id,
          createdAt: gen.created_at,
          recommendation: (gen.metadata as Record<string, unknown>)?.recommendation ?? null,
          hasEmDash: containsProhibitedAvaOutboundStyleMarkers(gen.body ?? ""),
          hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(gen),
          presentation: resolveAvaSupervisedOutboundApprovalPresentation(gen.metadata ?? {}),
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

  const afterCandidates = await Promise.all(
    PROOF_CANDIDATES.map((row) =>
      inspectCandidate(
        admin,
        orgId,
        row,
        new Set(afterDueStates.map((s) => s.leadId)),
        new Set(afterGenerationReady.map((s) => s.leadId)),
        new Date().toISOString(),
      ),
    ),
  )

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        execute: EXECUTE,
        organizationId: orgId,
        before,
        tickResult,
        after: {
          dueStatesFound: afterDueStates.length,
          waitingForGenerationDedicated: afterGenerationReady.length,
          waitingForGenerationInDuePool: afterDueStates.filter((row) => row.state === "waiting_for_generation")
            .length,
          capacitySelected: tickResult?.capacity_selected ?? null,
          dueAdvanced: tickResult?.due_advanced ?? null,
          freshGenerations,
          homeAwaitingReview: homeAttention.readyForReview.length,
          candidates: afterCandidates,
        },
        invariants: {
          approved: false,
          sent: false,
        },
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
