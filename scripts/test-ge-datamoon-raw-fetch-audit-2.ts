/**
 * GE-DATAMOON-RAW-FETCH-AUDIT-2 — Unconditional completed-poll audit certification.
 * Run: pnpm test:ge-datamoon-raw-fetch-audit-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
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

const PHASE = "GE-DATAMOON-RAW-FETCH-AUDIT-2" as const
const GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_QA_MARKER = "ge-datamoon-raw-fetch-audit-2-v1" as const
const GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_REASON = "completed_poll_audit" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

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

function createMockDatamoonPollAdmin(runId: string, initialStatus: string) {
  const now = new Date().toISOString()
  const runStore: Record<string, MockRunRow> = {
    [runId]: {
      id: runId,
      run_name: "Raw fetch audit poll",
      datamoon_audience_id: "4538",
      provider_mode: "module",
      audience_type: "advanced_search",
      filters: [],
      topic_ids: [],
      requested_limit: 1,
      audience_name: null,
      website_id: null,
      status: initialStatus,
      record_count: 0,
      loading_count: 0,
      preview_count: 0,
      imported_count: 0,
      duplicate_count: 0,
      skipped_count: 0,
      error_count: 0,
      provider_metadata: { provider_audience_id: "4538" },
      error_message: null,
      dry_run: false,
      created_by: "user-1",
      last_polled_at: null,
      completed_at: initialStatus === "completed" ? now : null,
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
              recordStore[String(rows[0]?.run_id ?? runId)] = rows
              return { error: null }
            },
            select: () => ({
              eq: (_column: string, id: string) => ({
                order: () => ({
                  limit: async () => ({ data: recordStore[id] ?? [], error: null }),
                }),
              }),
            }),
          }
        }
        if (table === "leads") {
          const empty = async () => ({ data: [] as unknown[], error: null })
          return {
            select: () => ({
              ilike: () => ({ limit: empty }),
              contains: () => ({ limit: empty }),
              not: () => ({ limit: empty }),
              eq: () => ({ limit: empty }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    }),
  }

  return { admin, getRun: (id: string) => runStore[id] }
}

async function withEnvAsync<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  Object.assign(process.env, env)
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function completedFetchResponse() {
  return new Response(
    JSON.stringify({
      data: {
        status: "completed",
        record_count: 1,
        records: [
          {
            first_name: "Audit",
            last_name: "Lead",
            business_email: "audit.lead@example.com",
            personal_phone: "5550003333",
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

function captureDatamoonRawFetchAuditLogs(): {
  logs: Array<Record<string, unknown>>
  restore: () => void
} {
  const logs: Array<Record<string, unknown>> = []
  const originalInfo = console.info
  console.info = (...args: unknown[]) => {
    for (const arg of args) {
      if (typeof arg !== "string") continue
      try {
        const parsed = JSON.parse(arg) as Record<string, unknown>
        if (parsed.event === "datamoon_raw_fetch_audit_1") logs.push(parsed)
      } catch {
        // ignore non-JSON console.info output
      }
    }
    originalInfo(...args)
  }
  return { logs, restore: () => { console.info = originalInfo } }
}

async function pollWithInitialStatus(initialStatus: string): Promise<Array<Record<string, unknown>>> {
  const runId = `audit-run-${initialStatus}`
  const { logs, restore } = captureDatamoonRawFetchAuditLogs()
  try {
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
        const { admin } = createMockDatamoonPollAdmin(runId, initialStatus)
        const fetchImpl = async (url: string | URL | Request) => {
          const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
          if (href.includes("/audiences/fetch/")) return completedFetchResponse()
          throw new Error(`unexpected_fetch_url:${href}`)
        }

        const { pollDatamoonAudienceImportRun } = await import(
          "../lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
        )
        const result = await pollDatamoonAudienceImportRun(admin as never, runId, {
          env: process.env,
          fetchImpl,
        })
        assert.equal(result.ok, true, `expected poll success for initial status ${initialStatus}`)
      },
    )
    return logs
  } finally {
    restore()
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Datamoon raw fetch audit certification`)

  assert.equal(GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_QA_MARKER, "ge-datamoon-raw-fetch-audit-2-v1")
  assert.equal(GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_REASON, "completed_poll_audit")

  const auditSource = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-raw-fetch-audit.ts")
  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")

  assert.match(auditSource, /TODO\(ge-datamoon-raw-fetch-audit\)/)
  assert.match(auditSource, /existing_status: input\.existingStatus/)
  assert.match(auditSource, /reason: GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_REASON/)
  assert.doesNotMatch(auditSource, /shouldLogDatamoonRawFetchAudit/)
  assert.doesNotMatch(importService, /shouldLogDatamoonRawFetchAudit/)
  assert.match(importService, /logDatamoonRawFetchAudit\(\{/)
  assert.match(importService, /existingStatus: existing\.status/)
  assert.match(importService, /TODO\(ge-datamoon-raw-fetch-audit\)/)

  const buildingLogs = await pollWithInitialStatus("building")
  assert.equal(buildingLogs.length, 1, "building run should emit one audit log")
  assert.equal(buildingLogs[0]?.existing_status, "building")
  assert.equal(buildingLogs[0]?.reason, "completed_poll_audit")
  assert.equal(buildingLogs[0]?.event, "datamoon_raw_fetch_audit_1")
  assert.equal(buildingLogs[0]?.qa_marker, GROWTH_DATAMOON_RAW_FETCH_AUDIT_2_QA_MARKER)

  const completedLogs = await pollWithInitialStatus("completed")
  assert.equal(completedLogs.length, 1, "already-completed run should still emit audit log")
  assert.equal(completedLogs[0]?.existing_status, "completed")
  assert.equal(completedLogs[0]?.reason, "completed_poll_audit")
  assert.equal(completedLogs[0]?.event, "datamoon_raw_fetch_audit_1")

  console.log(`[${PHASE}] ✓ completed poll emits audit for building and completed existing.status`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAILED`, error)
  process.exit(1)
})
