/** Phase 7.PS-IS — PDL runtime validation audit (local vs deployed). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runGrowthPdlTestLookup } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-repository"
import {
  buildGrowthProviderRuntimeDiagnosticsSnapshot,
  buildLocalProviderLoaderStatus,
} from "@/lib/growth/qa/growth-provider-runtime-diagnostics"
import {
  probeDeployedGrowthProviderRuntime,
  runDeployedPdlTestLookup,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
} from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import {
  GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
  type PdlRuntimeValidationComparisonTable,
  type PdlRuntimeValidationEnvironmentRow,
} from "@/lib/growth/qa/pdl-runtime-validation-types"
import {
  auditProviderRuntimeEnvResolution,
  type GrowthProviderRuntimeEnvResolutionAudit,
} from "@/lib/growth/qa/provider-runtime-env-resolution"
import { auditVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  isPdlSandboxEnabled,
} from "@/lib/growth/providers/pdl/pdl-config"

export { GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER }

/** Benchmark-adjacent probe company with known domain (PS-HO-RUNTIME target). */
export const PDL_RUNTIME_VALIDATION_PROBE_COMPANY = {
  company_name: "Biomedical Repair Service",
  domain: "biomed-service.com",
} as const

function buildEnvironmentRow(input: {
  pdl_configured: boolean
  sandbox: boolean
  pdl_discovery_disabled: boolean
  winning_key: "PEOPLE_DATA_LABS_API_KEY" | "PDL_API_KEY" | null
  search_executable: boolean
  records_returned: boolean
  contacts_returned: number
  search_status: string | null
  search_message: string | null
}): PdlRuntimeValidationEnvironmentRow {
  return {
    pdl_configured: input.pdl_configured,
    sandbox: input.sandbox,
    production_ready: input.pdl_configured && !input.sandbox && !input.pdl_discovery_disabled,
    search_executable: input.search_executable,
    records_returned: input.records_returned,
    contacts_returned: input.contacts_returned,
    search_status: input.search_status,
    search_message: input.search_message,
    winning_key: input.winning_key,
    pdl_discovery_disabled: input.pdl_discovery_disabled,
  }
}

function formatComparisonTable(
  local: PdlRuntimeValidationEnvironmentRow,
  runtime: PdlRuntimeValidationEnvironmentRow | null,
): PdlRuntimeValidationComparisonTable {
  const r = runtime ?? {
    pdl_configured: false,
    sandbox: false,
    production_ready: false,
    search_executable: false,
    records_returned: false,
    contacts_returned: 0,
    search_status: null,
    search_message: "runtime_not_probed",
    winning_key: null,
    pdl_discovery_disabled: false,
  }

  return [
    { check: "PDL configured", local: local.pdl_configured, runtime: r.pdl_configured },
    { check: "Sandbox", local: local.sandbox, runtime: r.sandbox },
    { check: "Production ready", local: local.production_ready, runtime: r.production_ready },
    { check: "Search executable", local: local.search_executable, runtime: r.search_executable },
    { check: "Records returned", local: local.records_returned, runtime: r.records_returned },
  ]
}

export async function runPdlRuntimeValidationAudit(input: {
  admin?: SupabaseClient | null
  probe_company?: { company_name: string; domain: string }
  use_production_search?: boolean
}): Promise<{
  qa_marker: typeof GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER
  probe_company: { company_name: string; domain: string }
  local_diagnostics: ReturnType<typeof buildGrowthProviderRuntimeDiagnosticsSnapshot>
  local_loader: ReturnType<typeof buildLocalProviderLoaderStatus>
  local_env_resolution: GrowthProviderRuntimeEnvResolutionAudit
  local_file_audit: ReturnType<typeof auditVerifiedChannelsCertEnv>
  deployed_probe: Awaited<ReturnType<typeof probeDeployedGrowthProviderRuntime>>
  local: PdlRuntimeValidationEnvironmentRow
  runtime: PdlRuntimeValidationEnvironmentRow | null
  comparison_table: PdlRuntimeValidationComparisonTable
  ps_ir_false_negative_likely: boolean
  local_search: Awaited<ReturnType<typeof runGrowthPdlTestLookup>> | null
  runtime_search: Awaited<ReturnType<typeof runDeployedPdlTestLookup>> | null
  messages: string[]
}> {
  const messages: string[] = []
  const probe_company = input.probe_company ?? PDL_RUNTIME_VALIDATION_PROBE_COMPANY
  const use_production_search = input.use_production_search !== false

  const local_diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot()
  const local_loader = buildLocalProviderLoaderStatus()
  const local_env_resolution = auditProviderRuntimeEnvResolution({ runtimeProcessEnv: process.env })
  const local_file_audit = auditVerifiedChannelsCertEnv()

  const local_sandbox = isPdlSandboxEnabled()
  const local_configured =
    local_diagnostics.loaders.isPdlApiConfigured && !local_diagnostics.loaders.pdl_discovery_disabled

  let local_search: Awaited<ReturnType<typeof runGrowthPdlTestLookup>> | null = null
  if (local_configured) {
    local_search = await runGrowthPdlTestLookup({
      company_name: probe_company.company_name,
      domain: probe_company.domain,
      limit: 3,
      sandbox: use_production_search ? false : local_sandbox,
    })
    messages.push(`local_search: ok=${local_search.ok} returned=${local_search.contacts_returned}`)
  } else {
    messages.push("local_search_skipped: pdl_not_configured_in_local_cert_env")
  }

  const local = buildEnvironmentRow({
    pdl_configured: local_configured,
    sandbox: local_sandbox,
    pdl_discovery_disabled: local_diagnostics.loaders.pdl_discovery_disabled,
    winning_key: local_diagnostics.loaders.pdl_winning_key,
    search_executable: local_search != null && local_search.query_summary !== "missing_api_key",
    records_returned: (local_search?.contacts_returned ?? 0) > 0,
    contacts_returned: local_search?.contacts_returned ?? 0,
    search_status: local_search?.query_summary ?? (local_configured ? null : "not_configured"),
    search_message: local_search?.message ?? (local_configured ? null : "local_pdl_not_configured"),
  })

  const base_url = resolveGrowthDeployedRuntimeBaseUrl()
  const cron_secret = resolveGrowthDeployedRuntimeCronSecret()

  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url,
    cron_secret,
    admin: input.admin ?? null,
  })

  let runtime: PdlRuntimeValidationEnvironmentRow | null = null
  let runtime_search: Awaited<ReturnType<typeof runDeployedPdlTestLookup>> | null = null

  if (deployed_probe.ok) {
    const runtime_configured =
      deployed_probe.diagnostics.loaders.isPdlApiConfigured &&
      !deployed_probe.diagnostics.loaders.pdl_discovery_disabled

    if (runtime_configured) {
      runtime_search = await runDeployedPdlTestLookup({
        base_url: deployed_probe.base_url,
        cron_secret,
        admin: input.admin ?? null,
        company_name: probe_company.company_name,
        domain: probe_company.domain,
        limit: 3,
        sandbox: !use_production_search,
      })
      messages.push(
        `runtime_search: ok=${runtime_search.ok} returned=${runtime_search.contacts_returned} channel=${runtime_search.channel}`,
      )
    } else {
      messages.push("runtime_search_skipped: runtime_pdl_not_configured")
    }

    const runtime_sandbox =
      runtime_search?.sandbox_mode ??
      deployed_probe.diagnostics.loaders.pdl_sandbox_enabled

    runtime = buildEnvironmentRow({
      pdl_configured: runtime_configured,
      sandbox: runtime_sandbox,
      pdl_discovery_disabled: deployed_probe.diagnostics.loaders.pdl_discovery_disabled,
      winning_key: deployed_probe.diagnostics.loaders.pdl_winning_key,
      search_executable: runtime_search?.search_executable ?? false,
      records_returned: (runtime_search?.contacts_returned ?? 0) > 0,
      contacts_returned: runtime_search?.contacts_returned ?? 0,
      search_status: runtime_search?.query_summary ?? (runtime_configured ? "not_executed" : "not_configured"),
      search_message: runtime_search?.message ?? runtime_search?.error ?? null,
    })
  } else {
    messages.push(`deployed_probe_failed: ${deployed_probe.error}`)
  }

  const ps_ir_false_negative_likely =
    !local.pdl_configured &&
    Boolean(runtime?.pdl_configured) &&
    local_file_audit.keys.PEOPLE_DATA_LABS_API_KEY.status !== "configured" &&
    local_file_audit.keys.PDL_API_KEY.status !== "configured"

  if (ps_ir_false_negative_likely) {
    messages.push(
      "ps_ir_false_negative_likely: local KEY=\"\" placeholders; deployed runtime has PDL keys.",
    )
  }

  return {
    qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER,
    probe_company,
    local_diagnostics,
    local_loader,
    local_env_resolution,
    local_file_audit,
    deployed_probe,
    local,
    runtime,
    comparison_table: formatComparisonTable(local, runtime),
    ps_ir_false_negative_likely,
    local_search,
    runtime_search,
    messages,
  }
}
