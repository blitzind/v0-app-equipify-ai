/**
 * Phase 14.3D — Production yield validation after enrichment recovery.
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-enrichment-recovery-yield-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const boot = bootstrapVerifiedChannelsCertEnv({
  sources: PRODUCTION_VALIDATION_ENV_SOURCES,
  inheritProcessEnvProviderKeys: true,
  protectedSnapshot: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    APOLLO_API_KEY: process.env.APOLLO_API_KEY ?? "",
    GROWTH_APOLLO_API_KEY: process.env.GROWTH_APOLLO_API_KEY ?? "",
  },
})

if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "production credentials unavailable" }))
  process.exit(1)
}

async function main(): Promise<void> {
  const { measureApolloEnrichmentRecoveryMetrics } = await import(
    "../lib/growth/apollo/apollo-enrichment-recovery"
  )
  const { loadApolloOperationsDashboard } = await import("../lib/growth/apollo/apollo-operations-dashboard")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const metrics = await measureApolloEnrichmentRecoveryMetrics(admin)
  const dashboard = await loadApolloOperationsDashboard(admin)

  console.log(
    JSON.stringify(
      {
        ok: true,
        yield_metrics: metrics,
        discovery_funnel: dashboard.discovery_funnel,
        rejection_analysis: dashboard.rejection_analysis,
        expansion_readiness: dashboard.expansion_readiness,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
