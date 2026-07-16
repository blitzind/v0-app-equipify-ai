/**
 * GE-AIOS-DATAMOON-FIRMOGRAPHIC-FILTER-INTEGRATION-1A — Firmographic filter integration certification.
 * Run: pnpm test:ge-aios-datamoon-firmographic-filter-integration-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildProspectSearchFiltersFromBusinessProfile } from "../lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP,
  DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
  DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS,
  DATAMOON_LIVE_MODULE_EMPLOYEE_COUNT_CONTRACT_VERSION,
  DATAMOON_LIVE_MODULE_REJECTED_DOC_EMPLOYEE_COUNT_BANDS,
  DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY,
  GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER,
  buildDatamoonFirmographicFilterStrategyMetadata,
  buildDatamoonFirmographicFiltersFromCanonicalProjection,
  resolveLiveModuleCompanyEmployeeCountBands,
  translateCompanySizeRangeStringsToDatamoonEmployeeBands,
  translateEquipifyCompanySizeIntentToDatamoonEmployeeBands,
  translateRevenueIntentStringsToDatamoonCompanyRevenue,
} from "../lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a"
import { translateDatamoonOperationalModelTargeting } from "../lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import {
  DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION,
  DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES,
  GROWTH_DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_1A_QA_MARKER,
  isDatamoonProvenPrimaryIndustryTaxonomyValue,
  listAdjacentClusterVerticalIds,
  resolveDatamoonPrimaryIndustryTaxonomyFromCanonicalProjection,
} from "../lib/growth/lead-sources/datamoon/datamoon-primary-industry-taxonomy-1a"
import {
  DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS,
  isDatamoonProviderSupportedFilterField,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "../lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function equipifyProfile(): BusinessProfileDraftContent {
  return buildLive1bEquipifyCompanyProfileContent()
}

function assertNeverEmitsRejectedBands(bands: readonly string[], label: string) {
  for (const rejected of DATAMOON_LIVE_MODULE_REJECTED_DOC_EMPLOYEE_COUNT_BANDS) {
    assert.equal(
      bands.includes(rejected),
      false,
      `${label} must not emit rejected band ${rejected}`,
    )
  }
}

console.log(`[${GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER}] firmographic filter integration certification\n`)

const firmographicSource = readSource("lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a.ts")
const taxonomySource = readSource("lib/growth/lead-sources/datamoon/datamoon-primary-industry-taxonomy-1a.ts")
const ssvSource = readSource("lib/growth/business-profile/business-profile-supported-service-verticals-projection.ts")
const omtSource = readSource("lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a.ts")
const prospectSearchSource = readSource("lib/growth/business-profile/business-profile-prospect-search-projection-1b.ts")

assert.doesNotMatch(firmographicSource, /buildAudience|topic_id/)
assert.doesNotMatch(ssvSource, /datamoon-firmographic-filter-mapping-1a|datamoon-primary-industry-taxonomy-1a/)
assert.doesNotMatch(omtSource, /datamoon-firmographic-filter-mapping-1a|datamoon-primary-industry-taxonomy-1a/)
assert.doesNotMatch(prospectSearchSource, /datamoon-firmographic-filter-mapping-1a|datamoon-primary-industry-taxonomy-1a/)
assert.doesNotMatch(taxonomySource, /DATAMOON_OMT_CLUSTER_PRIMARY_INDUSTRY_TAXONOMY[\s\S]*medical|Hospitals And Health Care/)
assert.doesNotMatch(taxonomySource, /industryAliases|industryAliasesUsed/)
assert.match(firmographicSource, /datamoon-primary-industry-taxonomy-1a/)
console.log("  ✓ Scenario F — Business Profile / SSV / OMT / Prospect Search remain provider-neutral")

assert.deepEqual(DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS, [
  "1 to 10",
  "501 to 1000",
  "1001 to 5000",
  "5001 to 10000",
  "10000+",
])
assert.match(firmographicSource, /11 to 50.*rejected|rejects them/)
console.log("  ✓ live module employee-count contract replaces documented middle bands")

assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("1-10"), ["1 to 10"])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("11-50"), [])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("51-200"), [])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("201-500"), [])
assert.ok(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("500+").includes("501 to 1000"))
assert.ok(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("500+").includes("10000+"))
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("smb"), [])
console.log("  ✓ workbench size intent uses live module contract only")

const scenarioA = resolveLiveModuleCompanyEmployeeCountBands({
  companySizeRanges: ["10-50 employees", "51-200 employees", "201-1000 employees"],
})
assert.deepEqual(scenarioA.bands, [])
assert.equal(scenarioA.omissionReason, DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP)
assertNeverEmitsRejectedBands(scenarioA.bands, "Scenario A")
console.log("  ✓ Scenario A — Equipify ranges omit employee-count filter")

assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["1-10 employees"]), ["1 to 10"])
console.log("  ✓ Scenario B — 1–10 maps to 1 to 10")

assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["501-1000 employees"]), [
  "501 to 1000",
])
console.log("  ✓ Scenario C — explicit 501–1000 maps to 501 to 1000 only")

const scenarioD = translateCompanySizeRangeStringsToDatamoonEmployeeBands(["501-5000 employees"])
assert.deepEqual(scenarioD, ["501 to 1000", "1001 to 5000"])
assertNeverEmitsRejectedBands(scenarioD, "Scenario D")
console.log("  ✓ Scenario D — multiple proven upper bands when range is fully coverable")

for (const rejected of DATAMOON_LIVE_MODULE_REJECTED_DOC_EMPLOYEE_COUNT_BANDS) {
  assert.equal(
    DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS.includes(rejected as never),
    false,
    `live contract must not include ${rejected}`,
  )
}
assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["10-50 employees"]), [])
assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["51-200 employees"]), [])
assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["201-500 employees"]), [])
console.log("  ✓ Scenario E — rejected middle ranges are never emitted")

assert.deepEqual(translateRevenueIntentStringsToDatamoonCompanyRevenue(["11-50 employees"]), [])
assert.deepEqual(translateRevenueIntentStringsToDatamoonCompanyRevenue(["1-10 million revenue"]), [
  "1 million to 10 million",
])
assert.deepEqual(translateRevenueIntentStringsToDatamoonCompanyRevenue(["under 1 million"]), [
  "under 1 million",
])
console.log("  ✓ revenue translation only when canonical revenue intent is present")

for (const field of ["primary_industry", "company_employee_count", "company_revenue", "company_domain"]) {
  assert.equal(isDatamoonProviderSupportedFilterField(field), true, `allowlist missing ${field}`)
}
assert.equal(DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS.includes("company_naics" as never), false)
assert.equal(DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS.includes("company_sic" as never), false)
console.log("  ✓ validation allowlist expanded without NAICS/SIC/technology fields")

const profile = equipifyProfile()
const projection = projectApprovedBusinessProfileToLeadDiscovery(profile, "Equipify")

const INDUSTRIAL_AUDIENCE_ORDINAL = 12
const industrialOperationalTargeting = translateDatamoonOperationalModelTargeting({
  projection,
  organizationId: ORG,
  audienceOrdinal: INDUSTRIAL_AUDIENCE_ORDINAL,
})
assert.equal(industrialOperationalTargeting.operationalCluster, "Industrial & Material Handling")

const industrialTaxonomy = resolveDatamoonPrimaryIndustryTaxonomyFromCanonicalProjection({
  projection,
  operationalTargeting: industrialOperationalTargeting,
})
assert.deepEqual(industrialTaxonomy.values, [
  "Machinery Manufacturing",
  "Industrial Machinery Manufacturing",
])
assert.equal(industrialTaxonomy.applied, true)
assert.equal(industrialTaxonomy.omissionReason, null)
assert.equal(industrialTaxonomy.taxonomyVersion, DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION)
assert.equal(industrialTaxonomy.sourceCluster, "Industrial & Material Handling")

const industrialStrategy = buildDatamoonFirmographicFilterStrategyMetadata({
  projection,
  operationalTargeting: industrialOperationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})
const industrialFilters = buildDatamoonFirmographicFiltersFromCanonicalProjection({
  projection,
  operationalTargeting: industrialOperationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})
const industrialPrimaryFilter = industrialFilters.find((filter) => filter.field === "primary_industry")
assert.ok(industrialPrimaryFilter)
assert.equal(industrialPrimaryFilter!.operator, "in")
assert.deepEqual(industrialPrimaryFilter!.value, [
  "Machinery Manufacturing",
  "Industrial Machinery Manufacturing",
])

const operationalAliases = new Set(
  projection.supportedServiceVerticals.flatMap((vertical) => vertical.industryAliases),
)
for (const value of industrialStrategy.primaryIndustryValues) {
  assert.equal(operationalAliases.has(value), false, `operational alias leaked: ${value}`)
  assert.match(value, /Manufacturing/, "expected provider taxonomy not operational alias")
}
console.log("  ✓ Scenario A — Industrial cluster emits proven provider taxonomy only")

const adjacentVerticalIds = listAdjacentClusterVerticalIds({
  projection,
  operationalTargeting: industrialOperationalTargeting,
})
assert.ok(adjacentVerticalIds.length > 0, "expected adjacent vertical ids for isolation check")
const medicalAdjacentAliases = projection.supportedServiceVerticals
  .filter((vertical) => adjacentVerticalIds.includes(vertical.id))
  .flatMap((vertical) => vertical.industryAliases)
assert.ok(medicalAdjacentAliases.some((alias) => /medical|healthcare|biomedical/i.test(alias)))
for (const alias of medicalAdjacentAliases) {
  assert.equal(
    industrialStrategy.primaryIndustryValues.includes(alias),
    false,
    `adjacent medical alias must not bleed into industrial filter: ${alias}`,
  )
}
console.log("  ✓ Scenario B — adjacent-cluster verticals do not bleed into primary-industry filter")

const unmappedOperationalTargeting = translateDatamoonOperationalModelTargeting({
  projection,
  organizationId: ORG,
  audienceOrdinal: 0,
})
const unmappedStrategy = buildDatamoonFirmographicFilterStrategyMetadata({
  projection,
  operationalTargeting: unmappedOperationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})
const unmappedFilters = buildDatamoonFirmographicFiltersFromCanonicalProjection({
  projection,
  operationalTargeting: unmappedOperationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})
assert.equal(unmappedStrategy.primaryIndustryFilterApplied, false)
assert.equal(unmappedStrategy.primaryIndustryValues.length, 0)
assert.equal(
  unmappedStrategy.primaryIndustryFilterOmissionReason,
  DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY,
)
assert.equal(
  unmappedFilters.some((filter) => filter.field === "primary_industry"),
  false,
)
console.log("  ✓ Scenario C — unmapped cluster omits primary_industry with fail-closed reason")

for (const value of industrialStrategy.primaryIndustryValues) {
  assert.equal(isDatamoonProvenPrimaryIndustryTaxonomyValue(value), true, `unproven taxonomy value: ${value}`)
}
assert.deepEqual([...DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES], [
  "Machinery Manufacturing",
  "Industrial Machinery Manufacturing",
])
console.log("  ✓ Scenario D — every emitted value exists in proven taxonomy registry")

assert.deepEqual(unmappedStrategy.companyEmployeeCountBands, [])
assert.equal(unmappedStrategy.employeeCountFilterApplied, false)
assert.equal(
  unmappedStrategy.employeeCountFilterOmissionReason,
  DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP,
)
assert.equal(
  unmappedStrategy.liveProviderEmployeeCountContractVersion,
  DATAMOON_LIVE_MODULE_EMPLOYEE_COUNT_CONTRACT_VERSION,
)
console.log("  ✓ Scenario E — Equipify employee-count filter remains omitted")

const operationalTargeting = unmappedOperationalTargeting
const firmographicStrategy = unmappedStrategy
const firmographicFilters = unmappedFilters

assert.equal(firmographicStrategy.version, DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION)
assert.equal(firmographicStrategy.primaryIndustryFilterApplied, false)
assert.equal(firmographicStrategy.primaryIndustryTaxonomyVersion, DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION)
assert.ok(firmographicStrategy.primaryIndustrySourceCluster.length > 0)
assert.equal(firmographicStrategy.companyDomainValues.length, 0)
assert.equal(
  firmographicFilters.some((filter) => filter.field === "company_employee_count"),
  false,
)
console.log("  ✓ Equipify firmographic metadata + filters omit employee count with reason")

const industrialRequestProjection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile,
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 25,
  generatedAt: "2026-07-15T12:00:00.000Z",
  audienceOrdinal: INDUSTRIAL_AUDIENCE_ORDINAL,
})

const industrialRequestPrimaryFilter = industrialRequestProjection.request.filters.find(
  (filter) => filter.field === "primary_industry",
)
assert.ok(industrialRequestPrimaryFilter)
assert.deepEqual(industrialRequestPrimaryFilter!.value, [
  "Machinery Manufacturing",
  "Industrial Machinery Manufacturing",
])
assert.equal(
  industrialRequestProjection.request.filters.some((filter) => filter.field === "company_employee_count"),
  false,
)
assert.ok(industrialRequestProjection.request.filters.some((filter) => filter.field === "contact_country"))
assert.ok(industrialRequestProjection.request.filters.some((filter) => filter.field === "job_title"))
assert.equal(industrialRequestProjection.request.workbench_context?.intentLevels?.length, 2)
assert.equal(
  industrialRequestProjection.targetingSummary.firmographicStrategy?.primaryIndustryFilterApplied,
  true,
)
assert.equal(
  industrialRequestProjection.targetingSummary.firmographicStrategy?.primaryIndustrySourceCluster,
  "Industrial & Material Handling",
)
assert.equal(
  industrialRequestProjection.targetingSummary.firmographicStrategy?.employeeCountFilterApplied,
  false,
)
assert.equal(
  industrialRequestProjection.targetingSummary.firmographicStrategy?.employeeCountFilterOmissionReason,
  DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP,
)

const requestProjection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile,
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 25,
  generatedAt: "2026-07-15T12:00:00.000Z",
  audienceOrdinal: 0,
})

assert.equal(
  requestProjection.request.filters.some((filter) => filter.field === "primary_industry"),
  false,
)
assert.equal(
  requestProjection.request.filters.some((filter) => filter.field === "company_employee_count"),
  false,
)
assert.ok(requestProjection.request.filters.some((filter) => filter.field === "contact_country"))
assert.ok(requestProjection.request.filters.some((filter) => filter.field === "job_title"))
assert.equal(requestProjection.request.workbench_context?.intentLevels?.length, 2)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.version,
  DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.primaryIndustryFilterApplied,
  false,
)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.primaryIndustryFilterOmissionReason,
  DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY,
)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.employeeCountFilterApplied,
  false,
)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.employeeCountFilterOmissionReason,
  DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP,
)
assert.equal(
  requestProjection.targetingSummary.targetingStrategy?.version,
  "1a-v1",
)

const validation = validateDatamoonAudienceImportRequest(requestProjection.request)
assert.equal(validation.ok, true, JSON.stringify(validation))
console.log("  ✓ autonomous build request passes validation without rejected employee bands")

const prospectFilters = buildProspectSearchFiltersFromBusinessProfile(profile)
assert.equal(prospectFilters.industry, null)
assert.ok((prospectFilters.industry_aliases?.length ?? 0) > 10)
console.log("  ✓ Prospect Search ICP unchanged")

assert.match(readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts"), /firmographic_strategy/)
assert.match(
  readSource("lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts"),
  /buildDatamoonFirmographicFiltersFromCanonicalProjection/,
)
assert.match(readSource("lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping.ts"), /DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS/)
console.log("  ✓ metadata + wiring hooks present")

console.log(`\nPASS ${GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER} ${GROWTH_DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_1A_QA_MARKER}`)
