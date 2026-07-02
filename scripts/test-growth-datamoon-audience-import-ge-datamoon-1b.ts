/**
 * GE-DATAMOON-1B — Datamoon audience import lead source certification.
 * Run: pnpm test:growth-datamoon-audience-import-ge-datamoon-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { listGrowthLeadSourceRegistry } from "../lib/growth/lead-sources/lead-source-registry"
import { findDatamoonAudienceDedupeMatch } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-dedupe"
import {
  filterDatamoonRecordToExtFields,
  isDatamoonRecordImportable,
  normalizeDatamoonAudienceRecord,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { sanitizeDatamoonProviderMetadata } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-sanitizer"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import {
  DATAMOON_EXT_OUTPUT_FIELDS,
  GROWTH_DATAMOON_AUDIENCE_IMPORT_SCHEMA_MIGRATION,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_AUDIENCE_IMPORT_GE_DATAMOON_1B_QA_MARKER =
  "growth-datamoon-audience-import-ge-datamoon-1b-v1" as const

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)])
  const prior = new Map<string, string | undefined>()
  for (const key of keys) prior.set(key, process.env[key])
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of prior.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function main() {
  const checks: string[] = []

  // Registry
  const sources = listGrowthLeadSourceRegistry()
  const datamoonSource = sources.find((entry) => entry.source_key === "datamoon_audience")
  assert.ok(datamoonSource)
  assert.equal(datamoonSource!.provider_key, "datamoon")
  checks.push("lead_source_registry_datamoon")

  // Migration present
  const migration = read(`supabase/migrations/${GROWTH_DATAMOON_AUDIENCE_IMPORT_SCHEMA_MIGRATION}`)
  assert.match(migration, /datamoon_audience_import_runs/)
  assert.match(migration, /datamoon_audience_import_records/)
  checks.push("schema_migration_present")

  // Validation — topic_ids max 5
  const tooManyTopics = validateDatamoonAudienceImportRequest({
    run_name: "test",
    audience_type: "b2b",
    filters: [],
    topic_ids: ["1", "2", "3", "4", "5", "6"],
  })
  assert.equal(tooManyTopics.ok, false)
  if (!tooManyTopics.ok) {
    assert.ok(tooManyTopics.issues.some((issue) => issue.code === "topic_ids_max_exceeded"))
  }
  checks.push("topic_ids_max_5")

  // b2b/b2c require topic_ids
  for (const audience_type of ["b2b", "b2c"] as const) {
    const missingTopics = validateDatamoonAudienceImportRequest({
      run_name: "test",
      audience_type,
      filters: [],
      topic_ids: [],
    })
    assert.equal(missingTopics.ok, false)
    if (!missingTopics.ok) {
      assert.ok(missingTopics.issues.some((issue) => issue.code === "topic_ids_required"))
    }
  }
  checks.push("b2b_b2c_topic_ids_required")

  const advancedOk = validateDatamoonAudienceImportRequest({
    run_name: "Advanced",
    audience_type: "advanced_search",
    filters: [{ field: "job_title", operator: "contains", value: "CEO" }],
  })
  assert.equal(advancedOk.ok, true)
  checks.push("advanced_search_validation")

  const limitOk = validateDatamoonAudienceImportRequest({
    run_name: "Limit test",
    audience_type: "advanced_search",
    filters: [],
    limit: 1,
  })
  assert.equal(limitOk.ok, true)
  checks.push("ui_api_limit_validation")

  // ext field normalization
  const normalized = normalizeDatamoonAudienceRecord(
    {
      first_name: "Ada",
      last_name: "Lovelace",
      business_email: "ada@acme.com",
      personal_emails: "ada.personal@example.com",
      personal_phone: "555-123-4567",
      linkedin_url: "https://linkedin.com/in/adalovelace",
      personal_address: "1 Main",
      personal_city: "London",
      personal_state: "ldn",
      personal_zip: "SW1A",
      contact_country: "UK",
      company_domain: "ignored-in-ext",
    },
    { providerMode: "ext" },
  )
  assert.equal(normalized.first_name, "Ada")
  assert.equal(normalized.business_email, "ada@acme.com")
  assert.equal(normalized.email, "ada@acme.com")
  assert.equal(normalized.phone, "5551234567")
  assert.match(normalized.linkedin_url ?? "", /adalovelace/)
  assert.equal(normalized.source, "datamoon")
  assert.equal(normalized.source_confidence, "provider")
  assert.ok(isDatamoonRecordImportable(normalized))

  const extFiltered = filterDatamoonRecordToExtFields({
    first_name: "A",
    company_domain: "drop-me.com",
    secret_field: "nope",
  })
  assert.equal(extFiltered.first_name, "A")
  assert.equal(extFiltered.company_domain, undefined)
  assert.equal(Object.keys(extFiltered).every((key) => DATAMOON_EXT_OUTPUT_FIELDS.includes(key as never)), true)
  checks.push("ext_field_normalization")

  // Sanitizer redacts PII / keys
  const sanitized = sanitizeDatamoonProviderMetadata({
    api_key: "secret-key",
    email: "person@example.com",
    nested: { phone: "555-123-4567" },
  }) as Record<string, unknown>
  assert.equal(sanitized.api_key, "[REDACTED]")
  assert.match(String(sanitized.email), /REDACTED_EMAIL/)
  checks.push("sanitized_provider_metadata")

  // Dedupe behavior — email match
  const admin = {
    schema: () => ({
      from: (table: string) => {
        assert.equal(table, "leads")
        return {
          select: () => ({
            ilike: (_col: string, value: string) => ({
              limit: async () => ({
                data: value === "ada@acme.com" ? [{ id: "lead-email-1" }] : [],
              }),
            }),
            contains: () => ({
              limit: async () => ({ data: [] }),
            }),
            not: () => ({
              limit: async () => ({ data: [] }),
            }),
          }),
        }
      },
    }),
  }

  const dedupe = await findDatamoonAudienceDedupeMatch(admin as never, normalized)
  assert.ok(dedupe)
  assert.equal(dedupe!.rule, "email")
  checks.push("dedupe_email_match")

  // Unified intake wired; no outreach side effects in import service
  const serviceSource = read("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.doesNotMatch(serviceSource, /executeOutreach|bulkEnroll|sequencePattern|createCampaign|sendOutbound/i)
  assert.match(serviceSource, /runUnifiedRevenueWorkflowAfterIntake/)
  assert.match(serviceSource, /buildDatamoonUnifiedIntakePayload/)
  assert.match(serviceSource, /record_limit: input\.limit/)
  checks.push("unified_intake_wired_no_outreach")

  const clientSource = read("lib/growth/providers/datamoon/datamoon-client.ts")
  assert.match(clientSource, /record_limit: recordLimit/)
  assert.doesNotMatch(clientSource, /\{ limit: input\.limit \}/)
  checks.push("audience_build_record_limit_only")

  const importRoute = read("app/api/platform/growth/lead-sources/datamoon/runs/[runId]/import/route.ts")
  assert.match(importRoute, /import_all_previewed/)
  assert.match(importRoute, /record_ids/)
  checks.push("explicit_import_route")

  const panelSource = read("components/growth/lead-sources/growth-datamoon-audience-import-panel.tsx")
  assert.match(panelSource, /Import Selected/)
  assert.match(panelSource, /Import All Previewed/)
  assert.match(panelSource, /dry-run/i)
  checks.push("ui_import_controls")

  // Disabled by default
  withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: undefined,
      DATAMOON_DRY_RUN_ONLY: undefined,
    },
    () => {
      const entry = listGrowthLeadSourceRegistry().find((row) => row.source_key === "datamoon_audience")
      assert.equal(entry?.configured, false)
      assert.equal(entry?.dry_run_only, true)
    },
  )
  checks.push("disabled_by_default")

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_DATAMOON_AUDIENCE_IMPORT_GE_DATAMOON_1B_QA_MARKER,
        checks,
        status: "pass",
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
