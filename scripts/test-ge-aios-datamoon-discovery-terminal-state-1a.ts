/**
 * GE-AIOS-DATAMOON-DISCOVERY-TERMINAL-STATE-1A — Provider terminal poll failure handling.
 * Run: pnpm test:ge-aios-datamoon-discovery-terminal-state-1a
 */
import assert from "node:assert/strict"
import Module from "node:module"
import path from "node:path"

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {}
  return originalLoad.call(this, request, parent, isMain)
}

const PHASE = "GE-AIOS-DATAMOON-DISCOVERY-TERMINAL-STATE-1A" as const

type MockRunRow = {
  id: string
  run_name: string
  datamoon_audience_id: string
  provider_mode: string
  audience_type: string
  filters: unknown[]
  topic_ids: string[]
  requested_limit: number
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
  created_by: string
  last_polled_at: string | null
  completed_at: string | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

function withEnvAsync<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prior = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(env)) {
    prior.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return fn().finally(() => {
    for (const [key, value] of prior.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

function createMockDatamoonPollAdmin(runId: string) {
  const now = new Date().toISOString()
  const runStore: Record<string, MockRunRow> = {
    [runId]: {
      id: runId,
      run_name: "Terminal state poll test",
      datamoon_audience_id: "9001",
      provider_mode: "module",
      audience_type: "advanced_search",
      filters: [],
      topic_ids: [],
      requested_limit: 1,
      audience_name: null,
      website_id: null,
      status: "building",
      record_count: 0,
      loading_count: 0,
      preview_count: 0,
      imported_count: 0,
      duplicate_count: 0,
      skipped_count: 0,
      error_count: 0,
      provider_metadata: { provider_audience_id: "9001" },
      error_message: null,
      dry_run: false,
      created_by: "user-1",
      last_polled_at: null,
      completed_at: null,
      imported_at: null,
      created_at: now,
      updated_at: now,
    },
  }
  const recordStore: Record<string, Array<Record<string, unknown>>> = { [runId]: [] }

  const admin = {
    schema: () => ({
      from: (table: string) => {
        if (table === "datamoon_audience_import_runs") {
          return {
            select: () => ({
              eq: (_column: string, id: string) => ({
                maybeSingle: async () => ({ data: runStore[id] ?? null, error: null }),
              }),
            }),
            update: (row: Record<string, unknown>) => ({
              eq: (_column: string, id: string) => ({
                select: () => ({
                  maybeSingle: async () => {
                    runStore[id] = {
                      ...runStore[id],
                      ...row,
                      updated_at: new Date().toISOString(),
                    } as MockRunRow
                    return { data: runStore[id], error: null }
                  },
                }),
              }),
            }),
          }
        }
        if (table === "datamoon_audience_import_records") {
          return {
            delete: () => ({
              eq: async (_column: string, id: string) => {
                recordStore[id] = []
                return { error: null }
              },
            }),
            insert: async (rows: Array<Record<string, unknown>>) => {
              const mapped = rows.map((row, index) => ({
                id: `record-${String(row.record_index ?? index)}`,
                run_id: row.run_id,
                record_index: row.record_index,
                status: row.status,
                normalized_payload: row.normalized_payload,
                provider_record: row.provider_record,
                dedupe_rule: row.dedupe_rule ?? null,
                dedupe_key: row.dedupe_key ?? null,
                matched_lead_id: row.matched_lead_id ?? null,
                lead_id: null,
                message: row.message ?? null,
                created_at: now,
                updated_at: now,
              }))
              recordStore[String(rows[0]?.run_id ?? runId)] = mapped
              return { error: null }
            },
            select: () => ({
              eq: (_column: string, id: string) => ({
                order: () => ({
                  limit: async () => ({ data: recordStore[id] ?? [], error: null }),
                  then(onFulfilled: (value: unknown) => unknown) {
                    return Promise.resolve({ data: recordStore[id] ?? [], error: null }).then(onFulfilled)
                  },
                }),
              }),
            }),
          }
        }
        if (table === "leads") {
          const empty = async () => ({ data: [] as unknown[], error: null })
          return {
            select: () => ({
              ilike: () => ({
                limit: empty,
              }),
              contains: () => ({
                limit: empty,
              }),
              not: () => ({
                limit: empty,
              }),
              eq: () => ({
                limit: empty,
              }),
            }),
          }
        }
        if (table === "growth_business_profiles") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === "organization_growth_objectives") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    }),
  }

  return { admin, getRun: (id: string) => runStore[id], getRecords: (id: string) => recordStore[id] ?? [] }
}

function providerFetchResponse(providerStatus: string, body?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      status: providerStatus,
      message: body?.message ?? "provider response",
      data: {
        status: providerStatus,
        record_count: 0,
        records: [],
        ...body,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

async function pollWithProviderStatus(runId: string, providerStatus: string, body?: Record<string, unknown>) {
  const { admin, getRun } = createMockDatamoonPollAdmin(runId)
  const fetchImpl = async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    if (href.includes("/audiences/fetch/")) return providerFetchResponse(providerStatus, body)
    throw new Error(`unexpected_fetch_url:${href}`)
  }

  const { pollDatamoonAudienceImportRun } = await import(
    path.join(process.cwd(), "lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  )

  const result = await pollDatamoonAudienceImportRun(admin as never, runId, {
    env: process.env,
    fetchImpl,
  })

  return { result, run: getRun(runId) }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Provider terminal poll failure handling`)

  const {
    GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER,
    DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES,
    isDatamoonAudienceProviderTerminalStatus,
    isDatamoonAudienceProviderPollCompleteStatus,
    normalizeDatamoonAudienceProviderStatus,
  } = await import("../lib/growth/lead-sources/datamoon/datamoon-audience-import-fetch-payload")

  assert.equal(
    GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER,
    "ge-aios-datamoon-discovery-terminal-state-1a-v1",
  )
  assert.deepEqual([...DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES], [
    "failed",
    "error",
    "cancelled",
    "canceled",
    "expired",
    "aborted",
    "terminated",
  ])
  assert.equal(isDatamoonAudienceProviderTerminalStatus("failed"), true)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("FAILED"), true)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("cancelled"), true)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("in_progress"), false)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("building"), false)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("processing"), false)
  assert.equal(isDatamoonAudienceProviderTerminalStatus("queued"), false)
  assert.equal(isDatamoonAudienceProviderPollCompleteStatus("completed"), true)
  assert.equal(normalizeDatamoonAudienceProviderStatus(" In_Progress "), "in_progress")

  const importService = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      path.join(process.cwd(), "lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts"),
      "utf8",
    ),
  )
  assert.match(importService, /isDatamoonAudienceProviderTerminalStatus/)
  assert.match(importService, /failDatamoonAudienceImportRun/)
  assert.doesNotMatch(importService, /status: "failed"[\s\S]{0,120}poll_status: normalizedProviderStatus/)

  await withEnvAsync(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_DEFAULT_MODE: "module",
      DATAMOON_AUDIENCE_MODULE_API_KEY: "module-key",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
    },
    async () => {
      const terminal = await pollWithProviderStatus("terminal-failed-run", "failed", {
        message: "Audience build failed at provider.",
      })
      assert.equal(terminal.result.ok, false)
      assert.equal(terminal.run?.status, "failed")
      assert.equal(terminal.run?.provider_metadata.poll_status, "failed")
      assert.equal(terminal.run?.provider_metadata.error_category, "provider_terminal_status")
      assert.equal(terminal.run?.provider_metadata.ge_aios_datamoon_discovery_terminal_state_1a, GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER)
      assert.match(String(terminal.run?.error_message), /failed/)
      assert.ok(terminal.run?.last_polled_at)

      const inProgress = await pollWithProviderStatus("non-terminal-run", "in_progress")
      assert.equal(inProgress.result.ok, true)
      if (inProgress.result.ok) assert.equal(inProgress.result.run.status, "building")
      assert.equal(inProgress.run?.provider_metadata.poll_status, "in_progress")
      assert.equal(inProgress.run?.error_message, null)

      const completed = await pollWithProviderStatus("completed-run", "completed", {
        record_count: 1,
        records: [
          {
            first_name: "Terminal",
            last_name: "Test",
            business_email: "terminal.test@example.com",
            personal_phone: "5550002222",
          },
        ],
      })
      assert.equal(completed.result.ok, true)
      if (completed.result.ok) {
        assert.equal(completed.result.run.status, "completed")
        assert.equal(completed.result.records.length, 1)
      }
    },
  )

  console.log(`[${PHASE}] ✓ terminal provider failures transition to failed; non-terminal stays building`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAILED`, error)
  process.exit(1)
})
