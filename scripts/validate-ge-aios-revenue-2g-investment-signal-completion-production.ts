/**
 * GE-AIOS-REVENUE-2G — Investment signal completion audit (read-only Production).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2g-investment-signal-completion-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { mapPortfolioCapacityClassToResourceClass } from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  evaluateResourceAllocationFacade,
  projectInvestmentStateFromSignals,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"

export const GE_AIOS_REVENUE_2G_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2g-investment-signal-completion-production-v1" as const

const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function traceSv11(
  organizationId: string,
  leadId: string,
  signals: ReturnType<typeof buildResourceAllocationSignalsFromLead>,
  label: string,
) {
  const resourceClass = mapPortfolioCapacityClassToResourceClass("llm_drafting")
  const decision = evaluateResourceAllocationFacade({
    organizationId,
    accountId: leadId,
    resourceClass,
    signals,
  })
  const raw = projectInvestmentStateFromSignals({
    organizationId,
    accountId: leadId,
    resourceClass,
    signals,
  })
  const recommendation = (signals.qualificationRecommendation ?? "").toLowerCase()
  const confidenceUsed =
    typeof signals.evidenceConfidence === "number" ? signals.evidenceConfidence : 0.5
  const increaseBranchEligible =
    (signals.admission?.state ?? "unknown") === "accepted" &&
    confidenceUsed >= 0.7 &&
    signals.budgetAvailable !== false &&
    (/pursue|prepare_outreach|enroll|increase|continue/.test(recommendation) ||
      recommendation === "" ||
      /qualified/.test(recommendation))

  return {
    label,
    resourceClass,
    schedulerSignals: signals,
    sv11Decision: decision,
    rawProjection: raw,
    increaseBranchAnalysis: {
      admission: signals.admission?.state ?? null,
      confidenceUsed,
      recommendationRaw: signals.qualificationRecommendation,
      recommendationNormalized: recommendation,
      budgetAvailable: signals.budgetAvailable ?? null,
      increaseBranchEligible,
    },
  }
}

async function loadResearchRun(
  admin: SupabaseClient,
  runId: string | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!runId) return null
  const { data } = await admin
    .schema("growth")
    .from("prospect_research_runs")
    .select("id, lead_id, status, outcome, signals, created_at, completed_at")
    .eq("id", runId)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

async function auditLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  label: string,
): Promise<Record<string, unknown>> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { label, leadId, error: "lead_not_found" }

  const { data: rawRow } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "score, prospect_recommended_next_action, next_best_action, latest_prospect_research_run_id, last_prospect_researched_at, opportunity_readiness_score, revenue_probability_score, executive_priority_score, metadata",
    )
    .eq("id", leadId)
    .maybeSingle()

  const schedulerSignals = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
  })

  const counterfactualScoreOnly = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
    evidenceConfidence: 0.85,
  })

  const counterfactualPrepareOutreach = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
    evidenceConfidence: 0.85,
    qualificationRecommendation: "prepare_outreach",
  })

  const counterfactualEmptyRec = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
    evidenceConfidence: 0.85,
    qualificationRecommendation: "",
  })

  const researchRun = await loadResearchRun(admin, lead.latestProspectResearchRunId)

  const signalsRecord = (researchRun?.signals ?? {}) as Record<string, unknown>
  const qualification = signalsRecord.qualification as Record<string, unknown> | undefined
  const companyEvidence = signalsRecord.companyEvidencePromotion_v25c as
    | Record<string, unknown>
    | undefined

  return {
    label,
    leadId,
    company: lead.companyName,
    admission: resolveLeadAdmissionStateFromMetadata(lead.metadata ?? {}),
    leadFields: {
      score: lead.score,
      prospectRecommendedNextAction: lead.prospectRecommendedNextAction,
      nextBestAction: lead.nextBestAction,
      latestProspectResearchRunId: lead.latestProspectResearchRunId,
      lastProspectResearchedAt: lead.lastProspectResearchedAt,
      status: lead.status,
      opportunityReadinessScore: lead.opportunityReadinessScore,
      revenueProbabilityScore: lead.revenueProbabilityScore,
    },
    rawDbRow: rawRow ?? null,
    researchFreshness: {
      hasUsableResearch: Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt),
      researchStale: lead.lastProspectResearchedAt
        ? isProspectResearchStale(lead.lastProspectResearchedAt)
        : true,
    },
    researchRun: researchRun
      ? {
          id: researchRun.id,
          status: researchRun.status,
          outcome: researchRun.outcome,
          created_at: researchRun.created_at,
          completed_at: researchRun.completed_at,
          qualificationRecommendation:
            typeof qualification?.recommendedNextAction === "string"
              ? qualification.recommendedNextAction
              : typeof qualification?.recommendation === "string"
                ? qualification.recommendation
                : null,
          companyEvidencePromotion: companyEvidence ?? null,
          signalKeys: Object.keys(signalsRecord),
        }
      : null,
    productionTrace: traceSv11(organizationId, leadId, schedulerSignals, `${label} production`),
    counterfactuals: {
      scoreOnly: traceSv11(organizationId, leadId, counterfactualScoreOnly, `${label} cf score 0.85`),
      prepareOutreach: traceSv11(
        organizationId,
        leadId,
        counterfactualPrepareOutreach,
        `${label} cf prepare_outreach`,
      ),
      emptyRecommendation: traceSv11(
        organizationId,
        leadId,
        counterfactualEmptyRec,
        `${label} cf empty rec`,
      ),
    },
  }
}

async function main(): Promise<void> {
  console.log("[GE-AIOS-REVENUE-2G] Investment signal completion audit (read-only)")
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2G_PRODUCTION_VALIDATION_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) process.exit(1)

  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ observed_at: ${new Date().toISOString()}`)

  const blitz = await auditLead(admin, organizationId, BLITZ_LEAD_ID, "Blitz")
  const block = await auditLead(admin, organizationId, BLOCK_LEAD_ID, "Block")

  console.log("\n=== Blitz complete signal trace ===")
  console.log(JSON.stringify(blitz, null, 2))
  console.log("\n=== Block complete signal trace ===")
  console.log(JSON.stringify(block, null, 2))
  console.log("\n=== Audit complete ===")
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
