/**
 * Phase 14.3D — Production Apollo enrichment recovery (no sends).
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-enrichment-recovery-production.ts
 *
 * Dry run (metrics only):
 *   DRY_RUN=1 vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-enrichment-recovery-production.ts
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
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
  console.error(
    JSON.stringify({
      ok: false,
      error:
        "Supabase production credentials unavailable — vercel env run -e production required",
    }),
  )
  process.exit(1)
}

/** Recovery intentionally consumes Apollo credits — force live enrichment gates for this run. */
function applyApolloEnrichmentRecoveryProductionEnv(): void {
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED = "true"
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK = "1"
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED = "true"
  process.env.GROWTH_APOLLO_USE_MOCK = "false"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS = "true"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS_ACK = "1"
  process.env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK = "1"
  process.env.VERCEL_ENV = "production"
  process.env.GROWTH_APOLLO_MAX_COMPANIES_PER_RUN = "40"
}

function ensureApolloApiKeyFromProductionEnvFiles(): void {
  if (process.env.APOLLO_API_KEY?.trim() || process.env.GROWTH_APOLLO_API_KEY?.trim()) return

  for (const relativePath of PRODUCTION_VALIDATION_ENV_SOURCES) {
    const absolutePath = resolve(process.cwd(), relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
      const key = parsed.APOLLO_API_KEY?.trim() || parsed.GROWTH_APOLLO_API_KEY?.trim()
      if (key && key !== '""' && key !== "''") {
        process.env.APOLLO_API_KEY = key
        return
      }
    } catch {
      /* optional */
    }
  }
}

async function main(): Promise<void> {
  ensureApolloApiKeyFromProductionEnvFiles()
  applyApolloEnrichmentRecoveryProductionEnv()

  const { assertApolloLiveBenchmarkAllowed } = await import(
    "../lib/growth/providers/apollo/apollo-config-diagnostics"
  )
  const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
  if (!liveGate.ok) {
    console.error(JSON.stringify({ ok: false, error: liveGate.error, diagnostics: liveGate.diagnostics }))
    process.exit(1)
  }

  const { runApolloEnrichmentRecovery } = await import("../lib/growth/apollo/apollo-enrichment-recovery")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const dry_run = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true"

  const report = await runApolloEnrichmentRecovery(admin, {
    dry_run,
    env: process.env,
  })

  const payload = {
    ok: true,
    dry_run,
    before_after: {
      verified_email_companies_before: report.before.verified_email_companies,
      verified_email_companies_after: report.after.verified_email_companies,
      qualified_companies_before: report.before.qualified_companies,
      qualified_companies_after: report.after.qualified_companies,
      greenfield_before: report.before.greenfield_available,
      greenfield_after: report.after.greenfield_available,
    },
    recovery_results: {
      companies_recovered: report.companies_recovered,
      contacts_enriched: report.contacts_enriched,
      emails_recovered: report.emails_recovered,
      companies_promoted_to_verified: report.companies_promoted_to_verified,
      companies_targeted: report.companies_targeted,
      companies_processed: report.companies_processed,
    },
    roi: {
      yield_before_pct: report.yield_before_pct,
      yield_after_pct: report.yield_after_pct,
      net_improvement_pct: report.net_improvement_pct,
    },
    remaining_failure_counts: {
      no_verified_email: report.remaining_failure_counts.no_verified_email ?? 0,
      apollo_returned_no_email: report.remaining_failure_counts.apollo_returned_no_email ?? 0,
      verification_failed: report.remaining_failure_counts.verification_failed ?? 0,
    },
    company_results: report.company_results,
    report,
  }

  console.log(JSON.stringify(payload, null, 2))
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
