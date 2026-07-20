/**
 * GE-AIOS-PROSPECT-SEARCH-ICP-YIELD-OPTIMIZATION-AUDIT-1A — Read-only Production ICP replay audit.
 */
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { projectApprovedBusinessProfileToSupportedServiceVerticals } from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import {
  resolveDatamoonCompanyGeography,
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
  resolveDatamoonProspectCompanyIdentityKey,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const TAXONOMY_DEPLOY_ISO = "2026-07-16T01:21:31.000Z"
const TARGET_AUDIENCES = ["5962", "5965", "5974", "5987"] as const

const REASON_FUNCTION_MAP: Record<string, { function: string; rule: string }> = {
  industry: {
    function: "explainProspectSearchFilterDrop → matchesProspectSearchIndustryGate",
    rule: "industry_aliases OR filters.industry must match company industry/keyword blob (external_discovery)",
  },
  keywords: {
    function: "explainProspectSearchFilterDrop → filters.keywords",
    rule: "external_discovery: SOME operational keyword must appear in buildExternalDiscoveryKeywordBlob",
  },
  location: {
    function: "explainProspectSearchFilterDrop → filters.location",
    rule: "location substring must appear in company geo fields when territory_filter inactive",
  },
  territory: {
    function: "explainProspectSearchFilterDrop → filters.territory_filter",
    rule: "rowMatchesTerritoryFilter must pass",
  },
  service_area: {
    function: "explainProspectSearchFilterDrop → filters.service_area",
    rule: "service_area substring match required",
  },
  naics_codes: {
    function: "explainProspectSearchFilterDrop → rowMatchesProspectSearchIndustryCodeFilters",
    rule: "preferred/excluded NAICS/SIC codes (skipped when codes absent in external_discovery)",
  },
  existing_account_mode: {
    function: "explainProspectSearchFilterDrop → filters.existing_account_mode",
    rule: "exclude existing CRM accounts",
  },
  suppression_mode: {
    function: "explainProspectSearchFilterDrop → filters.suppression_mode",
    rule: "exclude suppressed domains/companies",
  },
}

function buildProviderEvidenceKeywords(normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>): string[] {
  return [
    normalized.primary_industry,
    normalized.job_title,
    normalized.department,
    ...normalized.naics_codes.map((code) => `naics ${code}`),
    ...normalized.sic_codes.map((code) => `sic ${code}`),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function rawToImportRecord(
  runId: string,
  index: number,
  raw: Record<string, unknown>,
  status: string,
): DatamoonAudienceImportRecord {
  const normalized = normalizeDatamoonAudienceRecord(raw)
  return {
    id: `${runId}:${index}`,
    runId,
    recordIndex: index,
    status: status as DatamoonAudienceImportRecord["status"],
    normalized,
    dedupeRule: null,
    dedupeKey: normalized.company_domain ?? normalized.company_name,
    matchedLeadId: null,
    leadId: null,
    message: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function recordToProspectCompany(record: DatamoonAudienceImportRecord, index: number): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyName = resolveDatamoonCompanyName(normalized)
  const website = resolveDatamoonCompanyWebsite(normalized)
  const companyGeo = resolveDatamoonCompanyGeography(normalized)
  const id =
    resolveDatamoonProspectCompanyIdentityKey(normalized) ??
    record.dedupeKey?.trim() ??
    `datamoon-${record.id}`
  const providerKeywords = buildProviderEvidenceKeywords(normalized)

  return {
    id,
    source_type: "external_discovered",
    company_name: companyName,
    website,
    industry: normalized.primary_industry ?? null,
    subindustry: normalized.department,
    city: companyGeo.city,
    state: companyGeo.state,
    country: companyGeo.country,
    employees: null,
    revenue_range: null,
    location: companyGeo.location,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: normalized.source_confidence === "provider" ? 0.75 : 0.5,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: [
      "Discovered via DataMoon audience search",
      ...(normalized.job_title ? [`Contact role: ${normalized.job_title}`] : []),
      ...(normalized.primary_industry ? [`Provider industry: ${normalized.primary_industry}`] : []),
    ],
    search_intent_category: null,
    growth_lead_id: record.matchedLeadId,
    prospect_id: null,
    customer_id: null,
    rank_score: Math.max(0.1, 100 - index) * 0.01,
    match_reasoning: [
      "Discovered via DataMoon — routed through canonical Prospect Search.",
      normalized.contact_name ? `Contact signal: ${normalized.contact_name}` : "Company-level discovery record.",
      ...(companyGeo.location ? [`Company geography: ${companyGeo.location}`] : []),
      ...(normalized.company_domain ? [`Company domain: ${normalized.company_domain}`] : []),
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: providerKeywords,
    notes: [
      normalized.provider_company_id ? `Provider company id: ${normalized.provider_company_id}` : null,
      normalized.company_linkedin_url ? `Company LinkedIn: ${normalized.company_linkedin_url}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || null,
  }
}

function consolidateRecords(records: DatamoonAudienceImportRecord[]) {
  const eligible = records.filter((r) => r.status === "preview" || r.status === "duplicate")
  const grouped = new Map<string, DatamoonAudienceImportRecord[]>()
  for (const record of eligible) {
    const key =
      resolveDatamoonProspectCompanyIdentityKey(record.normalized) ??
      record.dedupeKey?.trim() ??
      record.id
    const bucket = grouped.get(key) ?? []
    bucket.push(record)
    grouped.set(key, bucket)
  }
  const consolidated: DatamoonAudienceImportRecord[] = []
  let duplicateContactsConsolidated = 0
  for (const bucket of grouped.values()) {
    duplicateContactsConsolidated += Math.max(0, bucket.length - 1)
    consolidated.push(bucket[0]!)
  }
  return { consolidated, duplicateContactsConsolidated, previewContactCount: eligible.length }
}

async function auditAudience(
  admin: import("@supabase/supabase-js").SupabaseClient,
  audienceId: string,
  filters: ReturnType<typeof buildProspectSearchFiltersFromBusinessProfile>,
) {
  const { data: run } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .eq("datamoon_audience_id", audienceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!run) return { audienceId, found: false }

  const meta = (run.provider_metadata as Record<string, unknown>) ?? {}
  const targeting = meta.targeting_strategy as Record<string, unknown> | undefined
  const firmographic = meta.firmographic_strategy as Record<string, unknown> | undefined

  const { data: dbRecords, count: recordCount } = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("provider_record, normalized_payload, status, dedupe_rule, message", { count: "exact" })
    .eq("run_id", run.id)

  const importRecords = (dbRecords ?? []).map((row, index) => {
    const normalizedPayload = (row as { normalized_payload?: DatamoonAudienceImportRecord["normalized"] })
      .normalized_payload
    const providerRecord =
      (row as { provider_record?: Record<string, unknown> }).provider_record ?? {}
    const normalized =
      normalizedPayload && Object.keys(normalizedPayload).length > 0
        ? normalizedPayload
        : normalizeDatamoonAudienceRecord(providerRecord)
    return {
      id: `${run.id}:${index}`,
      runId: run.id,
      recordIndex: index,
      status: String((row as { status: string }).status) as DatamoonAudienceImportRecord["status"],
      normalized,
      dedupeRule: (row as { dedupe_rule?: string | null }).dedupe_rule ?? null,
      dedupeKey: null,
      matchedLeadId: null,
      leadId: null,
      message: (row as { message?: string | null }).message ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies DatamoonAudienceImportRecord
  })

  const { consolidated, duplicateContactsConsolidated, previewContactCount } = consolidateRecords(importRecords)
  const companies = consolidated.map((record, index) => recordToProspectCompany(record, index))

  const rejections: Array<{
    company: string
    reason: string
    function: string
    rule: string
    sourceEvidence: Record<string, unknown>
  }> = []

  for (const company of companies) {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    if (reason) {
      const mapped = REASON_FUNCTION_MAP[reason] ?? {
        function: "explainProspectSearchFilterDrop",
        rule: reason,
      }
      rejections.push({
        company: company.company_name ?? company.id,
        reason,
        function: mapped.function,
        rule: mapped.rule,
        sourceEvidence: {
          industry: company.industry,
          website: company.website,
          location: company.location,
          state: company.state,
          keywords: company.keywords,
          signals: company.signals,
          notes: company.notes,
        },
      })
    }
  }

  const filtered = applyProspectSearchExternalCompanyFilters(companies, filters)
  const survivors = filtered.companies

  const keywordOnlyFails = rejections.filter((row) => {
    if (row.reason !== "keywords") return false
    const company = companies.find((c) => (c.company_name ?? c.id) === row.company)
    if (!company) return false
    const withoutKeywords = explainProspectSearchFilterDrop(
      company,
      { ...filters, keywords: undefined },
      { external_discovery: true },
    )
    return withoutKeywords === null || withoutKeywords === "industry"
  })

  const leads = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, metadata, created_at")
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .contains("metadata", { datamoon_audience_id: audienceId } as never)
    .limit(50)
    .then((r) => r.data ?? [])
    .catch(() => [])

  const admission = { accepted: 0, review: 0, rejected: 0, pending: 0 }
  for (const lead of leads) {
    const state = resolveLeadAdmissionStateFromMetadata(
      (lead as { metadata?: Record<string, unknown> }).metadata,
    )
    if (state === "accepted") admission.accepted += 1
    else if (state === "review") admission.review += 1
    else if (state === "rejected") admission.rejected += 1
    else admission.pending += 1
  }

  const providerIndustries = [...new Set(companies.map((c) => c.industry).filter(Boolean))]

  return {
    audienceId,
    found: true,
    runId: run.id,
    status: run.status,
    createdAt: run.created_at,
    completedAt: run.completed_at,
    operationalCluster: targeting?.operationalCluster ?? null,
    rotationIndex: targeting?.rotationIndex ?? null,
    taxonomyVersion: firmographic?.primaryIndustryTaxonomyVersion ?? null,
    primaryIndustryValues: firmographic?.primaryIndustryValues ?? null,
    pipelineCounts: {
      raw: run.record_count ?? 0,
      preview: run.preview_count ?? 0,
      persistedImportRecords: recordCount ?? 0,
      previewContactsBeforeConsolidation: previewContactCount,
      normalizedCompanies: companies.length,
      distinctCompanies: companies.length,
      duplicateContactsConsolidated,
      icpSurvivors: survivors.length,
      selectedCompanies: survivors.length,
    },
    providerIndustryMix: providerIndustries,
    rejectionSummary: filtered.diagnostics.dropped_reasons,
    rejections,
    acceptedCompanies: survivors.map((c) => ({
      company: c.company_name,
      industry: c.industry,
      website: c.website,
      keywords: c.keywords,
    })),
    keywordOnlyRejectCount: keywordOnlyFails.length,
    intake: {
      leadsLinked: leads.length,
      admission,
    },
  }
}

async function main() {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const approved = await getActiveApprovedBusinessProfile(admin, EQUIPIFY_PRODUCTION_ORG_ID)
  const profile = approved?.profile ?? null
  if (!profile) throw new Error("no_active_business_profile")

  const filters = buildProspectSearchFiltersFromBusinessProfile(profile)
  const ssv = projectApprovedBusinessProfileToSupportedServiceVerticals(profile, "Equipify")
  const kill = await getRuntimeKillSwitchStates(admin)

  const { data: postTaxonomyRuns } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("datamoon_audience_id, created_at, status, provider_metadata")
    .gte("created_at", TAXONOMY_DEPLOY_ISO)
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  const industrialPostTaxonomy = (postTaxonomyRuns ?? []).filter((row) => {
    const meta = (row.provider_metadata as Record<string, unknown>) ?? {}
    const targeting = meta.targeting_strategy as { operationalCluster?: string } | undefined
    return targeting?.operationalCluster === "Industrial & Material Handling"
  })

  const audienceIds = [...new Set([...TARGET_AUDIENCES, ...industrialPostTaxonomy.map((r) => String(r.datamoon_audience_id))])]
  const audits = []
  for (const audienceId of audienceIds) {
    if (!audienceId || audienceId === "null") continue
    audits.push(await auditAudience(admin, audienceId, filters))
  }

  const allRejections = audits.flatMap((a) => (a.found ? a.rejections : []))
  const rankMap = new Map<string, number>()
  for (const row of allRejections) {
    rankMap.set(row.reason, (rankMap.get(row.reason) ?? 0) + 1)
  }
  const ranked = [...rankMap.entries()]
    .map(([reason, count]) => ({
      rejectRule: reason,
      count,
      pct: allRejections.length > 0 ? Math.round((count / allRejections.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  console.log(
    JSON.stringify(
      {
        qaMarker: "ge-aios-prospect-search-icp-yield-optimization-audit-1a-v1",
        taxonomyDeployIso: TAXONOMY_DEPLOY_ISO,
        icpFilterSnapshot: {
          industryAliasCount: filters.industry_aliases?.length ?? 0,
          operationalKeywordCount: filters.keywords?.length ?? 0,
          qualificationCriteriaCount: filters.qualification_criteria?.length ?? 0,
          operationalEvidenceRequirementCount: filters.operational_evidence_requirements?.length ?? 0,
          naicsCodeCount: filters.naics_codes?.length ?? 0,
          location: filters.location,
          note: "qualification_criteria and operational_evidence_requirements are NOT enforced in explainProspectSearchFilterDrop",
        },
        ssvOperationalKeywordsSample: ssv.prospectSearch.operationalKeywords.slice(0, 12),
        ssvIndustryAliasesSample: ssv.prospectSearch.industryAliases.slice(0, 12),
        postTaxonomyIndustrialAudiencesFound: industrialPostTaxonomy.map((r) => r.datamoon_audience_id),
        killSwitches: { autonomy_outbound_enabled: kill.autonomy_outbound_enabled },
        audienceAudits: audits,
        rankedRejectionReasons: ranked,
        architecture: {
          businessProfile: "unchanged (read active approved profile)",
          ssv: "unchanged (projection read-only)",
          omt: "unchanged",
          providerTaxonomy: "deployed e8312568",
          prospectSearchAuthority: "explainProspectSearchFilterDrop + applyProspectSearchExternalCompanyFilters",
          admission: "unchanged",
          research: "downstream of intake",
        },
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
