/** Apollo live pilot test company prepare — Production runtime orchestration. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveApolloLivePilotTestCompanyPreset } from "@/lib/growth/apollo/apollo-live-pilot-test-company-presets"
import {
  resolveApolloLivePilotTestCompany,
} from "@/lib/growth/apollo/apollo-live-pilot-test-company-selector"
import {
  normalizeApolloTestCompanyDomain,
  seedApolloLivePilotTestCompany,
} from "@/lib/growth/apollo/apollo-live-pilot-test-company-seed"
import { redactApolloLivePilotProductionSecrets } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export const APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER =
  "apollo-live-pilot-test-company-prepare-route-v1" as const

export type ApolloLivePilotTestCompanyPrepareResult = {
  qa_marker: typeof APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER
  ok: boolean
  created: boolean
  company_candidate_id: string | null
  company_name: string | null
  domain: string | null
  env_hint: string | null
  profile: string | null
  message: string | null
}

export async function prepareApolloLivePilotTestCompanyInProduction(
  admin: SupabaseClient,
  input: {
    profile: string
  },
): Promise<ApolloLivePilotTestCompanyPrepareResult> {
  const preset = resolveApolloLivePilotTestCompanyPreset(input.profile)
  if (!preset) {
    return redactApolloLivePilotProductionSecrets({
      qa_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER,
      ok: false,
      created: false,
      company_candidate_id: null,
      company_name: null,
      domain: null,
      env_hint: null,
      profile: input.profile,
      message: `Unknown profile "${input.profile}".`,
    })
  }

  const seedResult = await seedApolloLivePilotTestCompany(admin, {
    company_name: preset.company_name,
    domain: preset.domain,
    website: preset.website,
    industry: preset.industry,
    pilot_profile: preset.profile,
    coverage_tier: preset.coverage_tier,
  })

  if (!seedResult.ok) {
    return redactApolloLivePilotProductionSecrets({
      qa_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER,
      ok: false,
      created: false,
      company_candidate_id: null,
      company_name: preset.company_name,
      domain: preset.domain,
      env_hint: null,
      profile: preset.profile,
      message: seedResult.message,
    })
  }

  const normalizedDomain = normalizeApolloTestCompanyDomain(preset.domain)
  const selected = await resolveApolloLivePilotTestCompany(admin, {
    prefer_seeded: true,
    seeded_domain: normalizedDomain,
  })

  if (!selected.ok || !selected.company) {
    return redactApolloLivePilotProductionSecrets({
      qa_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER,
      ok: false,
      created: seedResult.created,
      company_candidate_id: seedResult.company_candidate_id,
      company_name: preset.company_name,
      domain: preset.domain,
      env_hint: seedResult.env_hint,
      profile: preset.profile,
      message: selected.message,
    })
  }

  const company_candidate_id = selected.company.company_candidate_id

  return redactApolloLivePilotProductionSecrets({
    qa_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_PREPARE_ROUTE_QA_MARKER,
    ok: true,
    created: seedResult.created,
    company_candidate_id,
    company_name: selected.company.company_name,
    domain: selected.company.domain,
    env_hint: `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=${company_candidate_id}`,
    profile: preset.profile,
    message: seedResult.created
      ? "Seeded and selected one Apollo live pilot test company (no outreach, no Apollo HTTP)."
      : "Selected existing seeded Apollo live pilot test company (no outreach, no Apollo HTTP).",
  })
}
