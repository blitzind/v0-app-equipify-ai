/**
 * GE-DATAMOON-1B — Datamoon audience import lead source certification.
 * Run: pnpm test:growth-datamoon-audience-import-ge-datamoon-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { listGrowthLeadSourceRegistry } from "../lib/growth/lead-sources/lead-source-registry"
import {
  extractDatamoonProviderAudienceId,
  resolveDatamoonBuildAudienceId,
  summarizeDatamoonBuildResponseKeys,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-build-id"
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

async function withEnvAsync<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)])
  const prior = new Map<string, string | undefined>()
  for (const key of keys) prior.set(key, process.env[key])
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of prior.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

type MockRunRow = {
  id: string
  run_name: string
  datamoon_audience_id: string | null
  provider_mode: string
  audience_type: string
  filters: unknown[]
  topic_ids: string[]
  requested_limit: number | null
  audience_name: string | null
  website_id: string | null
  status: string
  record_count: number
  loading_count: number
  preview_count: number
  imported_count: number
  duplicate_count: number
  skipped_count: number
  error_count: number
  provider_metadata: Record<string, unknown>
  error_message: string | null
  dry_run: boolean
  created_by: string | null
  last_polled_at: string | null
  completed_at: string | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

function createMockDatamoonImportRunsAdmin(runId = "mock-run-id") {
  const store: Record<string, MockRunRow> = {}

  const runsTable = {
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          const now = new Date().toISOString()
          const record: MockRunRow = {
            id: runId,
            run_name: String(row.run_name ?? ""),
            datamoon_audience_id: null,
            provider_mode: String(row.provider_mode ?? "module"),
            audience_type: String(row.audience_type ?? "advanced_search"),
            filters: Array.isArray(row.filters) ? row.filters : [],
            topic_ids: Array.isArray(row.topic_ids) ? row.topic_ids.map(String) : [],
            requested_limit: typeof row.requested_limit === "number" ? row.requested_limit : null,
            audience_name: typeof row.audience_name === "string" ? row.audience_name : null,
            website_id: typeof row.website_id === "string" ? row.website_id : null,
            status: String(row.status ?? "pending_build"),
            record_count: 0,
            loading_count: 0,
            preview_count: 0,
            imported_count: 0,
            duplicate_count: 0,
            skipped_count: 0,
            error_count: 0,
            provider_metadata:
              row.provider_metadata && typeof row.provider_metadata === "object"
                ? (row.provider_metadata as Record<string, unknown>)
                : {},
            error_message: null,
            dry_run: Boolean(row.dry_run),
            created_by: typeof row.created_by === "string" ? row.created_by : null,
            last_polled_at: null,
            completed_at: null,
            imported_at: null,
            created_at: now,
            updated_at: now,
          }
          store[runId] = record
          return { data: record, error: null }
        },
      }),
    }),
    update: (row: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => ({
        select: () => ({
          maybeSingle: async () => {
            const existing = store[id]
            if (!existing) return { data: null, error: null }
            store[id] = {
              ...existing,
              ...row,
              updated_at: new Date().toISOString(),
            } as MockRunRow
            return { data: store[id], error: null }
          },
        }),
      }),
    }),
  }

  const admin = {
    schema: () => ({
      from: (table: string) => {
        if (table !== "datamoon_audience_import_runs") {
          throw new Error(`unexpected table ${table}`)
        }
        return runsTable
      },
    }),
  }

  return { admin, getRun: (id: string) => store[id] }
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

  assert.equal(extractDatamoonProviderAudienceId({ id: "aud-string-1" }), "aud-string-1")
  assert.equal(extractDatamoonProviderAudienceId({ id: 4242 }), "4242")
  assert.equal(extractDatamoonProviderAudienceId({ audience_id: "aud-alias-1" }), "aud-alias-1")
  assert.equal(extractDatamoonProviderAudienceId({ audienceId: 9001 }), "9001")
  assert.equal(extractDatamoonProviderAudienceId({ audienceID: "aud-camel-1" }), "aud-camel-1")
  assert.equal(extractDatamoonProviderAudienceId({ status: "in_progress" }), null)
  assert.equal(extractDatamoonProviderAudienceId({ id: { nested: true } }), null)

  const missingId = resolveDatamoonBuildAudienceId({
    buildStatus: "success",
    data: { status: "in_progress" },
  })
  assert.equal(missingId.audienceId, null)
  assert.equal(missingId.missingProviderAudienceId, true)
  assert.deepEqual(summarizeDatamoonBuildResponseKeys({ status: "in_progress", record_count: 0 }), [
    "status",
    "record_count",
  ])

  const dryRunId = resolveDatamoonBuildAudienceId({ buildStatus: "dry_run", data: {} })
  assert.equal(dryRunId.audienceId, "dry-run-audience-id")
  assert.equal(dryRunId.missingProviderAudienceId, false)

  assert.equal(extractDatamoonProviderAudienceId({ message: "ok", data: { id: "nested-string-1" } }), "nested-string-1")
  assert.equal(extractDatamoonProviderAudienceId({ message: "ok", data: { id: 7788 } }), "7788")
  assert.equal(
    extractDatamoonProviderAudienceId({ message: "ok", data: { audience_id: "nested-alias-1" } }),
    "nested-alias-1",
  )
  assert.equal(
    extractDatamoonProviderAudienceId({ message: "ok", data: { data: { id: "double-wrap-1" } } }),
    "double-wrap-1",
  )

  const nestedMissing = resolveDatamoonBuildAudienceId({
    buildStatus: "success",
    data: { message: "ok", data: { status: "in_progress" } },
  })
  assert.equal(nestedMissing.audienceId, null)
  assert.equal(nestedMissing.missingProviderAudienceId, true)

  assert.deepEqual(summarizeDatamoonBuildResponseKeys({ message: "ok", data: { id: 1, status: "in_progress" } }), [
    "message",
    "data",
    "data.id",
    "data.status",
  ])
  checks.push("provider_audience_id_extraction")
  checks.push("nested_provider_audience_id_extraction")

  await withEnvAsync(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_DEFAULT_MODE: "module",
      DATAMOON_AUDIENCE_MODULE_API_KEY: "module-key",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
    },
    async () => {
      const { admin, getRun } = createMockDatamoonImportRunsAdmin()
      const fetchImpl = async () =>
        new Response(JSON.stringify({ message: "Audience created", data: { status: "in_progress", record_count: 0 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })

      const { startDatamoonAudienceImportRun } = await import(
        "../lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
      )

      const result = await startDatamoonAudienceImportRun(
        admin as never,
        {
          run_name: "Missing ID regression",
          audience_type: "advanced_search",
          filters: [{ field: "job_title", operator: "contains", value: "CEO" }],
          limit: 1,
          provider_mode: "module",
        },
        { userId: "user-1" },
        { env: process.env, fetchImpl },
      )

      assert.equal(result.ok, false)
      if (result.ok) throw new Error("expected missing_provider_audience_id failure")
      assert.equal(result.error, "missing_provider_audience_id")

      const run = getRun("mock-run-id")
      assert.ok(run)
      assert.equal(run!.status, "failed")
      assert.equal(run!.error_message, "missing_provider_audience_id")
      assert.equal(run!.provider_metadata.error_category, "missing_provider_audience_id")
      assert.deepEqual(run!.provider_metadata.build_response_keys, [
        "message",
        "data",
        "data.status",
        "data.record_count",
      ])
      assert.equal(run!.datamoon_audience_id, null)
      assert.notEqual(run!.status, "pending_build")
    },
  )
  checks.push("missing_provider_audience_id_no_throw")

  await withEnvAsync(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_DEFAULT_MODE: "module",
      DATAMOON_AUDIENCE_MODULE_API_KEY: "module-key",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
    },
    async () => {
      const { admin, getRun } = createMockDatamoonImportRunsAdmin("mock-run-nested-id")
      const fetchImpl = async () =>
        new Response(JSON.stringify({ message: "Audience created", data: { id: 424242, status: "in_progress" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })

      const { startDatamoonAudienceImportRun } = await import(
        "../lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
      )

      const result = await startDatamoonAudienceImportRun(
        admin as never,
        {
          run_name: "Nested ID regression",
          audience_type: "advanced_search",
          filters: [{ field: "job_title", operator: "contains", value: "CEO" }],
          limit: 1,
          provider_mode: "module",
        },
        { userId: "user-1" },
        { env: process.env, fetchImpl },
      )

      assert.equal(result.ok, true)
      if (!result.ok) throw new Error("expected nested module build success")
      assert.equal(result.run.datamoonAudienceId, "424242")
      const run = getRun("mock-run-nested-id")
      assert.equal(run?.status, "building")
      assert.equal(run?.datamoon_audience_id, "424242")
    },
  )
  checks.push("nested_module_build_id_persisted")

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
  assert.match(serviceSource, /resolveDatamoonBuildAudienceId/)
  assert.match(serviceSource, /summarizeDatamoonBuildResponseKeys/)
  assert.match(serviceSource, /missing_provider_audience_id/)
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
