/**
 * GE-DATAMOON-FILTER-MAPPING-FIX-1 — Datamoon provider filter mapping certification.
 * Run: pnpm test:ge-datamoon-filter-mapping-fix-1
 */
import assert from "node:assert/strict"
import {
  buildDatamoonFiltersFromAudienceDraft,
  buildDatamoonImportRequestFromAudienceDraft,
  buildDatamoonWorkbenchFiltersFromAudienceDraft,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  createDefaultAvaDatamoonAudienceDraft,
  createMinimalAvaDatamoonAudienceDraft,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS,
  DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP,
  GROWTH_DATAMOON_FILTER_MAPPING_FIX_1_QA_MARKER,
  formatDatamoonAllowedFieldsMismatchMessage,
  isDatamoonProviderSupportedFilterField,
  listDatamoonExtOutputFieldsExcludedFromFilterAllowlist,
  mapDatamoonFiltersToProviderFilters,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"

const PHASE = "GE-DATAMOON-FILTER-MAPPING-FIX-1" as const

const WORKBENCH_ONLY_FIELDS = [
  "lookback_days",
  "intent_level",
  "topic",
  "company_size",
  "revenue_range",
  "require_business_email",
  "require_phone",
  "require_linkedin",
  "exclude_duplicates",
  "only_new_since_last_refresh",
] as const

async function main(): Promise<void> {
  console.log(`[${PHASE}] Datamoon provider filter mapping certification`)
  assert.equal(GROWTH_DATAMOON_FILTER_MAPPING_FIX_1_QA_MARKER, "ge-datamoon-filter-mapping-fix-1-v1")

  const defaultDraft = createDefaultAvaDatamoonAudienceDraft()
  const minimalDraft = createMinimalAvaDatamoonAudienceDraft()
  const workbenchFilters = buildDatamoonWorkbenchFiltersFromAudienceDraft(defaultDraft)
  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(defaultDraft)
  const minimalProviderRequest = buildDatamoonImportRequestFromAudienceDraft(minimalDraft)

  assert.ok(workbenchFilters.length >= 14, "workbench draft still emits internal filters")
  for (const field of WORKBENCH_ONLY_FIELDS) {
    if (field === "revenue_range" && !defaultDraft.revenueRange?.trim()) continue
    assert.ok(
      workbenchFilters.some((filter) => filter.field === field),
      `expected internal workbench filter ${field}`,
    )
  }

  for (const filter of providerRequest.filters) {
    assert.equal(
      isDatamoonProviderSupportedFilterField(filter.field),
      true,
      `provider filter ${filter.field} must be allowlisted`,
    )
    assert.equal(
      (WORKBENCH_ONLY_FIELDS as readonly string[]).includes(filter.field),
      false,
      `workbench-only field leaked to provider filters: ${filter.field}`,
    )
  }

  assert.ok(providerRequest.filters.some((filter) => filter.field === "contact_country"))
  assert.ok(providerRequest.filters.some((filter) => filter.field === "job_title"))
  assert.equal(providerRequest.filters.some((filter) => filter.field === "country"), false)
  assert.equal(providerRequest.filters.some((filter) => filter.field === "topic"), false)
  assert.equal(providerRequest.filters.some((filter) => filter.field === "lookback_days"), false)

  assert.equal(providerRequest.workbench_context?.lookbackDays, 7)
  assert.deepEqual(providerRequest.workbench_context?.intentLevels, ["high", "medium"])
  assert.ok(providerRequest.workbench_context?.topics?.includes("equipment maintenance software"))
  assert.equal(providerRequest.workbench_context?.includeBusinessEmail, true)
  assert.equal(providerRequest.workbench_context?.onlyNewSinceLastRefresh, true)
  assert.ok(providerRequest.workbench_context?.omittedWorkbenchFilterFields?.includes("lookback_days"))

  for (const filter of minimalProviderRequest.filters) {
    assert.equal(isDatamoonProviderSupportedFilterField(filter.field), true)
    assert.equal((WORKBENCH_ONLY_FIELDS as readonly string[]).includes(filter.field), false)
  }
  assert.equal(minimalProviderRequest.audience_type, "advanced_search")
  assert.equal(minimalProviderRequest.filters.some((filter) => filter.field === "contact_country"), true)

  const localValidation = validateDatamoonAudienceImportRequest(minimalProviderRequest)
  assert.equal(localValidation.ok, true, JSON.stringify(localValidation))

  const emptyAdvancedValidation = validateDatamoonAudienceImportRequest({
    run_name: "Empty filters",
    audience_type: "advanced_search",
    filters: [],
  })
  assert.equal(emptyAdvancedValidation.ok, true)

  const invalidLegacyValidation = validateDatamoonAudienceImportRequest({
    run_name: "Legacy invalid",
    audience_type: "advanced_search",
    filters: [{ field: "lookback_days", operator: "=", value: "7" }],
  })
  assert.equal(invalidLegacyValidation.ok, false)
  if (invalidLegacyValidation.ok) throw new Error("expected invalid legacy filter validation failure")
  assert.equal(invalidLegacyValidation.issues[0]?.code, "unsupported_provider_filter_field")

  const mapped = mapDatamoonFiltersToProviderFilters([
    { field: "country", operator: "=", value: "US" },
    { field: "lookback_days", operator: "=", value: "7" },
  ])
  assert.deepEqual(mapped.providerFilters, [{ field: "contact_country", operator: "=", value: "US" }])
  assert.deepEqual(mapped.omittedWorkbenchFilterFields, ["lookback_days"])

  const mismatchMessage = formatDatamoonAllowedFieldsMismatchMessage({
    validationErrors: {
      "filters.0.field": ["invalid"],
      "filters.1.field": ["invalid"],
    },
    allowedFields: ["first_name", "last_name", "personal_emails"],
  })
  assert.match(mismatchMessage, /Supported provider filter fields: first_name, last_name, personal_emails/)
  assert.match(mismatchMessage, /index 0, 1/)

  assert.deepEqual(DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP.country, "contact_country")
  assert.deepEqual(DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP.state, "personal_state")
  assert.deepEqual(DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP.city, "personal_city")
  assert.deepEqual(DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP.job_title, "job_title")

  const providerFilterFields = buildDatamoonFiltersFromAudienceDraft(defaultDraft).map((filter) => filter.field)
  assert.deepEqual(
    new Set(providerFilterFields),
    new Set(providerRequest.filters.map((filter) => filter.field)),
  )

  console.log(`[${PHASE}] supported allowlist`, DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS)
  console.log(
    `[${PHASE}] ext output fields excluded from filter allowlist`,
    listDatamoonExtOutputFieldsExcludedFromFilterAllowlist(),
  )
  console.log(`[${PHASE}] default providerRequest`)
  console.log(JSON.stringify(providerRequest, null, 2))
  console.log(`[${PHASE}] passed`)
}

void main()
