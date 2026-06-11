/** Shared Apollo qualification scoring context — recovery + pilot diagnostic/selection. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { mergeApolloIntelligenceRecoveryQualificationContext } from "@/lib/growth/apollo/apollo-intelligence-recovery-artifact-contract"
import type { ApolloIntelligenceRecoveryQualificationContext } from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import {
  shouldLoadApolloQualificationScoringRunArtifacts,
} from "@/lib/growth/apollo/apollo-qualification-scoring-context-helpers"
import { loadBuyingCommitteeIntelligenceRunDetail } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
  type GrowthBuyingCommitteeIntelligenceRunDetail,
  type GrowthBuyingCommitteeIntelligenceRunResult,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { loadCompanyIntelligenceRunDetail } from "@/lib/growth/company-intelligence/company-intelligence-repository"
import {
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
  type GrowthCompanyIntelligenceRunDetail,
  type GrowthCompanyIntelligenceRunResult,
} from "@/lib/growth/company-intelligence/company-intelligence-types"
import { loadProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-loader"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

export const APOLLO_QUALIFICATION_SCORING_CONTEXT_QA_MARKER =
  "apollo-qualification-scoring-context-v14-2e" as const

export type ApolloQualificationScoringContext = ApolloIntelligenceRecoveryQualificationContext & {
  canonical_company_id: string | null
  engine: GrowthProspectSearchEngineIntelligence | null
  company_intelligence_run: GrowthCompanyIntelligenceRunResult | null
  buying_committee_run: GrowthBuyingCommitteeIntelligenceRunResult | null
}

function mapCompanyIntelligenceRunDetailToResult(
  detail: GrowthCompanyIntelligenceRunDetail,
): GrowthCompanyIntelligenceRunResult {
  return {
    qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
    run_id: detail.run_id,
    company_id: detail.company_id,
    status: detail.status,
    finding_count: detail.finding_count,
    verified_count: detail.verified_count,
    promoted_count: detail.promoted_count,
    findings: detail.findings,
    messages: [],
  }
}

function mapBuyingCommitteeRunDetailToResult(
  detail: GrowthBuyingCommitteeIntelligenceRunDetail,
): GrowthBuyingCommitteeIntelligenceRunResult {
  return {
    run_id: detail.run_id,
    company_id: detail.company_id,
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    member_count: detail.member_count,
    verified_count: detail.verified_count,
    promoted_count: detail.promoted_count,
    coverage: detail.coverage ?? {
      roles_present: [],
      roles_missing: [],
      coverage_score: detail.coverage_score,
      single_thread_risk: true,
      verified_member_count: 0,
    },
    assignments: detail.assignments,
    messages: [],
  }
}

export async function loadLatestCompletedCompanyIntelligenceRunResult(
  admin: SupabaseClient,
  canonical_company_id: string,
): Promise<GrowthCompanyIntelligenceRunResult | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id")
    .eq("company_id", canonical_company_id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) return null
  const detail = await loadCompanyIntelligenceRunDetail(admin, data.id as string)
  return detail ? mapCompanyIntelligenceRunDetailToResult(detail) : null
}

export async function loadLatestCompletedBuyingCommitteeIntelligenceRunResult(
  admin: SupabaseClient,
  canonical_company_id: string,
): Promise<GrowthBuyingCommitteeIntelligenceRunResult | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .select("id")
    .eq("company_id", canonical_company_id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) return null
  const detail = await loadBuyingCommitteeIntelligenceRunDetail(admin, data.id as string)
  return detail ? mapBuyingCommitteeRunDetailToResult(detail) : null
}

export async function loadApolloQualificationScoringContextForCompany(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    growth_lead_id?: string | null
    canonical_company_id?: string | null
    artifact_overlay?: {
      company_intelligence_run?: GrowthCompanyIntelligenceRunResult | null
      buying_committee_run?: GrowthBuyingCommitteeIntelligenceRunResult | null
    }
  },
): Promise<ApolloQualificationScoringContext> {
  let canonical_company_id = input.canonical_company_id ?? null
  if (!canonical_company_id) {
    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: input.company_candidate_id,
    })
    canonical_company_id = resolution.canonical_company_id
  }

  const engine = await loadProspectSearchEngineIntelligence(admin, {
    source_type: "external_discovered",
    id: input.company_candidate_id,
    growth_lead_id: input.growth_lead_id ?? null,
    canonical_company_id,
  })

  let company_intelligence_run = input.artifact_overlay?.company_intelligence_run ?? null
  let buying_committee_run = input.artifact_overlay?.buying_committee_run ?? null

  if (canonical_company_id) {
    const needs = shouldLoadApolloQualificationScoringRunArtifacts(engine)
    if (needs.company_intelligence && !company_intelligence_run) {
      company_intelligence_run = await loadLatestCompletedCompanyIntelligenceRunResult(
        admin,
        canonical_company_id,
      )
    }
    if (needs.buying_committee && !buying_committee_run) {
      buying_committee_run = await loadLatestCompletedBuyingCommitteeIntelligenceRunResult(
        admin,
        canonical_company_id,
      )
    }
  }

  const merged = mergeApolloIntelligenceRecoveryQualificationContext({
    engine,
    company_intelligence_run,
    buying_committee_run,
  })

  return {
    ...merged,
    canonical_company_id,
    engine,
    company_intelligence_run,
    buying_committee_run,
  }
}
