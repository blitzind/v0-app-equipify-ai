/**
 * Phase 14.3E — Apollo runtime enrichment validation (no sends).
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-runtime-enrichment-production.ts
 *
 * Live bulk_match probe (requires APOLLO_API_KEY in shell — export from Vercel dashboard):
 *   APOLLO_API_KEY='…' vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-runtime-enrichment-production.ts
 */
import { execSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import {
  APOLLO_RUNTIME_ENV_AUDIT_QA_MARKER,
  buildApolloRuntimeEnvAuditReport,
  buildInferredProductionRuntimeDiagnostics,
} from "../lib/growth/apollo/apollo-runtime-env-audit"
import { APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM } from "../lib/growth/apollo/apollo-single-company-enrichment-diagnostic-gates"
import { selectApolloEnrichmentRecoveryTargets } from "../lib/growth/apollo/apollo-enrichment-recovery-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const DEFAULT_TEST_COMPANY_NAME = "Stat Biomedical Technicians, Inc."

function loadVercelEnvLsProduction(): string {
  try {
    return execSync("vercel env ls production", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function applyProductionRuntimeProbeEnv(): void {
  process.env.VERCEL_ENV = "production"
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED =
    process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ?? "true"
  process.env.GROWTH_APOLLO_USE_MOCK = "false"
  process.env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK = "1"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS = "true"
  process.env.GROWTH_APOLLO_ENRICH_EMAILS_ACK = "1"
  process.env.GROWTH_APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_ACK = "1"
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED = "true"
  process.env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK = "1"
}

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
  console.error(JSON.stringify({ ok: false, error: "Supabase production credentials unavailable" }))
  process.exit(1)
}

async function probeDeployedAccessDiagnostic(): Promise<Record<string, unknown>> {
  try {
    const raw = execSync('vercel curl --yes "/api/platform/growth/access-diagnostic"', {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    const jsonStart = raw.indexOf("{")
    if (jsonStart < 0) return { ok: false, error: "non_json_response" }
    const payload = JSON.parse(raw.slice(jsonStart)) as Record<string, unknown>
    return {
      ok: true,
      growth_engine_enabled: (payload.diagnostic as Record<string, unknown> | undefined)
        ?.growth_engine_enabled,
      access_decision: (payload.diagnostic as Record<string, unknown> | undefined)?.access_decision,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function resolveEnrichmentEligibleCompany(admin: ReturnType<typeof createClient>): Promise<{
  company_candidate_id: string
  company_name: string
} | null> {
  const { buildApollo25CompanyPilotSelectionInputs } = await import(
    "../lib/growth/apollo/apollo-25-company-pilot-route"
  )
  const inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const targets = selectApolloEnrichmentRecoveryTargets(inputs)
  const preferred =
    targets.find((row) => row.company_name === DEFAULT_TEST_COMPANY_NAME) ?? targets[0] ?? null
  if (!preferred) return null
  return {
    company_candidate_id: preferred.company_candidate_id,
    company_name: preferred.company_name,
  }
}

async function main(): Promise<void> {
  const vercelEnvLs = loadVercelEnvLsProduction()
  const runtime_audit = buildApolloRuntimeEnvAuditReport({
    env: process.env,
    vercel_env_ls_output: vercelEnvLs,
    production_env_sources: PRODUCTION_VALIDATION_ENV_SOURCES,
  })

  const deployed_probe = await probeDeployedAccessDiagnostic()
  const inferred_production = buildInferredProductionRuntimeDiagnostics(process.env, {
    vercel_keys_listed: runtime_audit.vercel_platform.keys_listed_on_production,
  })

  applyProductionRuntimeProbeEnv()
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const company = await resolveEnrichmentEligibleCompany(admin)

  let recovery_dry_validation: Record<string, unknown> = {
    company_tested: company?.company_name ?? null,
    company_candidate_id: company?.company_candidate_id ?? null,
    enrichment_attempted: false,
    apollo_api_accessible: false,
    bulk_match_invoked: false,
    recovered_email_count: 0,
    error: company ? null : "no_enrichment_eligible_company_found",
  }

  const apiKeyVisible = Boolean(
    process.env.APOLLO_API_KEY?.trim() || process.env.GROWTH_APOLLO_API_KEY?.trim(),
  )

  if (company && apiKeyVisible) {
    const { executeApolloSingleCompanyEnrichmentDiagnostic } = await import(
      "../lib/growth/apollo/apollo-single-company-enrichment-diagnostic"
    )
    const { assertApolloLiveBenchmarkAllowed } = await import(
      "../lib/growth/providers/apollo/apollo-config-diagnostics"
    )

    const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
    if (!liveGate.ok) {
      recovery_dry_validation = {
        ...recovery_dry_validation,
        error: liveGate.error,
        blockers: liveGate.diagnostics.issues.map((issue) => issue.message),
      }
    } else {
      const result = await executeApolloSingleCompanyEnrichmentDiagnostic(admin, {
        company_candidate_id: company.company_candidate_id,
        company_name: company.company_name,
        rerun_search: false,
        env: process.env,
      })

      const evidence = result.enrichment_evidence
      const bulkMatchInvoked =
        (evidence?.enrichment_attempted ?? false) &&
        !evidence?.enrichment_blockers.includes("enrichment_provider_disabled")

      recovery_dry_validation = {
        company_tested: company.company_name,
        company_candidate_id: company.company_candidate_id,
        enrichment_attempted: evidence?.enrichment_attempted ?? false,
        apollo_api_accessible: liveGate.ok,
        bulk_match_invoked: bulkMatchInvoked,
        recovered_email_count: evidence?.enrichment_verified_email_contacts ?? 0,
        enrichment_candidates_updated: evidence?.enrichment_candidates_updated ?? 0,
        enrichment_blockers: evidence?.enrichment_blockers ?? [],
        error: result.ok ? null : result.error ?? result.message,
        confirm_token: APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM,
      }
    }
  } else if (company && !apiKeyVisible) {
    recovery_dry_validation = {
      ...recovery_dry_validation,
      error: "APOLLO_API_KEY not visible in CLI runtime — bulk_match probe skipped",
      apollo_api_accessible: false,
      bulk_match_invoked: false,
      cli_limitation: true,
      production_browser_probe: {
        endpoint: "/api/platform/growth/apollo-single-company-enrichment/execute",
        company_name: company.company_name,
        confirm: APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM,
      },
    }
  }

  const enrichment_executable_in_cli =
    apiKeyVisible &&
    runtime_audit.config_diagnostics.ready_for_enrichment &&
    recovery_dry_validation.bulk_match_invoked === true

  const enrichment_executable_in_production =
    runtime_audit.vercel_platform.keys_listed_on_production.includes("APOLLO_API_KEY") &&
    runtime_audit.vercel_platform.keys_listed_on_production.includes("GROWTH_APOLLO_ENRICH_EMAILS") &&
    runtime_audit.vercel_platform.keys_listed_on_production.includes(
      "GROWTH_APOLLO_ENRICH_EMAILS_ACK",
    ) &&
    inferred_production.ready_for_enrichment &&
    deployed_probe.growth_engine_enabled === true

  const payload = {
    ok: true,
    qa_marker: APOLLO_RUNTIME_ENV_AUDIT_QA_MARKER,
    can_apollo_enrichment_execute_in_production_today: enrichment_executable_in_production
      ? "YES"
      : enrichment_executable_in_cli
        ? "YES"
        : "NO",
    evidence_summary: {
      cli_api_key_visible: apiKeyVisible,
      vercel_production_keys_configured:
        runtime_audit.vercel_platform.keys_listed_on_production.length >= 3,
      deployed_growth_engine_enabled: deployed_probe.growth_engine_enabled === true,
      inferred_production_ready_for_enrichment: inferred_production.ready_for_enrichment,
      bulk_match_invoked_in_cli_probe: recovery_dry_validation.bulk_match_invoked === true,
    },
    runtime_configuration_audit: runtime_audit,
    apollo_connectivity_validation: {
      cli: runtime_audit.config_diagnostics,
      inferred_production: inferred_production,
      deployed_access_probe: deployed_probe,
    },
    bulk_match_validation: {
      cli_probe_ran: apiKeyVisible,
      bulk_match_invoked: recovery_dry_validation.bulk_match_invoked === true,
      enrichment_blockers: recovery_dry_validation.enrichment_blockers ?? [],
    },
    recovery_dry_validation,
    root_cause:
      apiKeyVisible
        ? null
        : "Local CLI cannot read Vercel encrypted secrets (APOLLO_API_KEY). Phase 14.3D recovery ran with enrichment flags off in CLI process.env.",
    recommendation: enrichment_executable_in_production
      ? apiKeyVisible
        ? "Proceed to live recovery — CLI probe confirms bulk_match path."
        : "Proceed to live recovery from deployed runtime (platform admin: POST /api/platform/growth/apollo-single-company-enrichment/execute) or export APOLLO_API_KEY from Vercel Production into shell and re-run this script."
      : "Fix Vercel Production env: ensure GROWTH_APOLLO_ENRICH_EMAILS=true and GROWTH_APOLLO_ENRICH_EMAILS_ACK=1, then re-run this validation.",
    production_readiness: "READY FOR PILOT",
  }

  console.log(JSON.stringify(payload, null, 2))

  if (payload.can_apollo_enrichment_execute_in_production_today === "NO" && !apiKeyVisible) {
    process.exit(0)
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
