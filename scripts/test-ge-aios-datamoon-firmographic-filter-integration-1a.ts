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
  DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
  GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER,
  buildDatamoonFirmographicFilterStrategyMetadata,
  buildDatamoonFirmographicFiltersFromCanonicalProjection,
  translateCompanySizeRangeStringsToDatamoonEmployeeBands,
  translateEquipifyCompanySizeIntentToDatamoonEmployeeBands,
  translateRevenueIntentStringsToDatamoonCompanyRevenue,
} from "../lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a"
import { translateDatamoonOperationalModelTargeting } from "../lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
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

console.log(`[${GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER}] firmographic filter integration certification\n`)

const firmographicSource = readSource("lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a.ts")
const ssvSource = readSource("lib/growth/business-profile/business-profile-supported-service-verticals-projection.ts")
const omtSource = readSource("lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a.ts")
const prospectSearchSource = readSource("lib/growth/business-profile/business-profile-prospect-search-projection-1b.ts")

assert.doesNotMatch(firmographicSource, /buildAudience|topic_id/)
assert.doesNotMatch(ssvSource, /datamoon-firmographic-filter-mapping-1a/)
assert.doesNotMatch(omtSource, /datamoon-firmographic-filter-mapping-1a/)
assert.doesNotMatch(prospectSearchSource, /datamoon-firmographic-filter-mapping-1a/)
console.log("  ✓ Business Profile / SSV / OMT / Prospect Search remain provider-neutral")

assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("1-10"), ["1 to 10"])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("11-50"), ["11 to 50"])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("51-200"), ["51 to 200"])
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("201-500"), ["201 to 500"])
assert.ok(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("500+").includes("10000+"))
assert.deepEqual(translateEquipifyCompanySizeIntentToDatamoonEmployeeBands("smb"), ["1 to 10", "11 to 50"])
console.log("  ✓ employee count intent translation")

assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["10-50 employees"]), ["11 to 50"])
assert.deepEqual(translateCompanySizeRangeStringsToDatamoonEmployeeBands(["51-200 employees"]), ["51 to 200"])
assert.ok(
  translateCompanySizeRangeStringsToDatamoonEmployeeBands(["201-1000 employees"]).includes("201 to 500"),
)
assert.ok(
  translateCompanySizeRangeStringsToDatamoonEmployeeBands(["201-1000 employees"]).includes("501 to 1000"),
)
console.log("  ✓ Business Profile companySizeRanges → DataMoon employee bands")

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
const operationalTargeting = translateDatamoonOperationalModelTargeting({
  projection,
  organizationId: ORG,
  audienceOrdinal: 0,
})
const firmographicStrategy = buildDatamoonFirmographicFilterStrategyMetadata({
  projection,
  operationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})
const firmographicFilters = buildDatamoonFirmographicFiltersFromCanonicalProjection({
  projection,
  operationalTargeting,
  companySizeRanges: profile.idealCustomers.companySizeRanges,
})

assert.equal(firmographicStrategy.version, DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION)
assert.ok(firmographicStrategy.primaryIndustryValues.length > 0)
assert.ok(firmographicStrategy.primaryIndustryValues.length <= 5)
assert.ok(firmographicStrategy.companyEmployeeCountBands.length > 0)
assert.equal(firmographicStrategy.companyDomainValues.length, 0)
assert.ok(firmographicFilters.some((filter) => filter.field === "primary_industry"))
assert.ok(firmographicFilters.some((filter) => filter.field === "company_employee_count"))
console.log("  ✓ deterministic industry subset + employee filters from canonical projection")

const requestProjection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile,
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 25,
  generatedAt: "2026-07-15T12:00:00.000Z",
  audienceOrdinal: 0,
})

assert.ok(requestProjection.request.filters.some((filter) => filter.field === "primary_industry"))
assert.ok(requestProjection.request.filters.some((filter) => filter.field === "company_employee_count"))
assert.ok(requestProjection.request.filters.some((filter) => filter.field === "contact_country"))
assert.ok(requestProjection.request.filters.some((filter) => filter.field === "job_title"))
assert.equal(requestProjection.request.workbench_context?.intentLevels?.length, 2)
assert.equal(
  requestProjection.targetingSummary.firmographicStrategy?.version,
  DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
)
assert.equal(
  requestProjection.targetingSummary.targetingStrategy?.version,
  "1a-v1",
)

const validation = validateDatamoonAudienceImportRequest(requestProjection.request)
assert.equal(validation.ok, true, JSON.stringify(validation))
console.log("  ✓ autonomous build request includes firmographic filters and passes validation")

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

console.log(`\nPASS ${GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER}`)
