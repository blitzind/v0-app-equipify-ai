/**
 * GE-AIOS-DATAMOON-PRIMARY-INDUSTRY-TAXONOMY-PRODUCTION-VALIDATION-1A
 * Read-only Production evidence + optional phase argument.
 *
 * Usage:
 *   phase=pre|post|compare|replay
 *   node ... probe-ge-aios-datamoon-primary-industry-taxonomy-production-validation-1a.ts pre
 */
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { appendDatamoonB2bIntentFiltersFromWorkbenchContext } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import {
  countAutonomousProspectSearchDatamoonRunsForOrganization,
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  normalizeDatamoonProviderRecordsForProspectSearch,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export const GE_AIOS_DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_PRODUCTION_VALIDATION_1A_QA_MARKER =
  "ge-aios-datamoon-primary-industry-taxonomy-production-validation-1a-v1" as const

const ORG = EQUIPIFY_PRODUCTION_ORG_ID
const COMPARE_AUDIENCES = ["5962", "5965", "5974"] as const
const OPERATIONAL_ALIAS_LEAKS = [
  "Compressor service",
  "Pump service",
  "Medical equipment service",
  "Medical equipment",
  "Healthcare equipment service",
] as const

type RunRow = Record<string, unknown>

function providerMeta(row: RunRow): Record<string, unknown> {
  return (row.provider_metadata as Record<string, unknown>) ?? {}
}

function extractRunSummary(row: RunRow) {
  const meta = providerMeta(row)
  const targeting = meta.targeting_strategy as Record<string, unknown> | null | undefined
  const firmographic = meta.firmographic_strategy as Record<string, unknown> | null | undefined
  const targetingSummary = meta.targeting_summary as Record<string, unknown> | null | undefined
  const autonomous = meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined
  return {
    id: row.id,
    runName: row.run_name,
    status: row.status,
    datamoonAudienceId: row.datamoon_audience_id ?? null,
    requestedLimit: row.requested_limit,
    recordCount: row.record_count,
    previewCount: row.preview_count,
    importedCount: row.imported_count,
    duplicateCount: row.duplicate_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    lastPolledAt: row.last_polled_at,
    filters: row.filters ?? [],
    topicIds: row.topic_ids ?? [],
    fingerprint: autonomous?.fingerprint ?? targetingSummary?.fingerprint ?? null,
    targetingStrategy: targeting,
    firmographicStrategy: firmographic,
    targetingSummary,
    organizationId: autonomous?.organization_id ?? null,
  }
}

async function fetchRunByAudienceId(
  admin: import("@supabase/supabase-js").SupabaseClient,
  audienceId: string,
) {
  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .eq("datamoon_audience_id", audienceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as RunRow | null
}

async function listAutonomousRuns(
  admin: import("@supabase/supabase-js").SupabaseClient,
  limit = 15,
) {
  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as RunRow[]
}

function preparedProviderFilters(row: RunRow) {
  const filters = Array.isArray(row.filters) ? row.filters : []
  const workbench = (row.workbench_context as Record<string, unknown> | undefined) ?? {}
  return appendDatamoonB2bIntentFiltersFromWorkbenchContext(filters, workbench)
}

async function replayProspectSearchForRun(
  admin: import("@supabase/supabase-js").SupabaseClient,
  runId: string,
  orgId: string,
) {
  const approved = await getActiveApprovedBusinessProfile(admin, orgId).catch(() => null)
  if (!approved?.profile) {
    return { error: "no_active_business_profile" }
  }
  const filters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)
  const { data: records } = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("raw_record, status, message")
    .eq("run_id", runId)
    .in("status", ["preview", "duplicate"])

  const rawRecords = (records ?? [])
    .map((row) => (row as { raw_record?: unknown }).raw_record)
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")

  const normalized = normalizeDatamoonProviderRecordsForProspectSearch(rawRecords)
  const replay = applyProspectSearchExternalCompanyFilters(normalized, filters)
  const industryRejects = normalized.filter((company) => {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    return reason === "industry"
  }).length
  const keywordRejects = normalized.filter((company) => {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    return reason === "keywords"
  }).length
  const geographyRejects = normalized.filter((company) => {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    return reason === "location" || reason === "territory" || reason === "service_area"
  }).length

  const providerIndustries = [...new Set(normalized.map((row) => row.industry).filter(Boolean))].slice(0, 20)

  return {
    rawRecordCount: records?.length ?? 0,
    normalizedCompanyCount: normalized.length,
    providerIndustriesSample: providerIndustries,
    replayDiagnostics: replay.diagnostics,
    survivors: replay.companies.length,
    industryRejects,
    keywordRejects,
    geographyRejects,
  }
}

async function summarizeRecords(
  admin: import("@supabase/supabase-js").SupabaseClient,
  runId: string,
) {
  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("status, raw_record")
    .eq("run_id", runId)
  const byStatus: Record<string, number> = {}
  const industries = new Map<string, number>()
  for (const row of data ?? []) {
    const status = String((row as { status: string }).status)
    byStatus[status] = (byStatus[status] ?? 0) + 1
    const raw = (row as { raw_record?: Record<string, unknown> }).raw_record
    const industry = String(raw?.primary_industry ?? raw?.company_industry ?? "").trim()
    if (industry) industries.set(industry, (industries.get(industry) ?? 0) + 1)
  }
  return {
    total: data?.length ?? 0,
    byStatus,
    topIndustries: [...industries.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([industry, count]) => ({ industry, count })),
  }
}

async function phasePre(admin: import("@supabase/supabase-js").SupabaseClient) {
  const [active, latest, runs, killSwitches, audienceCount, completedCount] = await Promise.all([
    findActiveAutonomousProspectSearchDatamoonRun(admin, ORG),
    findLatestAutonomousProspectSearchDatamoonRun(admin, ORG),
    listAutonomousRuns(admin),
    getRuntimeKillSwitchStates(admin),
    countAutonomousProspectSearchDatamoonRunsForOrganization(admin, ORG),
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("*", { count: "exact", head: true })
      .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
      .in("status", ["completed", "imported"]),
  ])

  const equipifyRuns = runs.filter((row) => {
    const meta = providerMeta(row)
    const autonomous = meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined
    return autonomous?.organization_id === ORG
  })

  return {
    phase: "pre_tick",
    qaMarker: GE_AIOS_DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_PRODUCTION_VALIDATION_1A_QA_MARKER,
    cutoverQaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organizationId: ORG,
    killSwitches: {
      autonomy_enabled: killSwitches.autonomy_enabled,
      autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    },
    autonomousAudienceCount: audienceCount,
    completedAutonomousRunCount: completedCount.count ?? 0,
    activeRun: active ? extractRunSummary(active as unknown as RunRow) : null,
    latestRun: latest ? extractRunSummary(latest as unknown as RunRow) : null,
    recentEquipifyRuns: equipifyRuns.slice(0, 8).map((row) => extractRunSummary(row)),
    expectedAction:
      active != null
        ? "resume_only"
        : audienceCount > 0
          ? "create_or_resume_per_portfolio_policy"
          : "create_first_audience",
  }
}

async function phasePost(
  admin: import("@supabase/supabase-js").SupabaseClient,
  sinceIso?: string,
) {
  const since = sinceIso ?? new Date(Date.now() - 30 * 60_000).toISOString()
  const [active, latest, killSwitches, cronRuns, recentLeads, outboundRecent] = await Promise.all([
    findActiveAutonomousProspectSearchDatamoonRun(admin, ORG),
    findLatestAutonomousProspectSearchDatamoonRun(admin, ORG),
    getRuntimeKillSwitchStates(admin),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("id, cron_route, started_at, finished_at, ok, metrics")
      .eq("cron_route", "/api/cron/growth-objective-runtime-scheduler")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("leads")
      .select("id, status, metadata, created_at, source_channel")
      .eq("organization_id", ORG)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, created_at, channel")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ])

  const focus = latest ?? active
  const focusRow = focus as unknown as RunRow | null
  const preparedFilters = focusRow ? preparedProviderFilters(focusRow) : []
  const primaryIndustryFilter = preparedFilters.find((filter) => filter.field === "primary_industry")
  const employeeCountPresent = preparedFilters.some((filter) => filter.field === "company_employee_count")
  const firmographic = focusRow ? extractRunSummary(focusRow).firmographicStrategy : null
  const targeting = focusRow ? extractRunSummary(focusRow).targetingStrategy : null
  const records = focus ? await summarizeRecords(admin, focus.id) : null
  const replay = focus ? await replayProspectSearchForRun(admin, focus.id, ORG) : null

  const admission = { accepted: 0, review: 0, rejected: 0, invalid: 0, pending: 0 }
  for (const lead of recentLeads.data ?? []) {
    const state = resolveLeadAdmissionStateFromMetadata(
      (lead as { metadata?: Record<string, unknown> }).metadata,
    )
    if (state === "accepted") admission.accepted += 1
    else if (state === "review") admission.review += 1
    else if (state === "rejected") admission.rejected += 1
    else if (state === "invalid") admission.invalid += 1
    else admission.pending += 1
  }

  const primaryValues = Array.isArray(primaryIndustryFilter?.value)
    ? (primaryIndustryFilter!.value as string[])
    : []
  const aliasLeaks = OPERATIONAL_ALIAS_LEAKS.filter((alias) => primaryValues.includes(alias))

  return {
    phase: "post_tick",
    sinceIso: since,
    cronExecutions: cronRuns.data ?? [],
    killSwitches: {
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    },
    focusRun: focusRow ? extractRunSummary(focusRow) : null,
    preparedProviderFilters: preparedFilters,
    providerFilterFields: preparedFilters.map((filter) => filter.field),
    primaryIndustryValues: primaryValues,
    operationalAliasLeaks: aliasLeaks,
    employeeCountPresent,
    firmographicStrategy: firmographic,
    targetingStrategy: targeting,
    providerYield: focusRow
      ? {
          rawRecords: focusRow.record_count,
          previewRecords: focusRow.preview_count,
          recordBreakdown: records,
        }
      : null,
    prospectSearchReplay: replay,
    pipeline: {
      intakeLeadsInWindow: recentLeads.data?.length ?? 0,
      admission,
      outboundMessagesInWindow: outboundRecent.data?.length ?? 0,
    },
    singleFlight: {
      activeRunCount: active ? 1 : 0,
      activeRunId: active?.id ?? null,
      latestRunId: latest?.id ?? null,
      duplicateAudienceRisk: false,
    },
  }
}

async function phaseCompare(admin: import("@supabase/supabase-js").SupabaseClient) {
  const comparisons = []
  for (const audienceId of COMPARE_AUDIENCES) {
    const row = await fetchRunByAudienceId(admin, audienceId)
    if (!row) {
      comparisons.push({ audienceId, found: false })
      continue
    }
    const summary = extractRunSummary(row)
    const preparedFilters = preparedProviderFilters(row)
    const primaryIndustryFilter = preparedFilters.find((filter) => filter.field === "primary_industry")
    const replay = await replayProspectSearchForRun(admin, String(row.id), ORG)
    comparisons.push({
      audienceId,
      found: true,
      status: summary.status,
      recordCount: summary.recordCount,
      previewCount: summary.previewCount,
      operationalCluster:
        (summary.targetingStrategy as { operationalCluster?: string } | null)?.operationalCluster ?? null,
      rotationIndex:
        (summary.targetingStrategy as { rotationIndex?: number } | null)?.rotationIndex ?? null,
      primaryIndustryValues: primaryIndustryFilter?.value ?? null,
      firmographicStrategy: summary.firmographicStrategy,
      fingerprint: summary.fingerprint,
      prospectSearchReplay: replay,
    })
  }
  const latest = await findLatestAutonomousProspectSearchDatamoonRun(admin, ORG)
  if (latest?.datamoonAudienceId && !COMPARE_AUDIENCES.includes(String(latest.datamoonAudienceId) as never)) {
    const row = await fetchRunByAudienceId(admin, String(latest.datamoonAudienceId))
    if (row) {
      const summary = extractRunSummary(row)
      const preparedFilters = preparedProviderFilters(row)
      const primaryIndustryFilter = preparedFilters.find((filter) => filter.field === "primary_industry")
      const replay = await replayProspectSearchForRun(admin, String(row.id), ORG)
      comparisons.push({
        audienceId: String(latest.datamoonAudienceId),
        found: true,
        current: true,
        status: summary.status,
        recordCount: summary.recordCount,
        previewCount: summary.previewCount,
        operationalCluster:
          (summary.targetingStrategy as { operationalCluster?: string } | null)?.operationalCluster ?? null,
        rotationIndex:
          (summary.targetingStrategy as { rotationIndex?: number } | null)?.rotationIndex ?? null,
        primaryIndustryValues: primaryIndustryFilter?.value ?? null,
        firmographicStrategy: summary.firmographicStrategy,
        fingerprint: summary.fingerprint,
        prospectSearchReplay: replay,
      })
    }
  }
  return { phase: "compare", comparisons }
}

async function main() {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const phase = process.argv[2] ?? "pre"
  const sinceIso = process.argv[3]

  if (phase === "pre") {
    console.log(JSON.stringify(await phasePre(admin), null, 2))
    return
  }
  if (phase === "post") {
    console.log(JSON.stringify(await phasePost(admin, sinceIso), null, 2))
    return
  }
  if (phase === "compare") {
    console.log(JSON.stringify(await phaseCompare(admin), null, 2))
    return
  }
  throw new Error(`unknown_phase:${phase}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
