/**
 * GS-GROWTH-OPS-7B — Schema-aware delete strategies for Growth reset confirm path.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthResetTableCatalogEntry } from "./growth-test-data-reset-table-inventory"
import {
  sanitizeGrowthResetPreservedFkValues,
  sanitizeGrowthResetPreservedIds,
} from "./growth-test-data-reset-preserved-ids"
import { probeGrowthResetDeleteFkColumn } from "./growth-test-data-reset-fk-mapping"

/** Tables whose primary key is not discoverable via `id` alone (migration-confirmed). */
export const GROWTH_RESET_EXPLICIT_PRIMARY_KEYS: Record<string, string[]> = {
  ai_copilot_generation_playbook_rules: ["generation_id", "approved_rule_id"],
  growth_engagement_event_rollups: ["organization_id", "rollup_date", "event_type"],
}

export type GrowthResetDeleteStrategyKind =
  | "skip_keep"
  | "skip_manual_review"
  | "delete_by_uuid_id"
  | "delete_by_composite_key"
  | "delete_by_fk_exclusion"
  | "blocked"

export type GrowthResetDeleteStrategy = {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  kind: GrowthResetDeleteStrategyKind
  primary_key_columns: string[]
  preserve_fk_column: string | null
  reason: string | null
}

export type GrowthResetDeleteBlock = {
  table: string
  classification: "DELETE"
  reason: "delete_key_unavailable" | "delete_fk_column_missing"
  primary_key_columns: string[]
  message: string | null
  code: string | null
  details: string | null
  hint: string | null
}

export type GrowthResetDeletePlanEntry = {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  status: "deletable" | "skipped" | "blocked"
  strategy: GrowthResetDeleteStrategyKind
  primary_key_columns: string[]
  preserve_fk_column: string | null
  reason: string | null
}

export type GrowthResetDeletePreflightReport = {
  deletable_tables: string[]
  skipped_tables: string[]
  blocked_delete_tables: GrowthResetDeleteBlock[]
  delete_plan: GrowthResetDeletePlanEntry[]
}

function parsePrimaryKeyFromCreateBlock(block: string): string[] | null {
  const inlineComposite = block.match(/primary\s+key\s*\(([^)]+)\)/i)
  if (inlineComposite?.[1]) {
    return inlineComposite[1]
      .split(",")
      .map((column) => column.trim().replace(/"/g, ""))
      .filter(Boolean)
  }
  if (/\bid\s+uuid\s+primary\s+key\b/i.test(block)) return ["id"]
  if (/\bid\s+uuid\b/i.test(block)) return ["id"]
  return null
}

export function extractGrowthTablePrimaryKeysFromMigrations(cwd = process.cwd()): Record<string, string[]> {
  const dir = join(cwd, "supabase/migrations")
  const createRe = /create table if not exists growth\.([a-z0-9_]+)\s*\(/gi
  const keys: Record<string, string[]> = { ...GROWTH_RESET_EXPLICIT_PRIMARY_KEYS }

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue
    const sql = readFileSync(join(dir, file), "utf8")
    let match: RegExpExecArray | null
    while ((match = createRe.exec(sql)) !== null) {
      const table = match[1]!
      const start = match.index + match[0].length
      let depth = 1
      let end = start
      while (end < sql.length && depth > 0) {
        const char = sql[end]
        if (char === "(") depth += 1
        if (char === ")") depth -= 1
        end += 1
      }
      const block = sql.slice(start, end - 1)
      const parsed = parsePrimaryKeyFromCreateBlock(block)
      if (parsed?.length) keys[table] = parsed
    }
  }

  return keys
}

export function resolveGrowthResetDeleteStrategy(
  entry: GrowthResetTableCatalogEntry,
  primaryKeys: Record<string, string[]>,
): GrowthResetDeleteStrategy {
  if (entry.classification === "KEEP") {
    return {
      table: entry.table,
      classification: entry.classification,
      kind: "skip_keep",
      primary_key_columns: primaryKeys[entry.table] ?? ["id"],
      preserve_fk_column: null,
      reason: "KEEP tables are never deleted.",
    }
  }

  if (entry.classification === "MANUAL_REVIEW") {
    return {
      table: entry.table,
      classification: entry.classification,
      kind: "skip_manual_review",
      primary_key_columns: primaryKeys[entry.table] ?? ["id"],
      preserve_fk_column: null,
      reason: "MANUAL_REVIEW tables require operator review.",
    }
  }

  const primary_key_columns = primaryKeys[entry.table] ?? ["id"]

  if (primary_key_columns.length === 0) {
    return {
      table: entry.table,
      classification: entry.classification,
      kind: "blocked",
      primary_key_columns: [],
      preserve_fk_column: entry.delete_fk_column,
      reason: "delete_key_unavailable",
    }
  }

  if (primary_key_columns.length === 1 && primary_key_columns[0] === "id") {
    return {
      table: entry.table,
      classification: entry.classification,
      kind: entry.delete_fk_column ? "delete_by_fk_exclusion" : "delete_by_uuid_id",
      primary_key_columns,
      preserve_fk_column: entry.delete_fk_column,
      reason: null,
    }
  }

  return {
    table: entry.table,
    classification: entry.classification,
    kind: entry.delete_fk_column ? "delete_by_fk_exclusion" : "delete_by_composite_key",
    primary_key_columns,
    preserve_fk_column: entry.delete_fk_column,
    reason: null,
  }
}

function toDeleteBlock(
  table: string,
  primary_key_columns: string[],
  error: unknown,
): GrowthResetDeleteBlock {
  const err = error as {
    message?: string
    code?: string
    details?: string
    hint?: string
  } | null
  return {
    table,
    classification: "DELETE",
    reason: "delete_key_unavailable",
    primary_key_columns,
    message:
      typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Delete strategy probe failed",
    code: typeof err?.code === "string" ? err.code : null,
    details: typeof err?.details === "string" ? err.details : null,
    hint: typeof err?.hint === "string" ? err.hint : null,
  }
}

async function probeDeleteStrategyColumns(
  admin: SupabaseClient,
  strategy: GrowthResetDeleteStrategy,
): Promise<{ ok: true } | { ok: false; error: GrowthResetDeleteBlock }> {
  if (strategy.kind === "skip_keep" || strategy.kind === "skip_manual_review") {
    return { ok: true }
  }

  const selectColumns =
    strategy.kind === "delete_by_fk_exclusion" && strategy.preserve_fk_column
      ? strategy.preserve_fk_column
      : strategy.primary_key_columns.join(", ")

  const { error } = await admin
    .schema("growth")
    .from(strategy.table)
    .select(selectColumns)
    .limit(1)

  if (error) {
    return { ok: false, error: toDeleteBlock(strategy.table, strategy.primary_key_columns, error) }
  }
  return { ok: true }
}

export async function buildGrowthResetDeletePreflight(
  admin: SupabaseClient,
  catalog: GrowthResetTableCatalogEntry[],
  primaryKeys: Record<string, string[]>,
): Promise<GrowthResetDeletePreflightReport> {
  const delete_plan: GrowthResetDeletePlanEntry[] = []
  const deletable_tables: string[] = []
  const skipped_tables: string[] = []
  const blocked_delete_tables: GrowthResetDeleteBlock[] = []

  for (const entry of catalog) {
    const strategy = resolveGrowthResetDeleteStrategy(entry, primaryKeys)

    if (strategy.kind === "skip_keep" || strategy.kind === "skip_manual_review") {
      skipped_tables.push(entry.table)
      delete_plan.push({
        table: entry.table,
        classification: entry.classification,
        status: "skipped",
        strategy: strategy.kind,
        primary_key_columns: strategy.primary_key_columns,
        preserve_fk_column: strategy.preserve_fk_column,
        reason: strategy.reason,
      })
      continue
    }

    if (strategy.kind === "blocked") {
      const block: GrowthResetDeleteBlock = {
        table: entry.table,
        classification: "DELETE",
        reason: "delete_key_unavailable",
        primary_key_columns: strategy.primary_key_columns,
        message: "No primary key columns resolved for DELETE table.",
        code: null,
        details: null,
        hint: null,
      }
      blocked_delete_tables.push(block)
      delete_plan.push({
        table: entry.table,
        classification: entry.classification,
        status: "blocked",
        strategy: strategy.kind,
        primary_key_columns: strategy.primary_key_columns,
        preserve_fk_column: strategy.preserve_fk_column,
        reason: block.message,
      })
      continue
    }

    if (entry.delete_fk_column) {
      const fkProbe = await probeGrowthResetDeleteFkColumn(
        admin,
        entry.table,
        entry.delete_fk_column,
      )
      if (!fkProbe.ok) {
        const block: GrowthResetDeleteBlock = {
          table: entry.table,
          classification: "DELETE",
          reason: "delete_fk_column_missing",
          primary_key_columns: strategy.primary_key_columns,
          message: fkProbe.message,
          code: fkProbe.code,
          details: null,
          hint: null,
        }
        blocked_delete_tables.push(block)
        delete_plan.push({
          table: entry.table,
          classification: entry.classification,
          status: "blocked",
          strategy: strategy.kind,
          primary_key_columns: strategy.primary_key_columns,
          preserve_fk_column: strategy.preserve_fk_column,
          reason: block.message,
        })
        continue
      }
    }

    const probe = await probeDeleteStrategyColumns(admin, strategy)
    if (!probe.ok) {
      blocked_delete_tables.push(probe.error)
      delete_plan.push({
        table: entry.table,
        classification: entry.classification,
        status: "blocked",
        strategy: strategy.kind,
        primary_key_columns: strategy.primary_key_columns,
        preserve_fk_column: strategy.preserve_fk_column,
        reason: probe.error.message,
      })
      continue
    }

    deletable_tables.push(entry.table)
    delete_plan.push({
      table: entry.table,
      classification: entry.classification,
      status: "deletable",
      strategy: strategy.kind,
      primary_key_columns: strategy.primary_key_columns,
      preserve_fk_column: strategy.preserve_fk_column,
      reason: null,
    })
  }

  return {
    deletable_tables,
    skipped_tables,
    blocked_delete_tables,
    delete_plan,
  }
}

export function assertGrowthResetDeletePreflightSafe(
  preflight: GrowthResetDeletePreflightReport,
): { ok: true } | { ok: false; error: GrowthResetDeletePreflightError } {
  if (preflight.blocked_delete_tables.length === 0) return { ok: true }
  return {
    ok: false,
    error: new GrowthResetDeletePreflightError(preflight),
  }
}

export class GrowthResetDeletePreflightError extends Error {
  readonly blocked_delete_tables: GrowthResetDeleteBlock[]
  readonly delete_plan: GrowthResetDeletePlanEntry[]

  constructor(preflight: GrowthResetDeletePreflightReport) {
    const primary = preflight.blocked_delete_tables[0]
    super(
      primary
        ? `DELETE table delete strategy unavailable for ${primary.table}: ${primary.message ?? primary.reason}`
        : "Growth reset delete preflight failed.",
    )
    this.name = "GrowthResetDeletePreflightError"
    this.blocked_delete_tables = preflight.blocked_delete_tables
    this.delete_plan = preflight.delete_plan
  }

  toJSON(): Record<string, unknown> {
    return {
      error: "growth_reset_delete_preflight_failed",
      blocked_delete_tables: this.blocked_delete_tables,
      delete_plan: this.delete_plan,
    }
  }
}

function rowMatchesPreservedFilters(
  row: Record<string, unknown>,
  preservedIds: string[],
  fkColumn: string | null,
  preservedFkSet: Set<string>,
): boolean {
  if (preservedIds.length > 0) {
    const rowId = row.id
    if (typeof rowId === "string" && preservedIds.includes(rowId)) return true
  }
  if (fkColumn && preservedFkSet.size > 0) {
    const fk = row[fkColumn]
    if (typeof fk === "string" && preservedFkSet.has(fk)) return true
  }
  return false
}

/** Delete rows using resolved primary key columns (supports composite PK tables). */
export async function deleteGrowthTableRowsWithStrategy(
  admin: SupabaseClient,
  entry: GrowthResetTableCatalogEntry,
  strategy: GrowthResetDeleteStrategy,
  options: {
    preservedIds: string[]
    preservedFkValues: string[]
    pageSize?: number
  },
): Promise<number> {
  if (
    strategy.kind === "skip_keep" ||
    strategy.kind === "skip_manual_review" ||
    strategy.kind === "blocked"
  ) {
    return 0
  }

  const pageSize = options.pageSize ?? 500
  const fkColumn = strategy.preserve_fk_column
  const preservedIds = sanitizeGrowthResetPreservedIds(
    `preserved_id_${entry.table}`,
    options.preservedIds,
  ).valid
  const preservedFkValues = fkColumn
    ? sanitizeGrowthResetPreservedFkValues(fkColumn, options.preservedFkValues).valid
    : []
  const preservedFkSet = new Set(preservedFkValues)
  const selectColumns = [
    ...new Set([
      ...strategy.primary_key_columns,
      ...(fkColumn ? [fkColumn] : []),
      ...(preservedIds.length > 0 ? ["id"] : []),
    ]),
  ].join(", ")

  let deleted = 0
  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(entry.table)
      .select(selectColumns)
      .range(0, pageSize - 1)
    if (error) throw new Error(`${entry.table} delete scan: ${error.message}`)

    const rows = (data ?? []) as Record<string, unknown>[]
    if (rows.length === 0) break

    for (const row of rows) {
      if (rowMatchesPreservedFilters(row, preservedIds, fkColumn, preservedFkSet)) {
        continue
      }

      let query = admin.schema("growth").from(entry.table).delete({ count: "exact" })
      for (const column of strategy.primary_key_columns) {
        const value = row[column]
        if (value === null || value === undefined) {
          query = query.is(column, null)
        } else {
          query = query.eq(column, value as string | number | boolean)
        }
      }
      const { count, error: deleteError } = await query
      if (deleteError) throw new Error(`${entry.table} delete row: ${deleteError.message}`)
      deleted += count ?? 1
    }

    if (rows.length < pageSize) break
  }

  return deleted
}
