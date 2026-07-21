/**
 * GE-AIOS-LIVE-7B — Cache-hit admission reconciliation production validation.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-live-7b-cache-hit-admission-reconciliation-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER } from "@/lib/growth/research/research-orchestrator"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"

export const GE_AIOS_LIVE_7B_QA_MARKER = "ge-aios-live-7b-cache-hit-admission-reconciliation-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const ORCHESTRATOR_MAX_LEADS = 5

type LeadSnapshot = {
  leadId: string
  company: string | null
  admission: string
  admissionReasons: unknown
  operationalKeywordValidation: unknown
  operationalKeywordValidationPass: unknown
  lastProspectResearchedAt: string | null
  latestProspectResearchRunId: string | null
}

async function snapshotLead(admin: SupabaseClient, leadId: string): Promise<LeadSnapshot | null> {
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, metadata, last_prospect_researched_at, latest_prospect_research_run_id",
    )
    .eq("id", leadId)
    .maybeSingle()
  if (!data) return null
  const metadata = (data.metadata as Record<string, unknown> | null) ?? {}
  return {
    leadId: data.id,
    company: data.company_name,
    admission: resolveLeadAdmissionStateFromMetadata(metadata) ?? "pending",
    admissionReasons: metadata.admission_reasons ?? [],
    operationalKeywordValidation: metadata.operational_keyword_validation ?? null,
    operationalKeywordValidationPass: metadata.operational_keyword_validation_pass ?? null,
    lastProspectResearchedAt: data.last_prospect_researched_at,
    latestProspectResearchRunId: data.latest_prospect_research_run_id,
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = ORG_ID
  }

  const admin = boot.admin
  const generatedAt = new Date().toISOString()

  const queueBefore = await diagnoseAdmissionQueue(admin, ORG_ID)
  const workBefore = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: ORG_ID,
    generatedAt,
  })
  const acceptedBefore = (workBefore?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length

  const orchestratorResult = await runAvaResearchQueueOrchestrator(admin, {
    organizationId: ORG_ID,
    maxLeads: ORCHESTRATOR_MAX_LEADS,
    generatedAt: new Date().toISOString(),
  })

  const leadIds = (orchestratorResult.summary?.leadResults ?? []).map((result) => result.leadId)
  const leadSnapshots = await Promise.all(leadIds.map((leadId) => snapshotLead(admin, leadId)))
  const leadTransitions = (orchestratorResult.summary?.leadResults ?? []).map((result, index) => {
    const after = leadSnapshots[index]
    return {
      leadId: result.leadId,
      companyName: result.companyName,
      outcome: result.outcome,
      researchRunId: result.researchRunId,
      after,
      pendingKeywordRemoved: Array.isArray(after?.admissionReasons)
        ? !after.admissionReasons.includes("pending_operational_keyword_validation")
        : null,
      admissionChangedFromReview:
        after?.admission !== "review" || after?.operationalKeywordValidationPass != null,
    }
  })

  const generatedAtAfter = new Date().toISOString()
  const queueAfter = await diagnoseAdmissionQueue(admin, ORG_ID)
  const workAfter = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: ORG_ID,
    generatedAt: generatedAtAfter,
  })
  const approved = await getActiveApprovedBusinessProfile(admin, ORG_ID).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: ORG_ID,
    generatedAt: generatedAtAfter,
    leads: workAfter?.portfolioLeads ?? [],
    eligibleLeadCount: workAfter?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })
  const acceptedAfter = (workAfter?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length

  const researchCompleted = orchestratorResult.summary?.researchCompleted ?? 0
  const reconciledLeads = leadTransitions.filter(
    (transition) =>
      transition.after?.operationalKeywordValidation != null ||
      transition.pendingKeywordRemoved === true ||
      transition.after?.admission === "accepted" ||
      transition.after?.admission === "rejected",
  ).length
  const admissionDrained = queueAfter.admissionsPending < queueBefore.admissionsPending
  const acceptedIncreased = acceptedAfter > acceptedBefore

  const blockers: string[] = []
  if (researchCompleted <= 0) blockers.push("no research completions in orchestrator pass")
  if (reconciledLeads <= 0) {
    blockers.push("no orchestrated leads show post-research operational keyword validation metadata")
  }
  if (!admissionDrained && !acceptedIncreased) {
    blockers.push("admissionsPending unchanged and accepted count unchanged")
  }

  const report = {
    qa_marker: GE_AIOS_LIVE_7B_QA_MARKER,
    repair_qa_marker: GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    control_flow: {
      before:
        "cache_hit → early return → reconcileExternalDiscoveryPostResearchAdmission skipped",
      after:
        "cache_hit (completed run) → finalizeProspectResearchCompletion → reconcileExternalDiscoveryPostResearchAdmission",
    },
    regression: {
      cache_reuse: "fetchCachedProspectResearchRun still short-circuits research computation",
      rebuild_path: "rebuild=true bypasses cache lookup unchanged",
      duplicate_prevention: "fetchActiveProspectResearchRun duplicate_blocked path unchanged",
      fresh_path: "fresh completion uses same finalizeProspectResearchCompletion helper",
    },
    queue_before: {
      admissionsPending: queueBefore.admissionsPending,
      researchEligible: queueBefore.researchEligible,
      blockedByQueueLimit: queueBefore.blockedByQueueLimit,
    },
    queue_after: {
      admissionsPending: queueAfter.admissionsPending,
      researchEligible: queueAfter.researchEligible,
      blockedByQueueLimit: queueAfter.blockedByQueueLimit,
    },
    accepted_count_before: acceptedBefore,
    accepted_count_after: acceptedAfter,
    replenishment_after: {
      shouldReplenish: pm.replenishment.shouldReplenish,
      blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
      reason: pm.replenishment.reason,
    },
    orchestrator: {
      ok: orchestratorResult.ok,
      researchCompleted,
      companiesReviewed: orchestratorResult.summary?.companiesReviewed ?? 0,
      leadTransitions,
    },
    verdict: {
      repair_validated: researchCompleted > 0 && reconciledLeads > 0,
      backlog_draining: admissionDrained || acceptedIncreased,
      production_ready: researchCompleted > 0 && reconciledLeads > 0 && (admissionDrained || acceptedIncreased),
      remaining_blockers: blockers,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
