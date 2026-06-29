/**
 * GE-AVA-FRESH-SLATE-1A — Audit, reset, verify Growth Engine operational state for one org.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
  REPORT_PATHS,
  type GrowthEngineOperationalResetCategory,
} from "./growth-engine-operational-reset-constants"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES,
  getGrowthEngineOperationalResetTableEntries,
  type GrowthEngineOperationalResetTableEntry,
} from "./growth-engine-operational-reset-table-inventory"

const LEAD_ID_BATCH = 200

export type GrowthEngineOperationalResetTableAuditRow = {
  table: string
  category: GrowthEngineOperationalResetCategory
  scope: GrowthEngineOperationalResetTableEntry["scope"]
  row_count: number | null
  count_status: "ok" | "table_missing" | "count_unavailable"
  count_error: string | null
  scope_filter: string
  notes: string | null
}

export type GrowthEngineOperationalResetAuditReport = {
  qa_marker: typeof GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER
  generated_at: string
  mode: "dry_run" | "execute"
  organization_id: string
  organization_name: string | null
  scope_summary: {
    org_scoped_tables: number
    lead_scoped_tables: number
    single_tenant_tables: number
    resolved_lead_ids: number
    single_tenant_attribution: string
  }
  preserved_tables: Array<{ table: string; row_count: number | null }>
  tables: GrowthEngineOperationalResetTableAuditRow[]
  summary: {
    tables_with_rows: number
    total_rows_to_clear: number
    count_unavailable_tables: number
  }
}

export type GrowthEngineOperationalResetVerificationCheck = {
  id: string
  pass: boolean
  detail: string
}

export type GrowthEngineOperationalResetTableDeleteStatus = "deleted" | "skipped" | "failed"

export type GrowthEngineOperationalResetTableDeleteResult = {
  table: string
  rows_before: number | null
  delete_attempted: boolean
  rows_deleted: number
  rows_after: number | null
  status: GrowthEngineOperationalResetTableDeleteStatus
  error: string | null
}

export type GrowthEngineOperationalResetExecutionSummary = {
  total_rows_before: number
  total_rows_deleted: number
  total_rows_remaining: number
  failed_tables: string[]
  skipped_tables: string[]
  top_remaining_tables: Array<{ table: string; rows_remaining: number }>
  strict_mode: boolean
  completed_with_warnings: boolean
}

export type GrowthEngineOperationalResetRunResult = {
  audit_before: GrowthEngineOperationalResetAuditReport
  audit_after: GrowthEngineOperationalResetAuditReport | null
  deleted_by_table: Record<string, number>
  table_results: GrowthEngineOperationalResetTableDeleteResult[]
  execution_summary: GrowthEngineOperationalResetExecutionSummary | null
  verification: {
    ok: boolean
    checks: GrowthEngineOperationalResetVerificationCheck[]
  }
}

type ResetScopeContext = {
  organizationId: string
  leadIds: string[]
  singleTenantAttribution: string
}

function isMissingRelation(message: string): boolean {
  return /does not exist|Could not find|relation .* does not exist|PGRST205/i.test(message)
}

function isPermissionDenied(message: string): boolean {
  return /permission denied/i.test(message)
}

function scopeFilterDescription(entry: GrowthEngineOperationalResetTableEntry, ctx: ResetScopeContext): string {
  switch (entry.scope) {
    case "organization_id":
      return `organization_id = ${ctx.organizationId}`
    case "org_id":
      return `org_id = ${ctx.organizationId}`
    case "lead_id":
      return ctx.leadIds.length > 0
        ? `lead_id IN (${ctx.leadIds.length} org lead id(s))`
        : "lead_id IN (all growth leads — single-tenant fallback)"
    case "single_tenant":
      return `all rows (${ctx.singleTenantAttribution})`
    default:
      return "unknown"
  }
}

function applyScopeFilter<T extends { eq: Function; in: Function }>(
  query: T,
  entry: GrowthEngineOperationalResetTableEntry,
  ctx: ResetScopeContext,
): T {
  switch (entry.scope) {
    case "organization_id":
      return query.eq("organization_id", ctx.organizationId) as T
    case "org_id":
      return query.eq("org_id", ctx.organizationId) as T
    case "lead_id":
      if (ctx.leadIds.length > 0) {
        return query.in("lead_id", ctx.leadIds) as T
      }
      return query as T
    case "single_tenant":
      return query as T
    default:
      return query as T
  }
}

async function countScopedRows(
  admin: SupabaseClient,
  entry: GrowthEngineOperationalResetTableEntry,
  ctx: ResetScopeContext,
): Promise<{ count: number | null; status: GrowthEngineOperationalResetTableAuditRow["count_status"]; error: string | null }> {
  let query = admin.schema("growth").from(entry.table).select("id", { count: "exact", head: true })
  query = applyScopeFilter(query, entry, ctx)

  const { count, error } = await query
  if (error) {
    const message = error.message ?? String(error)
    if (isMissingRelation(message)) {
      return { count: null, status: "table_missing", error: message }
    }
    return { count: null, status: "count_unavailable", error: message }
  }
  return { count: count ?? 0, status: "ok", error: null }
}

async function attemptDeleteScopedRows(
  admin: SupabaseClient,
  entry: GrowthEngineOperationalResetTableEntry,
  ctx: ResetScopeContext,
): Promise<{ rows_deleted: number; error: string | null }> {
  try {
    if (entry.scope === "lead_id" && ctx.leadIds.length === 0) {
      const { count, error } = await admin
        .schema("growth")
        .from(entry.table)
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000")
      if (error && !isMissingRelation(error.message ?? "")) {
        return { rows_deleted: 0, error: error.message ?? String(error) }
      }
      return { rows_deleted: count ?? 0, error: null }
    }

    if (entry.scope === "lead_id" && ctx.leadIds.length > 0) {
      let deleted = 0
      for (let i = 0; i < ctx.leadIds.length; i += LEAD_ID_BATCH) {
        const batch = ctx.leadIds.slice(i, i + LEAD_ID_BATCH)
        const { count, error } = await admin
          .schema("growth")
          .from(entry.table)
          .delete({ count: "exact" })
          .in("lead_id", batch)
        if (error && !isMissingRelation(error.message ?? "")) {
          return { rows_deleted: deleted, error: error.message ?? String(error) }
        }
        deleted += count ?? 0
      }
      return { rows_deleted: deleted, error: null }
    }

    let query = admin.schema("growth").from(entry.table).delete({ count: "exact" })
    query = applyScopeFilter(query, entry, ctx)
    const { count, error } = await query
    if (error && !isMissingRelation(error.message ?? "")) {
      return { rows_deleted: 0, error: error.message ?? String(error) }
    }
    return { rows_deleted: count ?? 0, error: null }
  } catch (error) {
    return {
      rows_deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function resolveOrgLeadIds(admin: SupabaseClient, organizationId: string): Promise<string[]> {
  const leadIds = new Set<string>()

  const { data: audienceMembers } = await admin
    .schema("growth")
    .from("growth_audience_members")
    .select("lead_id")
    .eq("organization_id", organizationId)
    .not("lead_id", "is", null)
    .limit(5000)

  for (const row of audienceMembers ?? []) {
    if (row.lead_id) leadIds.add(String(row.lead_id))
  }

  const { data: promotedLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .eq("promoted_organization_id", organizationId)
    .limit(5000)

  for (const row of promotedLeads ?? []) {
    if (row.id) leadIds.add(String(row.id))
  }

  if (leadIds.size === 0) {
    const { data: allLeads } = await admin.schema("growth").from("leads").select("id").limit(5000)
    for (const row of allLeads ?? []) {
      if (row.id) leadIds.add(String(row.id))
    }
  }

  return [...leadIds]
}

async function verifyTargetOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ name: string | null }> {
  const { data, error } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) throw new Error(`organization_lookup_failed: ${error.message}`)
  if (!data?.id) {
    throw new Error(`organization_not_found: ${organizationId}`)
  }
  return { name: typeof data.name === "string" ? data.name : null }
}

async function countPreservedTables(
  admin: SupabaseClient,
): Promise<Array<{ table: string; row_count: number | null }>> {
  const rows: Array<{ table: string; row_count: number | null }> = []
  for (const table of GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES) {
    const { count, error } = await admin
      .schema("growth")
      .from(table)
      .select("id", { count: "exact", head: true })
    rows.push({
      table,
      row_count: error ? null : (count ?? 0),
    })
  }
  return rows
}

async function buildAuditReport(
  admin: SupabaseClient,
  input: {
    mode: "dry_run" | "execute"
    organizationId: string
    organizationName: string | null
    ctx: ResetScopeContext
  },
): Promise<GrowthEngineOperationalResetAuditReport> {
  const entries = getGrowthEngineOperationalResetTableEntries()
  const tables: GrowthEngineOperationalResetTableAuditRow[] = []

  for (const entry of entries) {
    const result = await countScopedRows(admin, entry, input.ctx)
    tables.push({
      table: entry.table,
      category: entry.category,
      scope: entry.scope,
      row_count: result.count,
      count_status: result.status,
      count_error: result.error,
      scope_filter: scopeFilterDescription(entry, input.ctx),
      notes: entry.notes,
    })
  }

  const preserved_tables = await countPreservedTables(admin)
  const rowsToClear = tables.filter((row) => (row.row_count ?? 0) > 0)

  return {
    qa_marker: GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
    generated_at: new Date().toISOString(),
    mode: input.mode,
    organization_id: input.organizationId,
    organization_name: input.organizationName,
    scope_summary: {
      org_scoped_tables: entries.filter((entry) => entry.scope === "organization_id" || entry.scope === "org_id").length,
      lead_scoped_tables: entries.filter((entry) => entry.scope === "lead_id").length,
      single_tenant_tables: entries.filter((entry) => entry.scope === "single_tenant").length,
      resolved_lead_ids: input.ctx.leadIds.length,
      single_tenant_attribution: input.ctx.singleTenantAttribution,
    },
    preserved_tables,
    tables,
    summary: {
      tables_with_rows: rowsToClear.length,
      total_rows_to_clear: rowsToClear.reduce((sum, row) => sum + (row.row_count ?? 0), 0),
      count_unavailable_tables: tables.filter((row) => row.count_status === "count_unavailable").length,
    },
  }
}

async function resetObjectiveCounters(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await admin
    .schema("growth")
    .from("organization_growth_objectives")
    .update({ current_value: 0, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)

  if (error && !isMissingRelation(error.message ?? "")) {
    return { ok: false, error: error.message ?? String(error) }
  }
  return { ok: true, error: null }
}

function rowsBeforeFromAudit(
  audit: GrowthEngineOperationalResetAuditReport,
  table: string,
): { rows_before: number | null; count_status: GrowthEngineOperationalResetTableAuditRow["count_status"] } {
  const row = audit.tables.find((entry) => entry.table === table)
  if (!row) return { rows_before: null, count_status: "count_unavailable" }
  return { rows_before: row.row_count, count_status: row.count_status }
}

async function deleteInventoryTable(
  admin: SupabaseClient,
  entry: GrowthEngineOperationalResetTableEntry,
  ctx: ResetScopeContext,
  auditBefore: GrowthEngineOperationalResetAuditReport,
): Promise<GrowthEngineOperationalResetTableDeleteResult> {
  const { rows_before, count_status } = rowsBeforeFromAudit(auditBefore, entry.table)

  if (count_status === "table_missing") {
    return {
      table: entry.table,
      rows_before,
      delete_attempted: false,
      rows_deleted: 0,
      rows_after: null,
      status: "skipped",
      error: "table_missing",
    }
  }

  if (count_status === "ok" && (rows_before ?? 0) === 0) {
    return {
      table: entry.table,
      rows_before: 0,
      delete_attempted: false,
      rows_deleted: 0,
      rows_after: 0,
      status: "skipped",
      error: null,
    }
  }

  const attempt = await attemptDeleteScopedRows(admin, entry, ctx)
  const afterCount = await countScopedRows(admin, entry, ctx)
  const rows_after = afterCount.status === "ok" ? afterCount.count : null

  if (attempt.error) {
    return {
      table: entry.table,
      rows_before,
      delete_attempted: true,
      rows_deleted: attempt.rows_deleted,
      rows_after,
      status: "failed",
      error: isPermissionDenied(attempt.error)
        ? attempt.error
        : attempt.error,
    }
  }

  return {
    table: entry.table,
    rows_before,
    delete_attempted: true,
    rows_deleted: attempt.rows_deleted,
    rows_after,
    status: "deleted",
    error: null,
  }
}

function buildExecutionSummary(input: {
  table_results: GrowthEngineOperationalResetTableDeleteResult[]
  strict: boolean
}): GrowthEngineOperationalResetExecutionSummary {
  const total_rows_before = input.table_results.reduce((sum, row) => sum + (row.rows_before ?? 0), 0)
  const total_rows_deleted = input.table_results.reduce((sum, row) => sum + row.rows_deleted, 0)
  const total_rows_remaining = input.table_results.reduce((sum, row) => sum + (row.rows_after ?? 0), 0)
  const failed_tables = input.table_results.filter((row) => row.status === "failed").map((row) => row.table)
  const skipped_tables = input.table_results.filter((row) => row.status === "skipped").map((row) => row.table)
  const top_remaining_tables = input.table_results
    .filter((row) => (row.rows_after ?? 0) > 0)
    .sort((a, b) => (b.rows_after ?? 0) - (a.rows_after ?? 0))
    .slice(0, 15)
    .map((row) => ({ table: row.table, rows_remaining: row.rows_after ?? 0 }))

  return {
    total_rows_before,
    total_rows_deleted,
    total_rows_remaining,
    failed_tables,
    skipped_tables,
    top_remaining_tables,
    strict_mode: input.strict,
    completed_with_warnings: failed_tables.length > 0 && !input.strict,
  }
}

export async function verifyGrowthEngineOperationalReset(
  admin: SupabaseClient,
  organizationId: string,
  preservedBefore: Array<{ table: string; row_count: number | null }>,
): Promise<{ ok: boolean; checks: GrowthEngineOperationalResetVerificationCheck[] }> {
  const checks: GrowthEngineOperationalResetVerificationCheck[] = []

  const operationalChecks: Array<{
    id: string
    table: string
    scope: GrowthEngineOperationalResetTableEntry["scope"]
    label: string
  }> = [
    { id: "no_ai_work_orders", table: "ai_work_orders", scope: "organization_id", label: "AI work orders cleared" },
    {
      id: "no_pending_human_approvals",
      table: "human_execution_approvals",
      scope: "organization_id",
      label: "Human execution approvals cleared",
    },
    {
      id: "no_outreach_queue_drafts",
      table: "outreach_queue",
      scope: "single_tenant",
      label: "Outreach queue cleared",
    },
    {
      id: "no_sequence_execution_jobs",
      table: "sequence_execution_jobs",
      scope: "single_tenant",
      label: "Sequence execution jobs cleared",
    },
    {
      id: "no_inbox_threads",
      table: "inbox_threads",
      scope: "single_tenant",
      label: "Inbox threads cleared",
    },
    {
      id: "no_outbound_replies",
      table: "outbound_replies",
      scope: "single_tenant",
      label: "Outbound replies cleared",
    },
    {
      id: "no_lead_inbox",
      table: "lead_inbox",
      scope: "single_tenant",
      label: "Lead inbox cleared",
    },
    {
      id: "no_opportunities",
      table: "opportunities",
      scope: "single_tenant",
      label: "Opportunities cleared",
    },
    {
      id: "no_leads",
      table: "leads",
      scope: "single_tenant",
      label: "Growth leads cleared (daily queue inputs)",
    },
    {
      id: "no_operator_notifications",
      table: "operator_notifications",
      scope: "organization_id",
      label: "Operator notifications cleared",
    },
    {
      id: "no_operational_alerts",
      table: "operational_alerts",
      scope: "single_tenant",
      label: "Operational alerts cleared",
    },
    {
      id: "no_lead_research_runs",
      table: "lead_research_runs",
      scope: "lead_id",
      label: "Lead research runs cleared",
    },
  ]

  const leadIds = await resolveOrgLeadIds(admin, organizationId)
  const ctx: ResetScopeContext = {
    organizationId,
    leadIds,
    singleTenantAttribution: `Precision Biomedical AI OS (${organizationId})`,
  }

  for (const check of operationalChecks) {
    const entry = getGrowthEngineOperationalResetTableEntries().find((row) => row.table === check.table)
    if (!entry) continue
    const result = await countScopedRows(admin, entry, ctx)
    checks.push({
      id: check.id,
      pass: (result.count ?? 0) === 0,
      detail: `${check.label}: ${result.count ?? 0} row(s)`,
    })
  }

  const preservedAfter = await countPreservedTables(admin)
  for (const before of preservedBefore) {
    const after = preservedAfter.find((row) => row.table === before.table)
    const pass = before.row_count === null || after?.row_count === before.row_count
    checks.push({
      id: `preserved_${before.table}`,
      pass,
      detail: `${before.table}: before=${before.row_count ?? "n/a"} after=${after?.row_count ?? "n/a"}`,
    })
  }

  const { count: mailboxCount, error: mailboxError } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id", { count: "exact", head: true })

  const preservedMailbox = preservedBefore.find((row) => row.table === "mailbox_connections")
  checks.push({
    id: "mailbox_connections_preserved",
    pass: !mailboxError && preservedMailbox?.row_count === (mailboxCount ?? 0),
    detail: mailboxError
      ? mailboxError.message
      : `mailbox_connections: before=${preservedMailbox?.row_count ?? "n/a"} after=${mailboxCount ?? 0}`,
  })

  return { ok: checks.every((check) => check.pass), checks }
}

function persistReport(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

export async function runGrowthEngineOperationalReset(
  admin: SupabaseClient,
  input: {
    organizationId?: string
    execute: boolean
    persistReports?: boolean
    strict?: boolean
  },
): Promise<GrowthEngineOperationalResetRunResult> {
  const strict = input.strict === true
  const organizationId = input.organizationId?.trim() || PRECISION_BIOMEDICAL_AI_OS_ORG_ID
  const { name: organizationName } = await verifyTargetOrganization(admin, organizationId)
  const leadIds = await resolveOrgLeadIds(admin, organizationId)

  const ctx: ResetScopeContext = {
    organizationId,
    leadIds,
    singleTenantAttribution: `single-tenant Growth Engine workspace for ${organizationName ?? organizationId}`,
  }

  const audit_before = await buildAuditReport(admin, {
    mode: input.execute ? "execute" : "dry_run",
    organizationId,
    organizationName,
    ctx,
  })

  if (input.persistReports !== false) {
    persistReport(REPORT_PATHS.before, audit_before)
  }

  if (!input.execute) {
    return {
      audit_before,
      audit_after: null,
      deleted_by_table: {},
      table_results: [],
      execution_summary: null,
      verification: {
        ok: true,
        checks: [
          {
            id: "dry_run_only",
            pass: true,
            detail: "Dry run — no rows deleted. Re-run with --execute to apply.",
          },
        ],
      },
    }
  }

  const table_results: GrowthEngineOperationalResetTableDeleteResult[] = []
  const deleted_by_table: Record<string, number> = {}

  for (const entry of getGrowthEngineOperationalResetTableEntries()) {
    const result = await deleteInventoryTable(admin, entry, ctx, audit_before)
    table_results.push(result)
    deleted_by_table[entry.table] = result.rows_deleted
  }

  const counterReset = await resetObjectiveCounters(admin, organizationId)
  if (!counterReset.ok) {
    table_results.push({
      table: "organization_growth_objectives",
      rows_before: null,
      delete_attempted: true,
      rows_deleted: 0,
      rows_after: null,
      status: "failed",
      error: counterReset.error,
    })
  }

  const execution_summary = buildExecutionSummary({ table_results, strict })

  const audit_after = await buildAuditReport(admin, {
    mode: "execute",
    organizationId,
    organizationName,
    ctx,
  })

  if (input.persistReports !== false) {
    persistReport(REPORT_PATHS.after, audit_after)
  }

  const verification = await verifyGrowthEngineOperationalReset(
    admin,
    organizationId,
    audit_before.preserved_tables,
  )

  const summary = {
    qa_marker: GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
    organization_id: organizationId,
    rows_removed: Object.values(deleted_by_table).reduce((sum, count) => sum + count, 0),
    deleted_by_table,
    table_results,
    execution_summary,
    verification,
  }
  if (input.persistReports !== false) {
    persistReport(REPORT_PATHS.summary, summary)
  }

  return {
    audit_before,
    audit_after,
    deleted_by_table,
    table_results,
    execution_summary,
    verification,
  }
}

export function formatGrowthEngineOperationalResetDryRun(audit: GrowthEngineOperationalResetAuditReport): string {
  const lines: string[] = [
    "",
    `=== ${GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER} ===`,
    `Organization: ${audit.organization_name ?? audit.organization_id} (${audit.organization_id})`,
    `Mode: ${audit.mode}`,
    `Resolved lead ids: ${audit.scope_summary.resolved_lead_ids}`,
    `Tables with rows to clear: ${audit.summary.tables_with_rows}`,
    `Total rows to clear: ${audit.summary.total_rows_to_clear}`,
    "",
    "Affected tables:",
  ]

  for (const row of audit.tables) {
    if ((row.row_count ?? 0) === 0 && row.count_status === "ok") continue
    const countLabel =
      row.count_status === "ok"
        ? String(row.row_count ?? 0)
        : row.count_status === "table_missing"
          ? "MISSING"
          : "UNAVAILABLE"
    lines.push(
      `  - growth.${row.table}: ${countLabel} row(s) [${row.category}] scope=${row.scope_filter}`,
    )
    if (row.notes) lines.push(`      ${row.notes}`)
    if (row.count_error) lines.push(`      error: ${row.count_error}`)
  }

  lines.push("", "Preserved configuration/infrastructure (unchanged):")
  for (const row of audit.preserved_tables) {
    lines.push(`  - growth.${row.table}: ${row.row_count ?? "n/a"} row(s) KEEP`)
  }

  if (audit.mode === "dry_run") {
    lines.push("", "No rows deleted. Re-run with --execute to apply.")
  }

  lines.push("")
  return lines.join("\n")
}

export function formatGrowthEngineOperationalResetTableResult(
  result: GrowthEngineOperationalResetTableDeleteResult,
): string {
  const parts = [
    `growth.${result.table}`,
    `status=${result.status}`,
    `rows_before=${result.rows_before ?? "n/a"}`,
    `delete_attempted=${result.delete_attempted}`,
    `rows_deleted=${result.rows_deleted}`,
    `rows_after=${result.rows_after ?? "n/a"}`,
  ]
  if (result.error) parts.push(`error=${result.error}`)
  return `  - ${parts.join(" | ")}`
}

export function formatGrowthEngineOperationalResetExecutionReport(input: {
  table_results: GrowthEngineOperationalResetTableDeleteResult[]
  execution_summary: GrowthEngineOperationalResetExecutionSummary
}): string {
  const { execution_summary: summary } = input
  const lines: string[] = [
    "",
    "=== Growth operational reset execution report ===",
    "",
    "Per-table results:",
  ]

  for (const result of input.table_results) {
    lines.push(formatGrowthEngineOperationalResetTableResult(result))
  }

  lines.push(
    "",
    "Execution totals:",
    `  total_rows_before: ${summary.total_rows_before}`,
    `  total_rows_deleted: ${summary.total_rows_deleted}`,
    `  total_rows_remaining: ${summary.total_rows_remaining}`,
    `  failed_tables (${summary.failed_tables.length}): ${
      summary.failed_tables.length > 0 ? summary.failed_tables.join(", ") : "(none)"
    }`,
    `  strict_mode: ${summary.strict_mode}`,
    `  completed_with_warnings: ${summary.completed_with_warnings}`,
    "",
    "Top remaining tables by row count:",
  )

  if (summary.top_remaining_tables.length === 0) {
    lines.push("  (none)")
  } else {
    for (const row of summary.top_remaining_tables) {
      lines.push(`  - growth.${row.table}: ${row.rows_remaining} row(s)`)
    }
  }

  if (summary.failed_tables.length > 0) {
    lines.push(
      "",
      "Permission or delete failures did not abort the reset. Remaining Home rows may come from failed tables or tables outside inventory.",
    )
  }

  lines.push("")
  return lines.join("\n")
}
