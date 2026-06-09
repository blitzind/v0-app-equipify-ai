/**
 * Apollo-Scale-2 — Live Multi-Company Acquisition Certification
 *
 * Runs live Apollo search → enrich → promote → readiness on 15–20 benchmark
 * companies with no prior Apollo acquisition. Stops before enrollment/outreach.
 *
 * Requires APOLLO_API_KEY (or GROWTH_APOLLO_API_KEY) in environment.
 *
 * Run:
 *   export APOLLO_API_KEY='...'
 *   pnpm certify:apollo-scale-2:production
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { assertApolloLiveBenchmarkAllowed } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { resolveApolloCreditLimits } from "../lib/growth/providers/apollo/apollo-config"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

function ensureApolloApiKeyFromLocalEnvFiles(): void {
  if (process.env.APOLLO_API_KEY?.trim() || process.env.GROWTH_APOLLO_API_KEY?.trim()) return

  for (const relativePath of [
    ".env.production.local",
    ".vercel/.env.production.local",
    ".env.local",
    ".env.local.active",
  ]) {
    const absolutePath = resolve(process.cwd(), relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
      const key = parsed.APOLLO_API_KEY?.trim() || parsed.GROWTH_APOLLO_API_KEY?.trim()
      if (key) {
        process.env.APOLLO_API_KEY = key
        return
      }
    } catch {
      /* optional */
    }
  }
}

function applyApolloScale2CertEnvDefaults(): void {
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED ??= "true"
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK ??= "1"
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ??= "true"
  process.env.GROWTH_APOLLO_USE_MOCK ??= "false"
  process.env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK ??= "1"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS ??= "true"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS_ACK ??= "1"
  process.env.VERCEL_ENV ??= "production"

  const limits = resolveApolloCreditLimits(process.env)
  const companyLimit = Math.min(
    20,
    Number.parseInt(process.env.GROWTH_APOLLO_SCALE_2_COMPANY_LIMIT ?? "15", 10) || 15,
  )
  process.env.GROWTH_APOLLO_MAX_COMPANIES_PER_RUN = String(Math.max(companyLimit + 5, limits.max_companies_per_run))
  process.env.GROWTH_APOLLO_MAX_API_CALLS_PER_RUN = String(
    Math.max(companyLimit * 3, limits.max_api_calls_per_run),
  )
}

async function main(): Promise<void> {
  applyApolloScale2CertEnvDefaults()
  ensureApolloApiKeyFromLocalEnvFiles()

  const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
  if (!liveGate.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "apollo_live_gate_blocked",
        message: liveGate.error,
        diagnostics: liveGate.diagnostics,
        remediation: [
          "Export APOLLO_API_KEY from Vercel Production into the shell before running Scale-2.",
          "Apollo-Scale-2 requires live Apollo HTTP — audit-only mode is not supported.",
        ],
      }),
    )
    process.exit(1)
  }

  const { certifyApolloScale2LiveAcquisition, APOLLO_SCALE_2_QA_MARKER } = await import(
    "../lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
  )

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const company_limit = Math.max(
    15,
    Math.min(20, Number.parseInt(process.env.GROWTH_APOLLO_SCALE_2_COMPANY_LIMIT ?? "15", 10) || 15),
  )

  console.error(
    JSON.stringify({
      status: "apollo_scale_2_live_run_starting",
      company_limit,
      qa_marker: APOLLO_SCALE_2_QA_MARKER,
    }),
  )

  const report = await certifyApolloScale2LiveAcquisition(admin, {
    company_limit,
    env: process.env,
  })

  const payload = {
    ok: report.result !== "FAIL",
    qa_marker: APOLLO_SCALE_2_QA_MARKER,
    apollo_scale_2: report,
  }

  console.log(JSON.stringify(payload, null, 2))
  process.exit(report.result === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
