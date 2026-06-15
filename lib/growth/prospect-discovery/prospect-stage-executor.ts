/** Stage executor for GS-2C prospect discovery — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { runProspectSearchHumanAcquisitionPipeline } from "@/lib/growth/prospect-search/prospect-search-human-acquisition"
import { runProspectSearchRealWorldDiscovery } from "@/lib/growth/prospect-search/prospect-search-real-world-discovery"
import { runCompanySignalIntelligence } from "@/lib/growth/company-signals/company-signal-repository"
import { runCompanyIntelligenceForCanonicalCompany } from "@/lib/growth/company-intelligence/company-intelligence-orchestrator"
import { fetchStagingCanonicalCompanyId } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { routeNormalizedExternalSignal } from "@/lib/growth/signal-intelligence/external-signal-producers"
import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import type { ProspectExecutionBudgetContext } from "@/lib/growth/prospect-discovery/prospect-execution-budget-guards"
import type { ProspectExecutionStageId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { isDiscoveryProviderRuntimeEnabled } from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import { isApolloDiscoveryDisabled } from "@/lib/growth/providers/apollo/apollo-config"
import { isPdlDiscoveryDisabled } from "@/lib/growth/providers/pdl/pdl-config"

export type ProspectStageExecutionContext = {
  companies: GrowthProspectSearchCompanyResult[]
  qualified_companies: GrowthProspectSearchCompanyResult[]
  discovery_run_id: string | null
  budget: ProspectExecutionBudgetContext
  signal_feed_routed_count: number
  warnings: string[]
}

export type ProspectStageExecutionResult = {
  ok: boolean
  stage_id: ProspectExecutionStageId
  companies_delta: number
  contacts_delta: number
  credits_delta: number
  message: string | null
  context: ProspectStageExecutionContext
  skipped?: boolean
}

function mapCompanySignalToLeadSignal(signalLabel: string): string | null {
  const lower = signalLabel.toLowerCase()
  if (lower.includes("hiring")) return "company_hiring"
  if (lower.includes("funding")) return "funding_event"
  if (lower.includes("expansion")) return "expansion_event"
  if (lower.includes("technology")) return "technology_change"
  if (lower.includes("intent") || lower.includes("pricing")) return "pricing_page_visit"
  return null
}

async function routeDiscoveredCompanySignals(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
): Promise<number> {
  let routed = 0
  for (const company of companies) {
    const leadId = company.growth_lead_id
    if (!leadId) continue
    for (const signal of company.signals.slice(0, 3)) {
      const signalType = mapCompanySignalToLeadSignal(signal)
      if (!signalType) continue
      try {
        await routeNormalizedExternalSignal(admin, {
          source_system: "company_growth_signals",
          signal_type: signalType as never,
          evidence_ref: { table: "real_world_company_candidates", id: company.id },
          match: { lead_id: leadId },
          metadata: {
            certification: "gs2c_discovery_signal_feed",
            company_name: company.company_name,
          },
        })
        routed += 1
      } catch {
        // recommendations only — routing failure should not abort execution
      }
    }
  }
  return routed
}

export async function executeProspectDiscoveryStage(
  admin: SupabaseClient,
  input: {
    stage_id: ProspectExecutionStageId
    search_plan: ProspectSearchPlan
    execution_plan: ProspectExecutionPlan
    context: ProspectStageExecutionContext
    created_by?: string | null
    certification_mode?: boolean
  },
): Promise<ProspectStageExecutionResult> {
  const ctx = input.context
  const filters = input.search_plan.normalized_intent.prospect_search_filters
  const query = input.search_plan.normalized_intent.raw_query
  let companies_delta = 0
  let contacts_delta = 0
  let credits_delta = 0
  let message: string | null = null
  let skipped = false

  switch (input.stage_id) {
    case "company_discovery": {
      if (
        !isDiscoveryProviderRuntimeEnabled("google_places") &&
        !isDiscoveryProviderRuntimeEnabled("serp")
      ) {
        skipped = true
        message = "Real-world discovery providers disabled via env kill switches."
        ctx.warnings.push(message)
        break
      }
      const limit = Math.min(input.execution_plan.estimated_companies, ctx.budget.max_companies)
      const discovery = await runProspectSearchRealWorldDiscovery(admin, {
        query,
        filters,
        created_by: input.created_by ?? null,
        limit: input.certification_mode ? Math.min(limit, 5) : limit,
      })
      ctx.companies = discovery.companies
      ctx.discovery_run_id = discovery.discovery_run_id
      companies_delta = discovery.companies.length
      ctx.budget.companies_discovered += companies_delta
      if (discovery.persist_warning) ctx.warnings.push(discovery.persist_warning)
      message = `Discovered ${companies_delta} companies via real-world providers.`
      break
    }
    case "signal_enrichment": {
      if (ctx.companies.length === 0) {
        skipped = true
        message = "No companies available for signal enrichment."
        break
      }
      let enriched = 0
      for (const company of ctx.companies.slice(0, ctx.budget.max_companies)) {
        try {
          await runCompanySignalIntelligence(admin, { company_candidate_id: company.id })
          enriched += 1
        } catch {
          // continue
        }
      }
      const routed = await routeDiscoveredCompanySignals(admin, ctx.companies)
      ctx.signal_feed_routed_count += routed
      message = `Enriched signals for ${enriched} companies; routed ${routed} to signal feed.`
      break
    }
    case "contact_discovery": {
      if (ctx.companies.length === 0) {
        skipped = true
        message = "No companies available for contact discovery."
        break
      }
      if (isApolloDiscoveryDisabled() && isPdlDiscoveryDisabled()) {
        skipped = true
        message = "Apollo and PDL disabled — contact discovery skipped."
        ctx.warnings.push(message)
        break
      }
      beginApolloRunGuardrails()
      try {
        const maxCompanies = input.certification_mode ? 2 : Math.min(5, ctx.budget.max_companies)
        for (const company of ctx.companies.slice(0, maxCompanies)) {
          if (ctx.budget.contacts_discovered >= ctx.budget.max_contacts) break
          const result = await runProspectSearchHumanAcquisitionPipeline(admin, {
            company_candidate_id: company.id,
            created_by: input.created_by ?? null,
            company_snapshot: company,
            search_query: query,
          })
          contacts_delta += result.discovery_contacts
          ctx.budget.contacts_discovered += result.discovery_contacts
        }
        const snapshot = getApolloRunGuardrailSnapshot()
        credits_delta = snapshot?.credits_estimate ?? 0
        ctx.budget.apollo_credits_consumed += credits_delta
      } finally {
        resetApolloRunGuardrails()
      }
      message = `Discovered ${contacts_delta} contacts across selected companies.`
      break
    }
    case "company_intelligence": {
      let processed = 0
      for (const company of ctx.companies.slice(0, 3)) {
        const canonicalId = await fetchStagingCanonicalCompanyId(admin, company.id)
        if (!canonicalId) continue
        try {
          await runCompanyIntelligenceForCanonicalCompany(admin, {
            company_id: canonicalId,
            created_by: input.created_by ?? null,
          })
          processed += 1
        } catch {
          // continue
        }
      }
      message = `Ran company intelligence for ${processed} canonical companies.`
      break
    }
    case "buying_committee_expansion": {
      let processed = 0
      for (const company of ctx.companies.slice(0, 3)) {
        const canonicalId = await fetchStagingCanonicalCompanyId(admin, company.id)
        if (!canonicalId) continue
        try {
          await ensureBuyingCommitteeIntelligenceFoundation(admin, { company_id: canonicalId })
          processed += 1
        } catch {
          // continue
        }
      }
      message = `Expanded buying committee foundation for ${processed} companies.`
      break
    }
    case "qualification": {
      const { companies: qualified, diagnostics } = applyProspectSearchExternalCompanyFilters(
        ctx.companies,
        input.search_plan.qualification_filters,
      )
      ctx.qualified_companies = qualified
      companies_delta = 0
      message = `Qualified ${qualified.length} of ${ctx.companies.length} companies (dropped ${diagnostics.dropped_result_count}).`
      const feedRouted = await routeDiscoveredCompanySignals(admin, qualified)
      ctx.signal_feed_routed_count += feedRouted
      break
    }
    default:
      skipped = true
      message = `Unknown stage ${input.stage_id}`
  }

  return {
    ok: true,
    stage_id: input.stage_id,
    companies_delta,
    contacts_delta,
    credits_delta,
    message,
    context: ctx,
    skipped,
  }
}
