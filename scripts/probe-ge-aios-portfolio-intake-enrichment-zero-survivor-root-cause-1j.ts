/**
 * GE-AIOS-PORTFOLIO-INTAKE-ENRICHMENT-ZERO-SURVIVOR-ROOT-CAUSE-1J — Read-only audit vs scheduler path comparison.
 */
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { projectApprovedBusinessProfileToSupportedServiceVerticals } from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { listDatamoonAudienceImportRecords } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { loadDatamoonRunProspectCompaniesForPushRevalidation } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import {
  explainProspectSearchFilterDrop,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import { shouldMarkAutonomousRunIntakeCompleted } from "@/lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"
import { applyTerritoryFiltersToSearchInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"
import { loadPortfolioIntakeSurvivorsFromProduction } from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"
import type { GrowthProspectSearchCompanyResult, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

const QA_MARKER = "ge-aios-portfolio-intake-enrichment-zero-survivor-root-cause-1j-v1" as const

const TARGET_RUNS = [
  { audience: "6062", runId: "66dc98a4-35f7-48dd-8fa2-9e26be81c556" },
  { audience: "6059", runId: "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a" },
] as const

const TARGET_COMPANIES = [
  "Baker Hughes Company",
  "Steris Corporation",
  "Mcdonalds Usa, Llc",
  "Thompson Scale Company",
  "Crown Equipment Corporation",
  "Stowers Machinery Corporation",
] as const

function explainExternalDrop(row: GrowthProspectSearchCompanyResult, filters: GrowthProspectSearchFilters): string | null {
  const filtersWithoutKeywords: GrowthProspectSearchFilters = { ...filters, keywords: undefined }
  return explainProspectSearchFilterDrop(row, filtersWithoutKeywords, { external_discovery: true })
}

function filterSnapshot(filters: GrowthProspectSearchFilters) {
  return {
    industry: filters.industry,
    industry_aliases: filters.industry_aliases,
    location: filters.location,
    territory_filter: filters.territory_filter,
    territory_id: filters.territory_id,
    keywords: filters.keywords,
    naics_codes: filters.naics_codes,
    excluded_naics_codes: filters.excluded_naics_codes,
    sic_codes: filters.sic_codes,
    excluded_sic_codes: filters.excluded_sic_codes,
    suppression_mode: filters.suppression_mode,
    existing_account_mode: filters.existing_account_mode,
    supported_service_vertical_ids: filters.supported_service_vertical_ids,
    qualification_criteria: filters.qualification_criteria,
  }
}

function findCompany(companies: GrowthProspectSearchCompanyResult[], name: string) {
  const needle = name.toLowerCase()
  return companies.find((c) => c.company_name?.toLowerCase().includes(needle.split(" ")[0]!))
}

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID

  const approved = await getActiveApprovedBusinessProfile(admin, orgId)
  if (!approved?.profile) throw new Error("no_profile")

  const query = buildProspectSearchQueryFromBusinessProfile(approved.profile, null)
  const profileFilters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)
  const parsed = parseProspectSearchQuery(query)
  const baseFilters = mergeParsedQueryIntoFilters(parsed, profileFilters) as GrowthProspectSearchFilters
  const schedulerFilters = normalizeProspectSearchFilters(
    await applyTerritoryFiltersToSearchInput(admin, baseFilters),
  )
  const projection = projectApprovedBusinessProfileToSupportedServiceVerticals(approved.profile)

  const auditLoad = await loadPortfolioIntakeSurvivorsFromProduction({ admin, organizationId: orgId })

  const runReports = []

  for (const spec of TARGET_RUNS) {
    const records = await listDatamoonAudienceImportRecords(admin, spec.runId)
    const reloaded = await loadDatamoonRunProspectCompaniesForPushRevalidation(admin, {
      organizationId: orgId,
      datamoonRunId: spec.runId,
      filters: schedulerFilters,
    })
    if (!reloaded) throw new Error(`run_not_found:${spec.runId}`)
    const normalizedCompanies = reloaded.companies

    const auditFiltered = applyProspectSearchExternalCompanyFilters(normalizedCompanies, profileFilters)
    const schedulerEnriched = await enrichProspectSearchExternalCompanies(admin, normalizedCompanies, {
      query,
      filters: schedulerFilters,
      parsed,
    })

    const dimensionCompare = {
      organizationId: { audit: orgId, scheduler: orgId, match: true },
      approvedProfileRowId: { audit: approved.id, scheduler: approved.id, match: true },
      query: { audit: query, scheduler: query, match: true },
      discoveryMode: { audit: "audit_loader_only", scheduler: "discover_external", match: false },
      discoveryAuthority: { audit: "n/a", scheduler: "autonomous_portfolio", match: false },
      runId: { audit: spec.runId, scheduler: spec.runId, match: true },
      rawRecords: {
        audit: records.filter((r) => r.status === "preview" || r.status === "duplicate").length,
        scheduler: records.filter((r) => r.status === "preview" || r.status === "duplicate").length,
        match: true,
      },
      normalizedCompanies: {
        audit: normalizedCompanies.length,
        scheduler: normalizedCompanies.length,
        match: true,
      },
      industryAliases: {
        audit: profileFilters.industry_aliases,
        scheduler: schedulerFilters.industry_aliases,
        match: JSON.stringify(profileFilters.industry_aliases) === JSON.stringify(schedulerFilters.industry_aliases),
      },
      keywords: {
        audit: profileFilters.keywords,
        scheduler: schedulerFilters.keywords,
        match: JSON.stringify(profileFilters.keywords) === JSON.stringify(schedulerFilters.keywords),
      },
      keywordDeferral: {
        audit: Boolean(profileFilters.keywords?.length),
        scheduler: Boolean(schedulerFilters.keywords?.length),
        match: true,
      },
      territoryFilter: {
        audit: profileFilters.territory_filter ?? null,
        scheduler: schedulerFilters.territory_filter ?? null,
        match: JSON.stringify(profileFilters.territory_filter ?? null) === JSON.stringify(schedulerFilters.territory_filter ?? null),
      },
      location: {
        audit: profileFilters.location,
        scheduler: schedulerFilters.location,
        match: profileFilters.location === schedulerFilters.location,
      },
      parsedIndustryHint: {
        audit: null,
        scheduler: parsed.industry_hints[0] ?? null,
        match: parsed.industry_hints[0] == null,
      },
      mergedIndustryField: {
        audit: profileFilters.industry,
        scheduler: schedulerFilters.industry,
        match: profileFilters.industry === schedulerFilters.industry,
      },
      finalSurvivors: {
        audit: auditFiltered.companies.length,
        scheduler: schedulerEnriched.companies.length,
        match: auditFiltered.companies.length === schedulerEnriched.companies.length,
      },
    }

    const firstDivergence =
      !dimensionCompare.territoryFilter.match
        ? "territory_filter: audit omits normalizeProspectSearchFilters mergeLocationTextIntoTerritoryFilter"
        : !dimensionCompare.mergedIndustryField.match
          ? "filters.industry: scheduler mergeParsedQueryIntoFilters sets industry from query"
          : !dimensionCompare.finalSurvivors.match
            ? "final_survivor_count"
            : null

    const auditSurvivorNames = auditLoad.survivors
      .filter((s) => s.runId === spec.runId)
      .map((s) => s.company.company_name)

    const companyLedger = TARGET_COMPANIES.map((name) => {
      const raw = findCompany(normalizedCompanies, name)
      if (!raw) {
        return { company: name, presentInRun: false }
      }
      const auditReason = explainExternalDrop(raw, profileFilters)
      const enrichedRaw =
        schedulerEnriched.raw_companies.find((c) => c.id === raw.id) ??
        findCompany(schedulerEnriched.raw_companies, name)
      const schedulerReason = enrichedRaw ? explainExternalDrop(enrichedRaw, schedulerFilters) : "missing_after_enrich"
      const bridge = (raw as { datamoon_provider_industry_icp_bridge?: unknown }).datamoon_provider_industry_icp_bridge
      return {
        company: raw.company_name,
        identity: { id: raw.id, website: raw.website },
        providerIndustry: raw.industry,
        bridgedKeywords: raw.keywords?.slice(0, 8),
        bridgeMetadata: bridge ?? null,
        geography: { city: raw.city, state: raw.state, country: raw.country, location: raw.location },
        auditResult: auditReason ? `drop:${auditReason}` : "pass",
        schedulerResult: schedulerReason ? `drop:${schedulerReason}` : "pass",
        firstDifferingRule:
          auditReason !== schedulerReason
            ? {
                audit: auditReason,
                scheduler: schedulerReason,
                evidence: {
                  auditFilters: filterSnapshot(profileFilters),
                  schedulerFilters: filterSnapshot(schedulerFilters),
                  isSuppressed: enrichedRaw?.is_suppressed ?? null,
                  existingCustomer: enrichedRaw?.existing_customer ?? null,
                  existingProspect: enrichedRaw?.existing_prospect ?? null,
                  inRevenueQueue: enrichedRaw?.in_revenue_queue ?? null,
                },
              }
            : null,
      }
    })

    const terminalization = {
      persistedRecordCount: records.length,
      normalizedCompanyCount: normalizedCompanies.length,
      preFilterCompanyCount: normalizedCompanies.length,
      postFilterSurvivorCount: schedulerEnriched.companies.length,
      selectedCount: 0,
      filterDiagnostics: schedulerEnriched.filter_diagnostics,
      auditFilterDiagnostics: auditFiltered.diagnostics,
      shouldMarkIntakeCompleted: shouldMarkAutonomousRunIntakeCompleted({
        selectedCount: 0,
        durableDispositionCount: 0,
        postFilterSurvivorCount: schedulerEnriched.companies.length,
        stopReason: null,
      }),
      auditWouldMarkCompleted: shouldMarkAutonomousRunIntakeCompleted({
        selectedCount: 0,
        durableDispositionCount: 0,
        postFilterSurvivorCount: auditFiltered.companies.length,
        stopReason: null,
      }),
    }

    runReports.push({
      audience: spec.audience,
      runId: spec.runId,
      dimensionCompare,
      firstDivergence,
      auditSurvivorNamesFromLoader1d: auditSurvivorNames,
      droppedReasonsScheduler: schedulerEnriched.filter_diagnostics.dropped_reasons,
      droppedReasonsAudit: auditFiltered.diagnostics.dropped_reasons,
      companyLedger,
      terminalization,
    })
  }

  process.stdout.write(
    JSON.stringify(
      {
        qaMarker: QA_MARKER,
        orgId,
        profile: {
          rowId: approved.id,
          approvalStatus: approved.approval_status,
          approvedAt: approved.approved_at,
          fingerprint: approved.content_fingerprint,
          explicitSsvIds: projection.prospectSearch.supportedServiceVerticalIds,
          industryAliases: projection.prospectSearch.industryAliases,
          geography: projection.discoveryIntent.geography,
          operationalKeywords: projection.prospectSearch.operationalKeywords.slice(0, 8),
          naicsCodes: projection.discoveryIntent.naicsCodes,
          excludedSicCodes: projection.discoveryIntent.excludedSicCodes,
        },
        filterDiff: {
          audit: filterSnapshot(profileFilters),
          scheduler: filterSnapshot(schedulerFilters),
          parsedQuery: parsed,
        },
        runReports,
      },
      null,
      2,
    ),
  )
  process.stdout.write("\n")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
