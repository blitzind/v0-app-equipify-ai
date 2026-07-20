/**
 * GE-AIOS-REVENUE-2B — Accepted lead revenue progression validation (read-only Production).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2b-accepted-lead-progression-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { mapDurableStateToPortfolioCapacityClass } from "@/lib/growth/draft-factory/draft-factory-due-capacity-class"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"

export const GE_AIOS_REVENUE_2B_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2b-accepted-lead-progression-production-v1" as const

const PHASE = "GE-AIOS-REVENUE-2B" as const
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

type LeadRow = {
  id: string
  company_name: string
  status: string
  metadata: Record<string, unknown> | null
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
  decision_maker_status: string | null
  primary_decision_maker_id: string | null
  contact_name: string | null
  contact_email: string | null
  updated_at: string
  created_at: string
}

type DfRow = {
  lead_id: string
  state: string
  earliest_incomplete_stage: string | null
  paused_reason: string | null
  next_eligible_wake_at: string | null
  package_id: string | null
  last_wake_at: string | null
  last_wake_type: string | null
  updated_at: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function pickPromotionFromRunSignals(signals: unknown): Record<string, unknown> | null {
  const record = asRecord(signals)
  const promotion = record.companyEvidencePromotion_v25c
  return promotion && typeof promotion === "object" ? (promotion as Record<string, unknown>) : null
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Accepted lead revenue progression validation (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2B_PRODUCTION_VALIDATION_QA_MARKER}`)

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

  const nowIso = new Date().toISOString()
  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ observed_at: ${nowIso}`)

  const { data: leadRows, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at, decision_maker_status, primary_decision_maker_id, contact_name, contact_email, updated_at, created_at",
    )
    .limit(5000)
  if (leadError) {
    console.error(`Leads query failed: ${leadError.message}`)
    process.exit(1)
  }

  const acceptedLeads = (leadRows ?? []).filter((row) => {
    const metadata = (row as LeadRow).metadata ?? {}
    return resolveLeadAdmissionStateFromMetadata(metadata) === "accepted"
  }) as LeadRow[]

  const { data: dfRows, error: dfError } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select(
      "lead_id, state, earliest_incomplete_stage, paused_reason, next_eligible_wake_at, package_id, last_wake_at, last_wake_type, updated_at",
    )
    .eq("organization_id", organizationId)
    .limit(5000)
  if (dfError) {
    console.error(`Draft Factory query failed: ${dfError.message}`)
    process.exit(1)
  }

  const dfByLead = new Map(
    (dfRows ?? []).map((row) => [String((row as DfRow).lead_id), row as DfRow]),
  )

  const { data: duePoolRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, next_eligible_wake_at, updated_at")
    .eq("organization_id", organizationId)
    .not("state", "in", '("waiting_for_approval","approved","executed","failed")')
    .or(`next_eligible_wake_at.is.null,next_eligible_wake_at.lte.${nowIso}`)
    .order("updated_at", { ascending: true })
    .limit(500)

  const dueLeadIds = new Set((duePoolRows ?? []).map((row) => String((row as { lead_id: string }).lead_id)))

  const { count: bcJobs7d } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", SEVEN_DAYS_AGO)

  const { count: bcRuns7d } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", SEVEN_DAYS_AGO)

  console.log("\n=== Phase 1 — Accepted Lead Inventory ===")
  console.log(`Accepted leads found: ${acceptedLeads.length}`)

  if (acceptedLeads.length === 0) {
    console.log("No accepted leads in Production — cannot validate happy path on existing runtime.")
    process.exit(0)
  }

  for (const lead of acceptedLeads) {
    const df = dfByLead.get(lead.id) ?? null
    const metadata = lead.metadata ?? {}
    const portfolioEligibility = evaluateGrowthPortfolioLeadEligibility({
      lead: {
        id: lead.id,
        status: lead.status,
        metadata,
        promotedOrganizationId: null,
        archivedAt: null,
        workflowHealth: null,
        workflowHealthReason: null,
      },
      organizationId,
    })

    const hasResearch = Boolean(lead.latest_prospect_research_run_id && lead.last_prospect_researched_at)
    const researchStale = lead.last_prospect_researched_at
      ? isProspectResearchStale(lead.last_prospect_researched_at)
      : false

    const signals = buildResourceAllocationSignalsFromLead(
      {
        id: lead.id,
        status: lead.status,
        metadata,
        companyName: lead.company_name,
        contactEmail: lead.contact_email,
        contactName: lead.contact_name,
        decisionMakerStatus: lead.decision_maker_status,
        primaryDecisionMakerId: lead.primary_decision_maker_id,
        latestProspectResearchRunId: lead.latest_prospect_research_run_id,
        lastProspectResearchedAt: lead.last_prospect_researched_at,
      } as never,
      { budgetAvailable: true, killSwitchActive: false },
    )
    const resource = evaluateResourceAllocationFacade({
      organizationId,
      accountId: lead.id,
      resourceClass: "website_research",
      signals,
    })

    const capacityClass = df
      ? mapDurableStateToPortfolioCapacityClass(df.state, {
          earliestIncompleteStage: df.earliest_incomplete_stage,
        })
      : null

    let blockingReason = "none_observed"
    if (!portfolioEligibility.eligible) blockingReason = `portfolio_ineligible:${portfolioEligibility.reasonCode}`
    else if (!df) blockingReason = "no_draft_factory_durable_row"
    else if (df.state === "paused" && df.earliest_incomplete_stage === "portfolio") {
      if (!dueLeadIds.has(lead.id)) {
        blockingReason =
          df.next_eligible_wake_at && Date.parse(df.next_eligible_wake_at) > Date.parse(nowIso)
            ? `waiting_timer:next_eligible_wake_at=${df.next_eligible_wake_at}`
            : "not_in_due_pool_despite_portfolio_pause"
      } else if (capacityClass !== "cheap_validation") {
        blockingReason = `capacity_class_null_or_unmapped:${capacityClass ?? "null"}`
      } else if (resource.investment_state === "stop_investment") {
        blockingReason = "investment_stop"
      } else {
        blockingReason = "portfolio_due_pool_eligible_pending_scheduler_selection"
      }
    } else if (df.state === "waiting_for_generation") {
      blockingReason = "awaiting_generation_capacity_wake"
    } else if (df.state === "waiting_for_dm") {
      blockingReason = "awaiting_decision_maker_stage"
    } else {
      blockingReason = `draft_factory_state:${df.state}`
    }

    console.log("\n--- Accepted Lead ---")
    console.log(
      JSON.stringify(
        {
          leadId: lead.id,
          company: lead.company_name,
          admissionState: "accepted",
          draftFactoryState: df?.state ?? null,
          earliestIncompleteStage: df?.earliest_incomplete_stage ?? null,
          pausedReason: df?.paused_reason ?? null,
          nextEligibleWakeAt: df?.next_eligible_wake_at ?? null,
          inDuePoolNow: dueLeadIds.has(lead.id),
          portfolioEligibility: portfolioEligibility.eligible
            ? "eligible"
            : portfolioEligibility.reasonCode,
          capacityClass,
          investmentState: resource.investment_state,
          researchStatus: hasResearch ? (researchStale ? "stale" : "current") : "missing",
          lastProspectResearchedAt: lead.last_prospect_researched_at,
          decisionMakerStatus: lead.decision_maker_status,
          primaryDecisionMakerId: lead.primary_decision_maker_id,
          packageIdOnDfState: df?.package_id ?? null,
          lastWakeType: df?.last_wake_type ?? null,
          lastWakeAt: df?.last_wake_at ?? null,
          dfUpdatedAt: df?.updated_at ?? null,
          blockingReason,
        },
        null,
        2,
      ),
    )
  }

  console.log("\n=== Phase 2 — Portfolio Progression ===")
  for (const lead of acceptedLeads) {
    const df = dfByLead.get(lead.id)
    if (!df) {
      console.log(`  ${lead.id}: no DF row — portfolio scheduler cannot advance`)
      continue
    }
    const canSelect =
      dueLeadIds.has(lead.id) &&
      mapDurableStateToPortfolioCapacityClass(df.state, {
        earliestIncompleteStage: df.earliest_incomplete_stage,
      }) === "cheap_validation" &&
      evaluateGrowthPortfolioLeadEligibility({ lead: lead as never, organizationId }).eligible
    console.log(
      `  ${lead.company_name} (${lead.id.slice(0, 8)}…): legally_selectable_now=${canSelect}; state=${df.state}; due_pool=${dueLeadIds.has(lead.id)}; stage=${df.earliest_incomplete_stage}`,
    )
  }

  console.log("\n=== Phase 3 — Research → Buying Committee ===")
  for (const lead of acceptedLeads) {
    let companyId: string | null = null
    try {
      companyId = await resolveCanonicalCompanyIdForLead(admin, lead.id)
    } catch {
      companyId = null
    }

    let promotion: Record<string, unknown> | null = null
    if (lead.latest_prospect_research_run_id) {
      const { data: runRow } = await admin
        .schema("growth")
        .from("prospect_research_runs")
        .select("id, status, completed_at, signals")
        .eq("id", lead.latest_prospect_research_run_id)
        .maybeSingle()
      promotion = pickPromotionFromRunSignals((runRow as { signals?: unknown } | null)?.signals)
      console.log(
        `  ${lead.company_name}: research_run=${lead.latest_prospect_research_run_id} status=${(runRow as { status?: string } | null)?.status ?? "missing"} promotion=${JSON.stringify(promotion)}`,
      )
    } else {
      console.log(`  ${lead.company_name}: no completed prospect research run on lead record`)
    }

    const bcTriggerEligible =
      promotion?.skippedReason == null && Boolean(promotion?.promoted) && Boolean(companyId)
    console.log(
      `    canonical_company_id=${companyId ?? "none"} bc_trigger_would_fire_on_research_completion=${bcTriggerEligible}`,
    )

    if (companyId) {
      const { data: bcJobs } = await admin
        .schema("growth")
        .from("buying_committee_jobs")
        .select("id, status, trigger_source, created_at, completed_at, last_error")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(5)
      const { data: bcRuns } = await admin
        .schema("growth")
        .from("buying_committee_runs")
        .select("id, status, created_at, completed_at, member_count, verified_count")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(3)
      console.log(`    buying_committee_jobs: ${JSON.stringify(bcJobs ?? [])}`)
      console.log(`    buying_committee_runs: ${JSON.stringify(bcRuns ?? [])}`)
    }
  }

  console.log("\n=== Phase 4 — Decision Maker ===")
  for (const lead of acceptedLeads) {
    const df = dfByLead.get(lead.id)
    console.log(
      `  ${lead.company_name}: dm_status=${lead.decision_maker_status ?? "null"} primary_dm=${lead.primary_decision_maker_id ?? "null"} df_state=${df?.state ?? "none"}`,
    )
  }

  console.log("\n=== Phase 5 — Package Generation ===")
  for (const lead of acceptedLeads) {
    const df = dfByLead.get(lead.id)
    const { data: packages } = await admin
      .schema("growth")
      .from("autonomous_outreach_preparation_runs")
      .select("id, package_id, status, completed_at, lead_id")
      .eq("organization_id", organizationId)
      .eq("lead_id", lead.id)
      .order("completed_at", { ascending: false })
      .limit(3)
    console.log(
      `  ${lead.company_name}: df_package_id=${df?.package_id ?? "null"} preparation_runs=${JSON.stringify(packages ?? [])}`,
    )
  }

  console.log("\n=== Phase 7 — Sales Loop / BC Jobs (7d) ===")
  console.log(`  buying_committee_jobs (7d): ${bcJobs7d ?? 0}`)
  console.log(`  buying_committee_runs (7d): ${bcRuns7d ?? 0}`)

  const acceptedInDmOrBeyond = acceptedLeads.filter((lead) => {
    const state = dfByLead.get(lead.id)?.state ?? ""
    return ["waiting_for_dm", "waiting_for_contact_verification", "waiting_for_personalization", "waiting_for_generation", "draft_ready", "waiting_for_approval"].includes(state)
  })
  const acceptedWithSuccessfulPromotion = acceptedLeads.filter((lead) => {
    return Boolean(lead.latest_prospect_research_run_id)
  })

  let bcClassification = "E_reporting_or_table_mismatch"
  if ((bcJobs7d ?? 0) === 0 && acceptedInDmOrBeyond.length === 0) {
    bcClassification = "A_no_accepted_lead_reached_decision_maker_yet"
  } else if ((bcJobs7d ?? 0) === 0 && acceptedWithSuccessfulPromotion.length > 0) {
    bcClassification = "B_or_C_bc_enqueue_not_observed_or_completed_without_jobs_table_rows"
  } else if ((bcJobs7d ?? 0) > 0) {
    bcClassification = "jobs_present_in_buying_committee_jobs"
  }
  console.log(`  classification: ${bcClassification}`)
  console.log(`  accepted leads in DM/package DF states: ${acceptedInDmOrBeyond.length}`)

  console.log("\n=== Phase 8 — Runtime Timeline (wake receipts, 30d) ===")
  for (const lead of acceptedLeads.slice(0, 5)) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: receipts } = await admin
      .schema("growth")
      .from("draft_factory_wake_receipts")
      .select("wake_type, outcome, wake_fingerprint, created_at")
      .eq("organization_id", organizationId)
      .eq("lead_id", lead.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(30)
    console.log(`  ${lead.company_name} receipts:`)
    for (const receipt of receipts ?? []) {
      console.log(
        `    ${(receipt as { created_at: string }).created_at} ${(receipt as { wake_type: string }).wake_type} → ${(receipt as { outcome: string }).outcome}`,
      )
    }
  }

  console.log("\n=== Phase 9 — Engineering Assessment Summary ===")
  console.log(
    "Audit complete — see sections above for per-lead blocking classification. No Production mutations performed.",
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
