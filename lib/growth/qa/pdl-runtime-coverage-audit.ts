/** Phase 7.PS-IT — Multi-company PDL probe coverage audit (no persistence). Server-only. */

import "server-only"

import { execFileSync } from "node:child_process"
import type { SupabaseClient } from "@supabase/supabase-js"
import { runGrowthPdlTestLookup } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-repository"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { ensureApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-cohort"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { scoreServiceShopFit } from "@/lib/growth/graph-expansion/service-shop-score"
import {
  fetchLatestCronTelemetryRun,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedPdlTestLookup,
} from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"
import { resolvePdlSandboxEnvConfig } from "@/lib/growth/providers/pdl/pdl-config"

export const GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER =
  "growth-pdl-runtime-coverage-audit-7-ps-it-v1" as const

const PDL_COVERAGE_AUDIT_CRON_ROUTE = growthCronApiPath("growth-pdl-coverage-audit-run")

/** Priority biomedical service-shop probes requested for PS-IT. */
export const PDL_RUNTIME_COVERAGE_PRIORITY_COMPANIES = [
  "Biomedical Repair Service",
  "Restore Biomedical",
  "Advanced Biomedical Repair",
  "Bio-Med Devices",
  "East Coast Biomedical Services",
  "Pulse Biomedical Service",
  "XMS Biomedical Services",
] as const

export type PdlRuntimeCoverageProbeCompany = {
  canonical_company_id: string | null
  company_name: string
  domain: string | null
  service_shop_score: number
  priority: boolean
}

export type PdlRuntimeCoverageProbeResult = {
  company_name: string
  domain: string | null
  service_shop_score: number
  priority: boolean
  query_executed: boolean
  http_status: number | null
  records_returned: number
  names_count: number
  titles_count: number
  emails_count: number
  phones_count: number
  provider_message: string | null
  query_summary: string | null
  env_sandbox_mode: boolean
  effective_sandbox_mode: boolean
  endpoint_mode: "sandbox" | "live"
  probe_channel: "http" | "vercel_cron_telemetry" | "deployed_runtime_inline" | null
  persisted: false
}

export type PdlRuntimeCoverageAuditResult = {
  qa_marker: typeof GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER
  audit_only: true
  no_persistence: true
  sandbox_config: ReturnType<typeof resolvePdlSandboxEnvConfig> & {
    explicit_sandbox_false_overrides_env_default: boolean
  }
  deployed_diagnostics: ReturnType<typeof buildGrowthProviderRuntimeDiagnosticsSnapshot>
  companies_probed: number
  companies_with_records: number
  total_pdl_persons_returned: number
  estimated_records_per_company: number
  probes: PdlRuntimeCoverageProbeResult[]
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
  recommendation:
    | "proceed_ps_ir_benchmark_pdl_validation"
    | "fix_pdl_config_and_retry_probes"
    | "abandon_pdl_low_yield_for_icp"
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeDomain(website: string | null, primary_domain: string | null): string | null {
  const raw = primary_domain || website
  if (!raw) return null
  return raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase() || null
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function loadPdlRuntimeCoverageProbeCompanies(
  admin: SupabaseClient,
  input: { max_companies?: number } = {},
): Promise<PdlRuntimeCoverageProbeCompany[]> {
  const max_companies = input.max_companies ?? 10

  let cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!cohort) {
    const ensured = await ensureApolloReplacementBenchmarkCohort(admin)
    cohort = ensured.cohort
  }

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, name, website, primary_domain, industry")
    .in("id", cohort.company_ids)

  const prioritySet = new Set(
    PDL_RUNTIME_COVERAGE_PRIORITY_COMPANIES.map((name) => normalizeCompanyName(name)),
  )

  const rows: PdlRuntimeCoverageProbeCompany[] = []
  for (const row of companies ?? []) {
    const record = row as Record<string, unknown>
    const company_name = asString(record.name)
    if (!company_name) continue
    const domain = normalizeDomain(asString(record.website) || null, asString(record.primary_domain) || null)
    const shopScore = scoreServiceShopFit({
      company_name,
      industry: asString(record.industry) || "biomedical equipment service",
      website: asString(record.website) || null,
      domain,
    })
    rows.push({
      canonical_company_id: asString(record.id) || null,
      company_name,
      domain,
      service_shop_score: shopScore.score,
      priority: prioritySet.has(normalizeCompanyName(company_name)),
    })
  }

  const selected: PdlRuntimeCoverageProbeCompany[] = []
  const seen = new Set<string>()

  const add = (company: PdlRuntimeCoverageProbeCompany) => {
    const key = normalizeCompanyName(company.company_name)
    if (seen.has(key)) return
    seen.add(key)
    selected.push(company)
  }

  for (const priorityName of PDL_RUNTIME_COVERAGE_PRIORITY_COMPANIES) {
    const normalizedPriority = normalizeCompanyName(priorityName)
    const exact = rows.find((row) => normalizeCompanyName(row.company_name) === normalizedPriority)
    const fuzzy =
      exact ??
      rows.find((row) => {
        const normalized = normalizeCompanyName(row.company_name)
        return (
          normalized.includes(normalizedPriority) ||
          normalizedPriority.includes(normalized)
        )
      })
    if (fuzzy) add({ ...fuzzy, priority: true })
    else {
      add({
        canonical_company_id: null,
        company_name: priorityName,
        domain: priorityName === "Biomedical Repair Service" ? "biomed-service.com" : null,
        service_shop_score: 0,
        priority: true,
      })
    }
  }

  const supplemental = [...rows]
    .filter((row) => row.domain && row.service_shop_score >= 40)
    .sort((a, b) => b.service_shop_score - a.service_shop_score)

  for (const row of supplemental) {
    if (selected.length >= max_companies) break
    add(row)
  }

  return selected.slice(0, max_companies)
}

function countPreviewFields(
  preview_contacts: Array<Record<string, unknown>> | null | undefined,
): {
  names_count: number
  titles_count: number
  emails_count: number
  phones_count: number
} {
  const contacts = Array.isArray(preview_contacts) ? preview_contacts : []
  let names_count = 0
  let titles_count = 0
  let emails_count = 0
  let phones_count = 0
  for (const row of contacts) {
    if (asString(row.full_name)) names_count += 1
    if (asString(row.title)) titles_count += 1
    if (asString(row.email)) emails_count += 1
    if (asString(row.phone)) phones_count += 1
  }
  return { names_count, titles_count, emails_count, phones_count }
}

async function executeInlinePdlCoverageProbes(
  companies: PdlRuntimeCoverageProbeCompany[],
  deployed_diagnostics: ReturnType<typeof buildGrowthProviderRuntimeDiagnosticsSnapshot>,
): Promise<PdlRuntimeCoverageProbeResult[]> {
  const probes: PdlRuntimeCoverageProbeResult[] = []
  for (const company of companies) {
    const lookup = await runGrowthPdlTestLookup({
      company_name: company.company_name,
      domain: company.domain,
      limit: 5,
      sandbox: false,
    })
    const preview_contacts = Array.isArray(lookup.preview_contacts) ? lookup.preview_contacts : []
    const counts = countPreviewFields(preview_contacts)
    const blocked = new Set([
      "missing_api_key",
      "disabled",
      "missing_input",
      "not_configured",
      "not_executed",
    ])
    const query_executed = Boolean(lookup.query_summary && !blocked.has(lookup.query_summary))

    probes.push({
      company_name: company.company_name,
      domain: company.domain,
      service_shop_score: company.service_shop_score,
      priority: company.priority,
      query_executed,
      http_status: lookup.ok ? 200 : query_executed ? 503 : null,
      records_returned: lookup.contacts_returned,
      names_count: counts.names_count,
      titles_count: counts.titles_count,
      emails_count: counts.emails_count,
      phones_count: counts.phones_count,
      provider_message: lookup.message,
      query_summary: lookup.query_summary,
      env_sandbox_mode: deployed_diagnostics.loaders.pdl_sandbox_enabled,
      effective_sandbox_mode: lookup.sandbox,
      endpoint_mode: lookup.sandbox ? "sandbox" : "live",
      probe_channel: "deployed_runtime_inline",
      persisted: false,
    })
  }
  return probes
}

function buildCoverageAuditFromProbes(input: {
  probes: PdlRuntimeCoverageProbeResult[]
  deployed_diagnostics: ReturnType<typeof buildGrowthProviderRuntimeDiagnosticsSnapshot>
}): PdlRuntimeCoverageAuditResult {
  const sandbox_config = resolvePdlSandboxEnvConfig(process.env)
  const companies_with_records = input.probes.filter((probe) => probe.records_returned > 0).length
  const total_pdl_persons_returned = input.probes.reduce((sum, probe) => sum + probe.records_returned, 0)
  const estimated_records_per_company =
    input.probes.length > 0 ? total_pdl_persons_returned / input.probes.length : 0
  const outcome = evaluateCoverageCertification({
    probes: input.probes,
    sandbox_config: {
      ...sandbox_config,
      explicit_sandbox_false_overrides_env_default: true,
    },
  })

  return {
    qa_marker: GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER,
    audit_only: true,
    no_persistence: true,
    sandbox_config: {
      ...sandbox_config,
      explicit_sandbox_false_overrides_env_default: true,
    },
    deployed_diagnostics: input.deployed_diagnostics,
    companies_probed: input.probes.length,
    companies_with_records,
    total_pdl_persons_returned,
    estimated_records_per_company,
    probes: input.probes,
    certification: outcome.certification,
    remaining_blockers: outcome.remaining_blockers,
    recommendation: outcome.recommendation,
  }
}

/** Runs multi-company PDL probes on the current runtime (production cron). */
export async function runPdlRuntimeCoverageAuditOnRuntime(
  admin: SupabaseClient,
  input: { max_companies?: number } = {},
): Promise<PdlRuntimeCoverageAuditResult> {
  const deployed_diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
  const companies = await loadPdlRuntimeCoverageProbeCompanies(admin, {
    max_companies: input.max_companies,
  })
  const probes = await executeInlinePdlCoverageProbes(companies, deployed_diagnostics)
  return buildCoverageAuditFromProbes({ probes, deployed_diagnostics })
}

function triggerVercelCron(cronPath: string): void {
  execFileSync("vercel", ["crons", "run", cronPath], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
    encoding: "utf8",
  })
}

async function runPdlRuntimeCoverageAuditViaDeployedCron(
  admin: SupabaseClient,
  input: { max_companies?: number } = {},
): Promise<PdlRuntimeCoverageAuditResult | null> {
  const started_after = new Date(Date.now() - 5_000).toISOString()
  try {
    triggerVercelCron(PDL_COVERAGE_AUDIT_CRON_ROUTE)
  } catch {
    return null
  }

  const telemetry = await fetchLatestCronTelemetryRun({
    admin,
    cron_route: PDL_COVERAGE_AUDIT_CRON_ROUTE,
    started_after,
    poll_timeout_ms: 180_000,
  })

  const audit_result =
    telemetry.metadata?.audit_result && typeof telemetry.metadata.audit_result === "object"
      ? (telemetry.metadata.audit_result as PdlRuntimeCoverageAuditResult)
      : null
  if (!audit_result || audit_result.qa_marker !== GROWTH_PDL_RUNTIME_COVERAGE_AUDIT_QA_MARKER) {
    return null
  }
  if (input.max_companies && audit_result.probes.length > input.max_companies) {
    audit_result.probes = audit_result.probes.slice(0, input.max_companies)
  }
  return audit_result
}

function evaluateCoverageCertification(input: {
  probes: PdlRuntimeCoverageProbeResult[]
  sandbox_config: PdlRuntimeCoverageAuditResult["sandbox_config"]
}): {
  certification: PdlRuntimeCoverageAuditResult["certification"]
  remaining_blockers: string[]
  recommendation: PdlRuntimeCoverageAuditResult["recommendation"]
} {
  const blockers: string[] = []
  const executed = input.probes.filter((probe) => probe.query_executed)
  const liveExecuted = executed.filter((probe) => probe.effective_sandbox_mode === false)

  if (executed.length === 0) {
    blockers.push("no_probe_queries_executed")
    return {
      certification: "FAIL",
      remaining_blockers: blockers,
      recommendation: "fix_pdl_config_and_retry_probes",
    }
  }

  if (liveExecuted.length === 0 && input.sandbox_config.env_sandbox_enabled) {
    blockers.push("all_probes_ran_in_sandbox_mode")
  }

  const withRecords = input.probes.filter((probe) => probe.records_returned > 0)
  const total = input.probes.reduce((sum, probe) => sum + probe.records_returned, 0)
  const avg = input.probes.length > 0 ? total / input.probes.length : 0

  if (withRecords.length === 0) {
    blockers.push("zero_records_across_probe_cohort")
    return {
      certification: liveExecuted.length > 0 ? "PASS_PARTIAL" : "FAIL",
      remaining_blockers: blockers,
      recommendation: avg < 0.5 ? "abandon_pdl_low_yield_for_icp" : "fix_pdl_config_and_retry_probes",
    }
  }

  if (avg < 0.5) {
    return {
      certification: "PASS_PARTIAL",
      remaining_blockers: ["low_yield_records_per_company"],
      recommendation: "abandon_pdl_low_yield_for_icp",
    }
  }

  return {
    certification: "PASS",
    remaining_blockers: blockers,
    recommendation: "proceed_ps_ir_benchmark_pdl_validation",
  }
}

export async function runPdlRuntimeCoverageAudit(input: {
  admin: SupabaseClient | null
  max_companies?: number
  base_url?: string
  cron_secret?: string | null
  prefer_deployed_cron?: boolean
}): Promise<PdlRuntimeCoverageAuditResult> {
  const deployed_diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)

  if (input.prefer_deployed_cron !== false && input.admin) {
    const cronAudit = await runPdlRuntimeCoverageAuditViaDeployedCron(input.admin, {
      max_companies: input.max_companies,
    })
    if (cronAudit) return cronAudit
  }

  const base_url = input.base_url ?? resolveGrowthDeployedRuntimeBaseUrl()
  const cron_secret = input.cron_secret ?? resolveGrowthDeployedRuntimeCronSecret()

  const probeCompanies = input.admin
    ? await loadPdlRuntimeCoverageProbeCompanies(input.admin, { max_companies: input.max_companies })
    : PDL_RUNTIME_COVERAGE_PRIORITY_COMPANIES.map((company_name) => ({
        canonical_company_id: null,
        company_name,
        domain: company_name === "Biomedical Repair Service" ? "biomed-service.com" : null,
        service_shop_score: 0,
        priority: true,
      }))

  const probes: PdlRuntimeCoverageProbeResult[] = []

  for (const company of probeCompanies) {
    const result = await runDeployedPdlTestLookup({
      base_url,
      cron_secret,
      admin: input.admin,
      company_name: company.company_name,
      domain: company.domain,
      limit: 5,
      sandbox: false,
      disallow_cron_fallback: true,
    })

    const lookup =
      result.body?.lookup && typeof result.body.lookup === "object"
        ? (result.body.lookup as Record<string, unknown>)
        : null
    const preview_contacts = Array.isArray(lookup?.preview_contacts)
      ? (lookup.preview_contacts as Array<Record<string, unknown>>)
      : []
    const counts = countPreviewFields(preview_contacts)
    const effective_sandbox_mode = result.sandbox_mode

    probes.push({
      company_name: company.company_name,
      domain: company.domain,
      service_shop_score: company.service_shop_score,
      priority: company.priority,
      query_executed: result.search_executable,
      http_status: result.http_status,
      records_returned: result.contacts_returned,
      names_count: counts.names_count,
      titles_count: counts.titles_count,
      emails_count: counts.emails_count,
      phones_count: counts.phones_count,
      provider_message: result.message ?? result.error,
      query_summary: result.query_summary,
      env_sandbox_mode: deployed_diagnostics.loaders.pdl_sandbox_enabled,
      effective_sandbox_mode,
      endpoint_mode: effective_sandbox_mode ? "sandbox" : "live",
      probe_channel: result.channel,
      persisted: false,
    })
  }

  return buildCoverageAuditFromProbes({ probes, deployed_diagnostics })
}
