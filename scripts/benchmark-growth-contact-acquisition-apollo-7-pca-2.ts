/**
 * Phase 7.PCA-3 — Apollo contact acquisition benchmark (live + guardrails).
 * Run: pnpm benchmark:growth-contact-acquisition-apollo-7-pca-2 --live
 *
 * Search-only live (54-company cohort, no credits):
 *   GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true \
 *   GROWTH_APOLLO_USE_MOCK=false \
 *   GROWTH_APOLLO_ENRICH_EMAILS=false \
 *   GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 \
 *   APOLLO_BENCHMARK_COMPANY_LIMIT=54 \
 *   pnpm benchmark:growth-contact-acquisition-apollo-7-pca-2 --live
 *
 * Dry-run mock (default):
 *   GROWTH_APOLLO_USE_MOCK=true GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true \
 *   pnpm benchmark:growth-contact-acquisition-apollo-7-pca-2
 *
 * Enrichment subset (requires explicit ack + small company limit):
 *   GROWTH_APOLLO_ENRICH_EMAILS=true GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 \
 *   APOLLO_BENCHMARK_COMPANY_LIMIT=10 \
 *   pnpm benchmark:growth-contact-acquisition-apollo-7-pca-2 --live --enrichment-subset
 */
import { createClient } from "@supabase/supabase-js"
import { assertApolloLiveBenchmarkAllowed } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { resolveApolloCreditLimits } from "../lib/growth/providers/apollo/apollo-config"

async function main() {
  const live = process.argv.includes("--live")
  const enrichmentSubset = process.argv.includes("--enrichment-subset")

  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ??= "true"

  if (live) {
    process.env.GROWTH_APOLLO_USE_MOCK = "false"
    const gate = assertApolloLiveBenchmarkAllowed(process.env)
    if (!gate.ok) {
      console.error(
        JSON.stringify({
          error: "live_benchmark_refused",
          message: gate.error,
          config_diagnostics: gate.diagnostics,
        }),
      )
      process.exit(1)
    }

    const limits = resolveApolloCreditLimits(process.env)
    const requested =
      Number(process.env.APOLLO_BENCHMARK_COMPANY_LIMIT ?? String(limits.max_companies_per_run)) ||
      limits.max_companies_per_run
    if (requested > limits.max_companies_per_run) {
      console.error(
        JSON.stringify({
          error: "company_limit_exceeds_guardrail",
          requested,
          max: limits.max_companies_per_run,
          hint: `Set APOLLO_BENCHMARK_COMPANY_LIMIT<=${limits.max_companies_per_run} or raise GROWTH_APOLLO_MAX_COMPANIES_PER_RUN`,
        }),
      )
      process.exit(1)
    }

    if (enrichmentSubset) {
      const subsetMax = Number(process.env.APOLLO_BENCHMARK_ENRICH_COMPANY_LIMIT ?? "10") || 10
      process.env.APOLLO_BENCHMARK_COMPANY_LIMIT = String(
        Math.min(requested, subsetMax, limits.max_companies_per_run),
      )
      if (process.env.GROWTH_APOLLO_ENRICH_EMAILS !== "true" && process.env.GROWTH_APOLLO_ENRICH_EMAILS !== "1") {
        console.error(
          JSON.stringify({
            error: "enrichment_subset_requires_enrich_flag",
            hint: "Set GROWTH_APOLLO_ENRICH_EMAILS=true and GROWTH_APOLLO_ENRICH_EMAILS_ACK=1",
          }),
        )
        process.exit(1)
      }
    } else {
      process.env.GROWTH_APOLLO_ENRICH_EMAILS ??= "false"
    }
  } else {
    process.env.GROWTH_APOLLO_USE_MOCK ??= "true"
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "dry-run-anon-key"
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dry-run-local"
  }

  const mock =
    process.env.GROWTH_APOLLO_USE_MOCK === "1" ||
    process.env.GROWTH_APOLLO_USE_MOCK === "true" ||
    (!live && !process.env.APOLLO_API_KEY && !process.env.GROWTH_APOLLO_API_KEY)

  const { runGrowthContactAcquisitionApolloBenchmark } = await import(
    "../lib/growth/benchmark/growth-contact-acquisition-apollo-benchmark"
  )

  let admin = null
  if (live) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !key) {
      console.error(JSON.stringify({ error: "missing_supabase_credentials_for_live_mode" }))
      process.exit(1)
    }
    admin = createClient(url, key, { auth: { persistSession: false } })
  }

  const limits = resolveApolloCreditLimits(process.env)
  const company_limit =
    Number(process.env.APOLLO_BENCHMARK_COMPANY_LIMIT ?? String(limits.max_companies_per_run)) ||
    limits.max_companies_per_run

  const result = await runGrowthContactAcquisitionApolloBenchmark(admin, {
    dry_run: !live,
    mock,
    company_limit,
    env: process.env,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
