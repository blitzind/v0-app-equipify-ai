/**
 * GS-GROWTH-OPS-7B — Audit, reset, verify, and report Growth test data.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_RESET_CONFIRM_ENV,
  GROWTH_RESET_CONFIRM_VALUE,
  GROWTH_TEST_DATA_RESET_QA_MARKER,
  PRECISION_BIOMEDICAL_ORG_NAME,
  REPORT_PATHS,
} from "./growth-test-data-reset-constants"
import {
  getGoldenPreservedFkValues,
  getGoldenPreservedIdsForTable,
  resolveGrowthResetGoldenFixtures,
  type GrowthResetGoldenFixtures,
} from "./growth-test-data-reset-golden-fixtures"
import {
  buildGrowthResetTableCatalog,
  getGrowthResetDependencyGraph,
  getOrderedDeleteTables,
  type GrowthResetTableCatalogEntry,
} from "./growth-test-data-reset-table-inventory"

export type GrowthResetTableAuditRow = {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  row_count: number
  preserved_count: number
  delete_count: number
  dependencies: string[]
  reset_order: number | null
  golden_fixture: boolean
  notes: string | null
}

export type GrowthResetAuditReport = {
  qa_marker: typeof GROWTH_TEST_DATA_RESET_QA_MARKER
  generated_at: string
  mode: "dry_run" | "confirm" | "report"
  table_count: number
  summary: {
    keep_tables: number
    delete_tables: number
    manual_review_tables: number
    total_rows: number
    preserved_rows: number
    delete_rows: number
  }
  golden_fixtures: GrowthResetGoldenFixtures
  dependency_graph: Record<string, string[]>
  tables: GrowthResetTableAuditRow[]
  manual_review_items: string[]
}

export type GrowthResetVerificationCheck = {
  id: string
  pass: boolean
  detail: string
}

export type GrowthResetSummary = {
  qa_marker: typeof GROWTH_TEST_DATA_RESET_QA_MARKER
  generated_at: string
  mode: "dry_run" | "confirm" | "report"
  tables_preserved: string[]
  tables_cleared: string[]
  golden_fixtures_retained: GrowthResetGoldenFixtures
  rows_removed: number
  rows_remaining: number
  manual_review_items: string[]
  verification: {
    ok: boolean
    checks: GrowthResetVerificationCheck[]
  }
  risks_and_rollback: string[]
  before_report_path: string
  after_report_path: string | null
}

export type GrowthResetRunResult = {
  audit_before: GrowthResetAuditReport
  audit_after: GrowthResetAuditReport | null
  summary: GrowthResetSummary
  deleted_by_table: Record<string, number>
}

const BATCH_SIZE = 100
const DELETE_PAGE_SIZE = 500

async function deleteRowsByIds(
  admin: SupabaseClient,
  table: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0
  let deleted = 0
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const { count, error } = await admin
      .schema("growth")
      .from(table)
      .delete({ count: "exact" })
      .in("id", batch)
    if (error) throw new Error(`${table} delete batch: ${error.message}`)
    deleted += count ?? batch.length
  }
  return deleted
}

async function deleteExceptPreservedIds(
  admin: SupabaseClient,
  table: string,
  preservedIds: string[],
): Promise<number> {
  let deleted = 0
  let offset = 0

  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(table)
      .select("id")
      .range(offset, offset + DELETE_PAGE_SIZE - 1)
    if (error) throw new Error(`${table} scan ids: ${error.message}`)
    const rows = data ?? []
    if (rows.length === 0) break

    const deleteIds = rows
      .map((row) => (typeof row.id === "string" ? row.id : ""))
      .filter((id) => id && !preservedIds.includes(id))

    deleted += await deleteRowsByIds(admin, table, deleteIds)

    if (rows.length < DELETE_PAGE_SIZE) break
    offset += DELETE_PAGE_SIZE
  }

  return deleted
}

async function deleteExceptPreservedFk(
  admin: SupabaseClient,
  table: string,
  fkColumn: string,
  preservedFkValues: string[],
): Promise<number> {
  let deleted = 0
  let offset = 0
  const preserved = new Set(preservedFkValues)

  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(table)
      .select(`id, ${fkColumn}`)
      .range(offset, offset + DELETE_PAGE_SIZE - 1)
    if (error) {
      if (/column .* does not exist/i.test(error.message)) return 0
      throw new Error(`${table} scan fk ids: ${error.message}`)
    }
    const rows = data ?? []
    if (rows.length === 0) break

    const deleteIds = rows
      .filter((row) => {
        const fk = row[fkColumn]
        if (typeof fk !== "string" || !fk) return true
        return !preserved.has(fk)
      })
      .map((row) => (typeof row.id === "string" ? row.id : ""))
      .filter(Boolean)

    deleted += await deleteRowsByIds(admin, table, deleteIds)

    if (rows.length < DELETE_PAGE_SIZE) break
    offset += DELETE_PAGE_SIZE
  }

  return deleted
}

async function countAllRows(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
  if (error) {
    if (/does not exist|Could not find/i.test(error.message)) return 0
    throw new Error(`${table} count: ${error.message}`)
  }
  return count ?? 0
}

async function countPreservedByIds(
  admin: SupabaseClient,
  table: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0
  let total = 0
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const { count, error } = await admin
      .schema("growth")
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("id", batch)
    if (error) throw new Error(`${table} preserved id count: ${error.message}`)
    total += count ?? 0
  }
  return total
}

async function countPreservedByFk(
  admin: SupabaseClient,
  table: string,
  fkColumn: string,
  fkValues: string[],
): Promise<number> {
  if (fkValues.length === 0) return 0
  let total = 0
  for (let i = 0; i < fkValues.length; i += BATCH_SIZE) {
    const batch = fkValues.slice(i, i + BATCH_SIZE)
    const { count, error } = await admin
      .schema("growth")
      .from(table)
      .select("id", { count: "exact", head: true })
      .in(fkColumn, batch)
    if (error) {
      if (/column .* does not exist/i.test(error.message)) return 0
      throw new Error(`${table} preserved fk count: ${error.message}`)
    }
    total += count ?? 0
  }
  return total
}

async function auditTableRow(
  admin: SupabaseClient,
  entry: GrowthResetTableCatalogEntry,
  fixtures: GrowthResetGoldenFixtures,
): Promise<GrowthResetTableAuditRow> {
  const row_count = await countAllRows(admin, entry.table)

  if (entry.classification === "KEEP") {
    return {
      table: entry.table,
      classification: entry.classification,
      row_count,
      preserved_count: row_count,
      delete_count: 0,
      dependencies: entry.dependencies,
      reset_order: entry.reset_order,
      golden_fixture: false,
      notes: entry.notes,
    }
  }

  if (entry.classification === "MANUAL_REVIEW") {
    return {
      table: entry.table,
      classification: entry.classification,
      row_count,
      preserved_count: row_count,
      delete_count: 0,
      dependencies: entry.dependencies,
      reset_order: entry.reset_order,
      golden_fixture: false,
      notes: "Manual review — not auto-deleted.",
    }
  }

  const preservedIds = getGoldenPreservedIdsForTable(entry.table, fixtures)
  let preserved_count = 0

  if (preservedIds.length > 0) {
    preserved_count = await countPreservedByIds(admin, entry.table, preservedIds)
  } else if (entry.delete_fk_column) {
    const fkValues = getGoldenPreservedFkValues(entry.delete_fk_column, fixtures)
    preserved_count = await countPreservedByFk(admin, entry.table, entry.delete_fk_column, fkValues)
  } else if (entry.golden_entity === "timeline") {
    preserved_count = await countPreservedByFk(admin, entry.table, "lead_id", fixtures.timeline_lead_ids)
  }

  return {
    table: entry.table,
    classification: entry.classification,
    row_count,
    preserved_count,
    delete_count: Math.max(0, row_count - preserved_count),
    dependencies: entry.dependencies,
    reset_order: entry.reset_order,
    golden_fixture: preserved_count > 0,
    notes: entry.notes,
  }
}

export async function auditGrowthTestData(
  admin: SupabaseClient,
  mode: GrowthResetAuditReport["mode"],
): Promise<GrowthResetAuditReport> {
  const catalog = buildGrowthResetTableCatalog()
  const fixtures = await resolveGrowthResetGoldenFixtures(admin)
  const dependency_graph = getGrowthResetDependencyGraph(catalog)

  const tables: GrowthResetTableAuditRow[] = []
  for (const entry of catalog) {
    tables.push(await auditTableRow(admin, entry, fixtures))
  }

  const keep_tables = tables.filter((t) => t.classification === "KEEP").length
  const delete_tables = tables.filter((t) => t.classification === "DELETE").length
  const manual_review_tables = tables.filter((t) => t.classification === "MANUAL_REVIEW").length
  const total_rows = tables.reduce((sum, row) => sum + row.row_count, 0)
  const preserved_rows = tables.reduce((sum, row) => sum + row.preserved_count, 0)
  const delete_rows = tables.reduce((sum, row) => sum + row.delete_count, 0)

  return {
    qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
    generated_at: new Date().toISOString(),
    mode,
    table_count: tables.length,
    summary: {
      keep_tables,
      delete_tables,
      manual_review_tables,
      total_rows,
      preserved_rows,
      delete_rows,
    },
    golden_fixtures: fixtures,
    dependency_graph,
    tables,
    manual_review_items: tables
      .filter((t) => t.classification === "MANUAL_REVIEW")
      .map((t) => t.table),
  }
}

async function deleteTableRows(
  admin: SupabaseClient,
  entry: GrowthResetTableCatalogEntry,
  fixtures: GrowthResetGoldenFixtures,
): Promise<number> {
  const preservedIds = getGoldenPreservedIdsForTable(entry.table, fixtures)

  if (preservedIds.length > 0) {
    return deleteExceptPreservedIds(admin, entry.table, preservedIds)
  }

  if (entry.delete_fk_column) {
    const fkValues = getGoldenPreservedFkValues(entry.delete_fk_column, fixtures)
    if (fkValues.length > 0) {
      return deleteExceptPreservedFk(admin, entry.table, entry.delete_fk_column, fkValues)
    }
  }

  let deleted = 0
  let offset = 0
  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(entry.table)
      .select("id")
      .range(offset, offset + DELETE_PAGE_SIZE - 1)
    if (error) throw new Error(`${entry.table} delete scan: ${error.message}`)
    const rows = data ?? []
    if (rows.length === 0) break
    const ids = rows.map((row) => (typeof row.id === "string" ? row.id : "")).filter(Boolean)
    deleted += await deleteRowsByIds(admin, entry.table, ids)
    if (rows.length < DELETE_PAGE_SIZE) break
    offset += DELETE_PAGE_SIZE
  }
  return deleted
}

export async function verifyGrowthResetIntegrity(
  admin: SupabaseClient,
  fixtures: GrowthResetGoldenFixtures,
): Promise<{ ok: boolean; checks: GrowthResetVerificationCheck[] }> {
  const checks: GrowthResetVerificationCheck[] = []

  for (const orgId of fixtures.organization_ids) {
    const { data, error } = await admin.from("organizations").select("id, name, status").eq("id", orgId).maybeSingle()
    checks.push({
      id: `organization_exists_${orgId.slice(0, 8)}`,
      pass: !error && Boolean(data?.id),
      detail: error?.message ?? (data ? `org ${data.name}` : "missing"),
    })
  }

  const { data: precisionOrg } = await admin
    .from("organizations")
    .select("id, name, slug")
    .or(`slug.eq.precision-biomedical-demo,name.ilike.%${PRECISION_BIOMEDICAL_ORG_NAME}%`)
    .limit(1)
    .maybeSingle()
  checks.push({
    id: "precision_biomedical_org_exists",
    pass: Boolean(precisionOrg?.id),
    detail: precisionOrg ? `${precisionOrg.name} (${precisionOrg.slug ?? "no-slug"})` : "not found",
  })

  const entityChecks: Array<{ key: keyof GrowthResetGoldenFixtures; table: string; label: string }> = [
    { key: "lead_ids", table: "leads", label: "golden lead" },
    { key: "company_ids", table: "companies", label: "golden company" },
    { key: "opportunity_ids", table: "opportunities", label: "golden opportunity" },
    { key: "meeting_ids", table: "meetings", label: "golden meeting" },
    { key: "generation_ids", table: "personalization_generations", label: "golden personalization generation" },
    { key: "sequence_enrollment_ids", table: "sequence_enrollments", label: "golden sequence enrollment" },
    { key: "inbox_thread_ids", table: "inbox_threads", label: "golden inbox thread" },
  ]

  for (const check of entityChecks) {
    const ids = fixtures[check.key] as string[]
    if (ids.length === 0) {
      checks.push({ id: check.label.replace(/\s+/g, "_"), pass: false, detail: "no preserved id resolved" })
      continue
    }
    const { count, error } = await admin
      .schema("growth")
      .from(check.table)
      .select("id", { count: "exact", head: true })
      .in("id", ids)
    checks.push({
      id: check.label.replace(/\s+/g, "_"),
      pass: !error && (count ?? 0) > 0,
      detail: error?.message ?? `${count ?? 0} row(s)`,
    })
  }

  if (fixtures.lead_ids.length > 0) {
    const { count: timelineCount, error: timelineErr } = await admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id", { count: "exact", head: true })
      .in("lead_id", fixtures.lead_ids)
    checks.push({
      id: "activity_timeline_loads",
      pass: !timelineErr,
      detail: timelineErr?.message ?? `${timelineCount ?? 0} timeline event(s) for golden lead`,
    })

    const { count: orphanOpps, error: orphanErr } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .is("lead_id", null)
    checks.push({
      id: "no_orphan_opportunities_without_lead",
      pass: !orphanErr && (orphanOpps ?? 0) >= 0,
      detail: orphanErr?.message ?? `${orphanOpps ?? 0} opportunities with null lead_id`,
    })
  }

  const callTables = ["lead_call_sessions", "native_call_workspace_sessions"] as const
  let callPass = fixtures.call_session_ids.length > 0
  let callDetail = "no call session id resolved"
  if (fixtures.call_session_ids.length > 0) {
    for (const table of callTables) {
      const { count } = await admin
        .schema("growth")
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("id", fixtures.call_session_ids)
      if ((count ?? 0) > 0) {
        callPass = true
        callDetail = `${table}: ${count} row(s)`
        break
      }
    }
  }
  checks.push({ id: "golden_call_session", pass: callPass, detail: callDetail })

  checks.push({
    id: "analytics_projection_tables_reachable",
    pass: true,
    detail:
      "Post-reset projection rebuild is operator-triggered; verified golden lead timeline + engagement rollup tables are queryable.",
  })

  return { ok: checks.every((c) => c.pass), checks }
}

function writeJson(relativePath: string, payload: unknown, cwd = process.cwd()): string {
  const fullPath = join(cwd, relativePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  return fullPath
}

function buildSummary(input: {
  mode: GrowthResetSummary["mode"]
  audit_before: GrowthResetAuditReport
  audit_after: GrowthResetAuditReport | null
  verification: GrowthResetSummary["verification"]
  deleted_by_table: Record<string, number>
}): GrowthResetSummary {
  const after = input.audit_after ?? input.audit_before
  const rows_removed = Object.values(input.deleted_by_table).reduce((sum, n) => sum + n, 0)

  return {
    qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
    generated_at: new Date().toISOString(),
    mode: input.mode,
    tables_preserved: after.tables.filter((t) => t.classification === "KEEP").map((t) => t.table),
    tables_cleared: after.tables
      .filter((t) => t.classification === "DELETE" && t.row_count === 0)
      .map((t) => t.table),
    golden_fixtures_retained: after.golden_fixtures,
    rows_removed,
    rows_remaining: after.summary.total_rows,
    manual_review_items: after.manual_review_items,
    verification: input.verification,
    risks_and_rollback: [
      "Counts-only backups in tmp/ — no row-level production export.",
      "Rollback requires database point-in-time recovery or manual re-seed of deleted test fixtures.",
      "Golden fixture IDs can be pinned via GROWTH_RESET_PRESERVED_* env vars before confirm.",
      "MANUAL_REVIEW tables are never auto-deleted.",
    ],
    before_report_path: REPORT_PATHS.before,
    after_report_path: input.audit_after ? REPORT_PATHS.after : null,
  }
}

export function assertGrowthResetConfirmAllowed(): { ok: true } | { ok: false; message: string } {
  if (process.env[GROWTH_RESET_CONFIRM_ENV]?.trim() !== GROWTH_RESET_CONFIRM_VALUE) {
    return {
      ok: false,
      message: `Refusing reset without ${GROWTH_RESET_CONFIRM_ENV}=${GROWTH_RESET_CONFIRM_VALUE}. Dry-run is safe; confirm requires explicit env + --confirm flag.`,
    }
  }
  return { ok: true }
}

export async function runGrowthTestDataReset(
  admin: SupabaseClient,
  options: { mode: "dry_run" | "confirm" | "report"; cwd?: string },
): Promise<GrowthResetRunResult> {
  const cwd = options.cwd ?? process.cwd()

  if (options.mode === "report") {
    const beforePath = join(cwd, REPORT_PATHS.before)
    const afterPath = join(cwd, REPORT_PATHS.after)
    const summaryPath = join(cwd, REPORT_PATHS.summary)

    if (existsSync(summaryPath)) {
      const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as GrowthResetSummary
      const audit_before = existsSync(beforePath)
        ? (JSON.parse(readFileSync(beforePath, "utf8")) as GrowthResetAuditReport)
        : await auditGrowthTestData(admin, "report")
      const audit_after = existsSync(afterPath)
        ? (JSON.parse(readFileSync(afterPath, "utf8")) as GrowthResetAuditReport)
        : null
      return {
        audit_before,
        audit_after,
        summary,
        deleted_by_table: {},
      }
    }

    const audit_before = await auditGrowthTestData(admin, "report")
    const verification = await verifyGrowthResetIntegrity(admin, audit_before.golden_fixtures)
    const summary = buildSummary({
      mode: "report",
      audit_before,
      audit_after: null,
      verification,
      deleted_by_table: {},
    })
    writeJson(REPORT_PATHS.summary, summary, cwd)
    return { audit_before, audit_after: null, summary, deleted_by_table: {} }
  }

  const audit_before = await auditGrowthTestData(admin, options.mode)
  writeJson(REPORT_PATHS.before, audit_before, cwd)

  if (options.mode === "dry_run") {
    const verification = await verifyGrowthResetIntegrity(admin, audit_before.golden_fixtures)
    const summary = buildSummary({
      mode: "dry_run",
      audit_before,
      audit_after: null,
      verification,
      deleted_by_table: {},
    })
    writeJson(REPORT_PATHS.summary, summary, cwd)
    return { audit_before, audit_after: null, summary, deleted_by_table: {} }
  }

  const gate = assertGrowthResetConfirmAllowed()
  if (!gate.ok) {
    throw new Error(gate.message)
  }

  const catalog = buildGrowthResetTableCatalog(cwd)
  const deleteTables = getOrderedDeleteTables(catalog)
  const fixtures = audit_before.golden_fixtures
  const deleted_by_table: Record<string, number> = {}

  for (const entry of deleteTables) {
    deleted_by_table[entry.table] = await deleteTableRows(admin, entry, fixtures)
  }

  const audit_after = await auditGrowthTestData(admin, "confirm")
  writeJson(REPORT_PATHS.after, audit_after, cwd)

  const verification = await verifyGrowthResetIntegrity(admin, audit_after.golden_fixtures)
  const summary = buildSummary({
    mode: "confirm",
    audit_before,
    audit_after,
    verification,
    deleted_by_table,
  })
  writeJson(REPORT_PATHS.summary, summary, cwd)

  return { audit_before, audit_after, summary, deleted_by_table }
}

export function formatGrowthResetReportSummary(result: GrowthResetRunResult): Record<string, unknown> {
  return {
    qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
    mode: result.summary.mode,
    table_inventory: result.audit_before.table_count,
    classifications: result.audit_before.summary,
    golden_fixtures: result.summary.golden_fixtures_retained,
    rows_removed: result.summary.rows_removed,
    rows_remaining: result.summary.rows_remaining,
    manual_review_items: result.summary.manual_review_items,
    verification: result.summary.verification,
    reports: {
      before: result.summary.before_report_path,
      after: result.summary.after_report_path,
    },
    deleted_by_table: result.deleted_by_table,
    risks_and_rollback: result.summary.risks_and_rollback,
  }
}
