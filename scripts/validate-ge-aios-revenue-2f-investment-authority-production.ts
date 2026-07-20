/**
 * GE-AIOS-REVENUE-2F — Investment authority resolution audit (read-only Production).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2f-investment-authority-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { mapPortfolioCapacityClassToResourceClass } from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import { evaluatePortfolioAllocationFacade } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  authorizeSpendForInvestmentState,
  costTierForResource,
  evaluateResourceAllocationFacade,
  projectInvestmentStateFromSignals,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"

export const GE_AIOS_REVENUE_2F_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2f-investment-authority-production-v1" as const

const PHASE = "GE-AIOS-REVENUE-2F" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function projectForClass(
  organizationId: string,
  leadId: string,
  signals: ReturnType<typeof buildResourceAllocationSignalsFromLead>,
  capacityClass: "cheap_validation" | "llm_drafting" | "decision_maker_discovery" | "website_research",
  overrides?: Parameters<typeof buildResourceAllocationSignalsFromLead>[1],
) {
  const merged = { ...signals, ...(overrides ?? {}) }
  const resourceClass = mapPortfolioCapacityClassToResourceClass(capacityClass)
  const decision = evaluateResourceAllocationFacade({
    organizationId,
    accountId: leadId,
    resourceClass,
    signals: merged,
  })
  const raw = projectInvestmentStateFromSignals({
    organizationId,
    accountId: leadId,
    resourceClass,
    signals: merged,
  })
  return { capacityClass, resourceClass, decision, rawProjection: raw }
}

async function auditLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  label: string,
): Promise<Record<string, unknown>> {
  const { data: lead } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, score, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status, primary_decision_maker_id, contact_name, contact_email, prospect_recommended_next_action, next_best_action, updated_at",
    )
    .eq("id", leadId)
    .maybeSingle()

  const { data: df } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, earliest_incomplete_stage, package_id, attempt_counts, last_wake_type, updated_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle()

  if (!lead) return { label, leadId, error: "lead_not_found" }

  const metadata = (lead as { metadata?: Record<string, unknown> }).metadata ?? {}
  const admissionState = resolveLeadAdmissionStateFromMetadata(metadata)
  const baseSignals = buildResourceAllocationSignalsFromLead(lead as never, {
    budgetAvailable: true,
    killSwitchActive: false,
  })

  const dueSchedulerSignals = buildResourceAllocationSignalsFromLead(lead as never, {
    budgetAvailable: true,
    killSwitchActive: false,
  })

  const evidenceSignals = buildResourceAllocationSignalsFromLead(lead as never, {
    approvalRequired: true,
    approvalGranted: false,
  })

  const hasUsableResearch = Boolean(
    (lead as { latest_prospect_research_run_id?: string }).latest_prospect_research_run_id &&
      (lead as { last_prospect_researched_at?: string }).last_prospect_researched_at,
  )
  const researchStale = (lead as { last_prospect_researched_at?: string }).last_prospect_researched_at
    ? isProspectResearchStale(String((lead as { last_prospect_researched_at: string }).last_prospect_researched_at))
    : true

  const projections = {
    due_cheap_validation: projectForClass(organizationId, leadId, dueSchedulerSignals, "cheap_validation"),
    due_llm_drafting: projectForClass(organizationId, leadId, dueSchedulerSignals, "llm_drafting"),
    due_dm: projectForClass(organizationId, leadId, dueSchedulerSignals, "decision_maker_discovery"),
    evidence_email_drafting: projectForClass(organizationId, leadId, evidenceSignals, "llm_drafting"),
    evidence_with_budget_only: evaluateResourceAllocationFacade({
      organizationId,
      accountId: leadId,
      resourceClass: "email_drafting",
      signals: baseSignals,
    }),
    evidence_with_pursue_override: evaluateResourceAllocationFacade({
      organizationId,
      accountId: leadId,
      resourceClass: "email_drafting",
      signals: {
        ...baseSignals,
        qualificationRecommendation: "prepare_outreach",
        evidenceConfidence: 0.85,
      },
    }),
  }

  const llmDrafting = projections.due_llm_drafting.decision
  const portfolio = evaluatePortfolioAllocationFacade({
    organizationId,
    capacityClass: "llm_drafting",
    capacitySlotsAvailable: 5,
    decidedAt: new Date().toISOString(),
    candidates: [
      {
        leadId,
        organizationId,
        companyName: String((lead as { company_name?: string }).company_name ?? ""),
        investmentState: llmDrafting.investment_state,
        spendAuthorized: llmDrafting.spend_authorized,
        signals: { missionAligned: true, missionPriorityOverall: 100, dailyQueueSortScore: 100 },
      },
    ],
  })

  const evidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId,
    leadId,
    portfolioSelected: true,
  }).catch(() => null)

  return {
    label,
    leadId,
    company: (lead as { company_name?: string }).company_name,
    admissionState,
    leadStatus: (lead as { status?: string }).status,
    score: (lead as { score?: number }).score,
    prospectRecommendedNextAction: (lead as { prospect_recommended_next_action?: string }).prospect_recommended_next_action,
    nextBestAction: (lead as { next_best_action?: string }).next_best_action,
    hasUsableResearch,
    researchStale,
    researchFresh: hasUsableResearch && !researchStale,
    df: df ?? null,
    signals: baseSignals,
    projections,
    spendAuthEmailDrafting: {
      maintain: authorizeSpendForInvestmentState("maintain_investment", costTierForResource("email_drafting")),
      increase: authorizeSpendForInvestmentState("increase_investment", costTierForResource("email_drafting")),
    },
    portfolio_llm_drafting: portfolio.decisions[0] ?? null,
    canonicalEvidence: evidence
      ? {
          investmentState: evidence.investmentState,
          stopInvestment: evidence.stopInvestment,
          admitted: evidence.admitted,
          researchCurrent: evidence.researchCurrent,
        }
      : null,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Investment authority resolution audit (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2F_PRODUCTION_VALIDATION_QA_MARKER}`)

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

  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ observed_at: ${new Date().toISOString()}`)

  const blitz = await auditLead(admin, organizationId, BLITZ_LEAD_ID, "Blitz Industries")
  const block = await auditLead(admin, organizationId, BLOCK_LEAD_ID, "Block Imaging")

  console.log("\n=== Phase 1/5/6 — Blitz signal trace ===")
  console.log(JSON.stringify(blitz, null, 2))

  console.log("\n=== Phase 6 — Block vs Blitz comparison ===")
  console.log(JSON.stringify({ blitz, block }, null, 2))

  console.log("\n=== Audit complete (read-only) ===")
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
