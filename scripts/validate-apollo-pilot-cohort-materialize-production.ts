/**
 * Phase 14.2J — Production cohort materialization validation (no sends).
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-pilot-cohort-materialize-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { materializeApollo25CompanyPilotCohortAssetReadiness } from "../lib/growth/apollo/apollo-25-company-pilot-route"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const VALIDATION_ACTOR_ID = "00000000-0000-4000-8000-000000000001"
const VALIDATION_ACTOR_EMAIL = "apollo-pilot-materialize-validation@equipify.internal"

/** Vercel production credential layers — intentionally excludes `.env.local`. */
const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.error(
      JSON.stringify({
        ok: false,
        error:
          "Supabase production credentials unavailable — vercel env run -e production or Vercel production env files",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const report = await materializeApollo25CompanyPilotCohortAssetReadiness(admin, {
    cohort_id: COHORT_ID,
    acting_user_id: VALIDATION_ACTOR_ID,
    acting_user_email: VALIDATION_ACTOR_EMAIL,
  })

  const trimErrorCompanies = report.companies.filter((company) =>
    company.blockers.some((blocker) => blocker.includes("trim")),
  )

  const payload = {
    ok: trimErrorCompanies.length === 0,
    cohort_id: COHORT_ID,
    supabase_url: boot.url,
    env_loaded_files: boot.audit.loaded_files,
    companies_processed: report.companies_processed,
    companies_ready: report.companies_ready,
    readiness_pct: report.readiness_pct,
    no_sequence_execution: report.no_sequence_execution,
    no_outreach_side_effects: report.no_outreach_side_effects,
    trim_error_companies: trimErrorCompanies.map((company) => ({
      company_candidate_id: company.company_candidate_id,
      company_name: company.company_name,
      blockers: company.blockers,
    })),
    first_two_companies: report.companies.slice(0, 2).map((company) => ({
      company_candidate_id: company.company_candidate_id,
      company_name: company.company_name,
      ready: company.ready,
      blockers: company.blockers,
      stage_ids: company.stage_ids,
      artifacts: company.artifacts,
    })),
    personalization: report.review.personalization,
    launch_recommendation: report.review.launch_recommendation,
  }

  console.log(JSON.stringify(payload, null, 2))
  process.exit(trimErrorCompanies.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exit(1)
})
