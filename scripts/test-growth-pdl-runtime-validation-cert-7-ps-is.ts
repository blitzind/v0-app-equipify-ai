/**
 * Phase 7.PS-IS — PDL runtime validation audit (local vs deployed).
 * Run: pnpm test:growth-pdl-runtime-validation-cert-7-ps-is
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PDL_RUNTIME_VALIDATION_CERT_7_PS_IS_QA_MARKER =
  "growth-pdl-runtime-validation-cert-7-ps-is-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  const admin = boot
    ? createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    : null

  const [
    { runPdlRuntimeValidationAudit },
    { evaluatePdlRuntimeValidationCertification },
    { evaluatePdlRuntimeValidationOutcome },
    { GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/qa/pdl-runtime-validation-audit"),
    import("../lib/growth/qa/pdl-runtime-validation-certification"),
    import("../lib/growth/qa/pdl-runtime-validation-certification"),
    import("../lib/growth/qa/pdl-runtime-validation-types"),
  ])

  const compliance = evaluatePdlRuntimeValidationCertification()
  const audit = await runPdlRuntimeValidationAudit({ admin, use_production_search: true })

  const { certification, remaining_blockers, root_cause } = evaluatePdlRuntimeValidationOutcome({
    local: audit.local,
    runtime: audit.runtime,
    runtime_probed: audit.deployed_probe.ok,
    ps_ir_false_negative_likely: audit.ps_ir_false_negative_likely,
  })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_CERT_7_PS_IS_QA_MARKER,
        audit_qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
        certification,
        compliance,
        ps_ir_false_negative_likely: audit.ps_ir_false_negative_likely,
        root_cause,
        probe_company: audit.probe_company,
        comparison_table: audit.comparison_table,
        local: audit.local,
        runtime: audit.runtime,
        local_keys: {
          PEOPLE_DATA_LABS_API_KEY: audit.local_diagnostics.keys.PEOPLE_DATA_LABS_API_KEY,
          PDL_API_KEY: audit.local_diagnostics.keys.PDL_API_KEY,
          winning_key: audit.local_diagnostics.loaders.pdl_winning_key,
        },
        runtime_keys: audit.deployed_probe.ok
          ? {
              PEOPLE_DATA_LABS_API_KEY: audit.deployed_probe.diagnostics.keys.PEOPLE_DATA_LABS_API_KEY,
              PDL_API_KEY: audit.deployed_probe.diagnostics.keys.PDL_API_KEY,
              winning_key: audit.deployed_probe.diagnostics.loaders.pdl_winning_key,
            }
          : null,
        local_file_audit: {
          PEOPLE_DATA_LABS_API_KEY: audit.local_file_audit.keys.PEOPLE_DATA_LABS_API_KEY.status,
          PDL_API_KEY: audit.local_file_audit.keys.PDL_API_KEY.status,
        },
        local_search: audit.local_search
          ? {
              ok: audit.local_search.ok,
              contacts_returned: audit.local_search.contacts_returned,
              query_summary: audit.local_search.query_summary,
              sandbox: audit.local_search.sandbox,
              message: audit.local_search.message,
            }
          : null,
        runtime_search: audit.runtime_search
          ? {
              ok: audit.runtime_search.ok,
              contacts_returned: audit.runtime_search.contacts_returned,
              query_summary: audit.runtime_search.query_summary,
              search_executable: audit.runtime_search.search_executable,
              sandbox_mode: audit.runtime_search.sandbox_mode,
              pdl_configured: audit.runtime_search.pdl_configured,
              production_ready: audit.runtime_search.production_ready,
              http_status: audit.runtime_search.http_status,
              error: audit.runtime_search.error,
            }
          : null,
        deployed_probe: audit.deployed_probe.ok
          ? {
              probed: true,
              base_url: audit.deployed_probe.base_url,
              probe_channel: audit.deployed_probe.probe_channel,
              pdl_configured: audit.deployed_probe.diagnostics.loaders.isPdlApiConfigured,
            }
          : {
              probed: audit.deployed_probe.probed,
              error: audit.deployed_probe.error,
              detail: audit.deployed_probe.detail ?? null,
            },
        remaining_blockers,
        messages: audit.messages,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
