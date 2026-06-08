/**
 * Phase 7.PS-IT — PDL probe coverage & sandbox flag audit.
 * Run: pnpm test:growth-pdl-runtime-coverage-audit-7-ps-it
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_CERT_7_PS_IT_QA_MARKER =
  "growth-pdl-runtime-coverage-audit-cert-7-ps-it-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  const admin = boot
    ? createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    : null

  const { runPdlRuntimeCoverageAudit, GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER } = await import(
    "../lib/growth/qa/pdl-runtime-coverage-audit"
  )

  const audit = await runPdlRuntimeCoverageAudit({
    admin,
    max_companies: 10,
  })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_CERT_7_PS_IT_QA_MARKER,
        audit_qa_marker: GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER,
        certification: audit.certification,
        recommendation: audit.recommendation,
        remaining_blockers: audit.remaining_blockers,
        sandbox_config: audit.sandbox_config,
        deployed_diagnostics: {
          pdl_sandbox_enabled: audit.deployed_diagnostics.loaders.pdl_sandbox_enabled,
          pdl_sandbox_env_raw: audit.deployed_diagnostics.loaders.pdl_sandbox_env_raw,
          pdl_sandbox_env_explicit: audit.deployed_diagnostics.loaders.pdl_sandbox_env_explicit,
          pdl_configured: audit.deployed_diagnostics.loaders.isPdlApiConfigured,
        },
        aggregate: {
          companies_probed: audit.companies_probed,
          companies_with_records: audit.companies_with_records,
          total_pdl_persons_returned: audit.total_pdl_persons_returned,
          estimated_records_per_company: audit.estimated_records_per_company,
        },
        probes: audit.probes.map((probe) => ({
          company_name: probe.company_name,
          domain: probe.domain,
          service_shop_score: probe.service_shop_score,
          priority: probe.priority,
          query_executed: probe.query_executed,
          http_status: probe.http_status,
          records_returned: probe.records_returned,
          names_count: probe.names_count,
          titles_count: probe.titles_count,
          emails_count: probe.emails_count,
          phones_count: probe.phones_count,
          provider_message: probe.provider_message,
          query_summary: probe.query_summary,
          env_sandbox_mode: probe.env_sandbox_mode,
          effective_sandbox_mode: probe.effective_sandbox_mode,
          endpoint_mode: probe.endpoint_mode,
          probe_channel: probe.probe_channel,
          persisted: probe.persisted,
        })),
        compliance: {
          audit_only: audit.audit_only,
          no_persistence: audit.no_persistence,
          no_benchmark_acquisition: true,
          no_contact_creation: true,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
