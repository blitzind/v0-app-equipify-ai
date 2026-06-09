/**
 * Apollo-Scale-1 — Production Scale Certification
 *
 * Evaluates Apollo as primary contact acquisition engine across 10–20 companies.
 * Stops before enrollment, approval, scheduler, or any outreach.
 *
 * Run:
 *   pnpm certify:apollo-scale-1:production
 *
 * With Vercel production env:
 *   vercel env run -e production -- pnpm certify:apollo-scale-1:production
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { assertApolloLiveBenchmarkAllowed } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { resolveApolloCreditLimits } from "../lib/growth/providers/apollo/apollo-config"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

function applyApolloScale1CertEnvDefaults(): void {
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
    Number.parseInt(process.env.GROWTH_APOLLO_SCALE_1_COMPANY_LIMIT ?? "15", 10) || 15,
  )
  process.env.GROWTH_APOLLO_MAX_COMPANIES_PER_RUN = String(
    Math.max(companyLimit, limits.max_companies_per_run),
  )
}

async function main(): Promise<void> {
  applyApolloScale1CertEnvDefaults()

  const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
  const auditOnly =
    process.env.GROWTH_APOLLO_SCALE_1_AUDIT_ONLY === "true" ||
    process.argv.includes("--audit-only")

  const {
    certifyApolloScale1Production,
    certifyApolloScale1ProductionAudit,
    APOLLO_SCALE_1_QA_MARKER,
  } = await import("../lib/growth/apollo/apollo-scale-1-production-certification")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const company_limit = Math.max(
    10,
    Math.min(20, Number.parseInt(process.env.GROWTH_APOLLO_SCALE_1_COMPANY_LIMIT ?? "15", 10) || 15),
  )

  if (!liveGate.ok && !auditOnly) {
    console.warn(
      JSON.stringify({
        warning: "apollo_live_gate_blocked_falling_back_to_audit",
        message: liveGate.error,
      }),
    )
  }

  const report =
    liveGate.ok && !auditOnly
      ? await certifyApolloScale1Production(admin, { company_limit, env: process.env })
      : await certifyApolloScale1ProductionAudit(admin, { company_limit, env: process.env })

  const payload = {
    ok: report.result !== "FAIL",
    qa_marker: APOLLO_SCALE_1_QA_MARKER,
    apollo_scale_1: report,
  }

  console.log(JSON.stringify(payload, null, 2))
  process.exit(report.result === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
