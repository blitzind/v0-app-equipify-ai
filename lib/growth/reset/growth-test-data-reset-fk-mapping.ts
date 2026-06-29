/**
 * Validates Growth reset DELETE_FK inventory mappings against migration schema and live PostgREST.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthResetTableCatalogEntry } from "./growth-test-data-reset-table-inventory"
import { getGoldenPreservedFkSourceLabel } from "./growth-test-data-reset-fk-mapping-sources"
import { isGrowthResetGoldenIdPreservedTable } from "./growth-test-data-reset-golden-fixtures"

export type GrowthResetFkMappingValidationEntry = {
  table: string
  delete_fk_column: string | null
  status: "validated" | "missing" | "skipped"
  reason: string | null
  golden_fk_source: string | null
  code: string | null
  message: string | null
}

export type GrowthResetFkMappingValidationReport = {
  validated: GrowthResetFkMappingValidationEntry[]
  missing: GrowthResetFkMappingValidationEntry[]
  skipped: GrowthResetFkMappingValidationEntry[]
}

export type GrowthResetDeleteFkInventoryEntry = {
  column: string
  golden_fk_source: string
}

/** Migration-confirmed DELETE table preserved-FK columns. */
export const GROWTH_RESET_DELETE_FK_BY_TABLE: Record<string, GrowthResetDeleteFkInventoryEntry> = {
  lead_timeline_events: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_call_events: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_call_sessions: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_decision_makers: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_memory_events: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_memory_profiles: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_objection_memory: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_preference_memory: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_research_notes: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_research_runs: { column: "lead_id", golden_fk_source: "lead_ids" },
  lead_import_batch_rows: { column: "lead_id", golden_fk_source: "lead_ids" },
  inbox_messages: { column: "thread_id", golden_fk_source: "inbox_thread_ids" },
  inbox_thread_links: { column: "inbox_thread_id", golden_fk_source: "inbox_thread_ids" },
  inbox_thread_owner_history: { column: "inbox_thread_id", golden_fk_source: "inbox_thread_ids" },
  inbox_reply_drafts: { column: "inbox_thread_id", golden_fk_source: "inbox_thread_ids" },
  personalization_evidence: { column: "generation_id", golden_fk_source: "generation_ids" },
  personalization_feedback: { column: "generation_id", golden_fk_source: "generation_ids" },
  personalization_risk_events: { column: "generation_id", golden_fk_source: "generation_ids" },
  sequence_enrollment_steps: { column: "enrollment_id", golden_fk_source: "sequence_enrollment_ids" },
  sequence_enrollment_step_waits: { column: "enrollment_id", golden_fk_source: "sequence_enrollment_ids" },
  sequence_enrollment_channel_events: { column: "enrollment_id", golden_fk_source: "sequence_enrollment_ids" },
  opportunity_stage_history: { column: "opportunity_id", golden_fk_source: "opportunity_ids" },
  opportunity_signals: { column: "lead_id", golden_fk_source: "lead_ids" },
  opportunity_recommendations: { column: "lead_id", golden_fk_source: "lead_ids" },
  meeting_outcome_intelligence_scores: { column: "meeting_id", golden_fk_source: "meeting_ids" },
  company_contacts: { column: "company_id", golden_fk_source: "company_ids" },
  company_domains: { column: "company_id", golden_fk_source: "company_ids" },
  company_evidence_sources: { column: "company_id", golden_fk_source: "company_ids" },
  company_profiles: { column: "company_id", golden_fk_source: "company_ids" },
}

/** DELETE tables without a direct golden FK preservation path. */
export const GROWTH_RESET_DELETE_FK_SKIP_NOTES: Record<string, string> = {
  company_enrichments:
    "No direct golden FK — row links external_company_candidates via company_candidate_id, not growth.companies.company_id.",
  company_signals:
    "No direct golden FK — row links external_company_candidates via company_candidate_id, not growth.companies.company_id.",
}

export function resolveGrowthResetDeleteFkColumn(input: {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  golden_entity: GrowthResetTableCatalogEntry["golden_entity"]
}): string | null {
  if (input.classification !== "DELETE") return null
  if (GROWTH_RESET_DELETE_FK_SKIP_NOTES[input.table] !== undefined) return null

  const explicit = GROWTH_RESET_DELETE_FK_BY_TABLE[input.table]?.column ?? null
  if (isGrowthResetGoldenIdPreservedTable(input.table)) {
    return explicit
  }

  return explicit ?? (input.golden_entity === "lead" ? "lead_id" : null)
}

function extractCreateTableBlock(sql: string, table: string): string | null {
  const re = new RegExp(`create table if not exists growth\\.${table}\\s*\\(`, "i")
  const match = re.exec(sql)
  if (!match) return null
  const start = match.index + match[0].length
  let depth = 1
  let end = start
  while (end < sql.length && depth > 0) {
    if (sql[end] === "(") depth += 1
    if (sql[end] === ")") depth -= 1
    end += 1
  }
  return sql.slice(start, end - 1)
}

function extractColumnNamesFromCreateBlock(block: string): Set<string> {
  const columns = new Set<string>()
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*([a-z_][a-z0-9_]*)\s+/i)
    if (match?.[1]) columns.add(match[1].toLowerCase())
  }
  return columns
}

export function extractGrowthTableColumnsFromMigrations(
  cwd = process.cwd(),
): Record<string, Set<string>> {
  const dir = join(cwd, "supabase/migrations")
  const columnsByTable: Record<string, Set<string>> = {}

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue
    const sql = readFileSync(join(dir, file), "utf8")
    const createRe = /create table if not exists growth\.([a-z0-9_]+)\s*\(/gi
    let match: RegExpExecArray | null
    while ((match = createRe.exec(sql)) !== null) {
      const table = match[1]!
      const block = extractCreateTableBlock(sql, table)
      if (!block) continue
      const existing = columnsByTable[table] ?? new Set<string>()
      for (const column of extractColumnNamesFromCreateBlock(block)) {
        existing.add(column)
      }
      columnsByTable[table] = existing
    }
  }

  return columnsByTable
}

function emptyReport(): GrowthResetFkMappingValidationReport {
  return { validated: [], missing: [], skipped: [] }
}

function pushReportEntry(
  report: GrowthResetFkMappingValidationReport,
  entry: GrowthResetFkMappingValidationEntry,
): void {
  if (entry.status === "validated") report.validated.push(entry)
  else if (entry.status === "missing") report.missing.push(entry)
  else report.skipped.push(entry)
}

export function validateGrowthResetFkMappingsFromMigrations(
  catalog: GrowthResetTableCatalogEntry[],
  cwd = process.cwd(),
): GrowthResetFkMappingValidationReport {
  const report = emptyReport()
  const columnsByTable = extractGrowthTableColumnsFromMigrations(cwd)

  for (const entry of catalog) {
    if (entry.classification !== "DELETE") continue

    const skipNote = GROWTH_RESET_DELETE_FK_SKIP_NOTES[entry.table]
    if (skipNote) {
      pushReportEntry(report, {
        table: entry.table,
        delete_fk_column: null,
        status: "skipped",
        reason: skipNote,
        golden_fk_source: null,
        code: null,
        message: null,
      })
      continue
    }

    const mapping = GROWTH_RESET_DELETE_FK_BY_TABLE[entry.table]
    const deleteFkColumn = resolveGrowthResetDeleteFkColumn({
      table: entry.table,
      classification: entry.classification,
      golden_entity: entry.golden_entity,
    })

    if (!deleteFkColumn) {
      pushReportEntry(report, {
        table: entry.table,
        delete_fk_column: null,
        status: "skipped",
        reason: "No direct golden FK preservation mapping for this DELETE table.",
        golden_fk_source: null,
        code: null,
        message: null,
      })
      continue
    }

    const tableColumns = columnsByTable[entry.table]
    if (!tableColumns) {
      pushReportEntry(report, {
        table: entry.table,
        delete_fk_column: deleteFkColumn,
        status: "missing",
        reason: "delete_fk_column_missing",
        golden_fk_source: getGoldenPreservedFkSourceLabel(deleteFkColumn),
        code: "migration_table_missing",
        message: `Table growth.${entry.table} not found in migrations.`,
      })
      continue
    }

    if (!tableColumns.has(deleteFkColumn.toLowerCase())) {
      pushReportEntry(report, {
        table: entry.table,
        delete_fk_column: deleteFkColumn,
        status: "missing",
        reason: "delete_fk_column_missing",
        golden_fk_source: getGoldenPreservedFkSourceLabel(deleteFkColumn),
        code: "migration_column_missing",
        message: `Column growth.${entry.table}.${deleteFkColumn} not found in migrations.`,
      })
      continue
    }

    pushReportEntry(report, {
      table: entry.table,
      delete_fk_column: deleteFkColumn,
      status: "validated",
      reason: null,
      golden_fk_source:
        mapping?.golden_fk_source ?? getGoldenPreservedFkSourceLabel(deleteFkColumn),
      code: null,
      message: null,
    })
  }

  return report
}

export async function probeGrowthResetDeleteFkColumn(
  admin: SupabaseClient,
  table: string,
  deleteFkColumn: string,
): Promise<{ ok: true } | { ok: false; code: string | null; message: string }> {
  const { error } = await admin
    .schema("growth")
    .from(table)
    .select(deleteFkColumn)
    .limit(1)

  if (!error) return { ok: true }

  const message = typeof error.message === "string" ? error.message.trim() : String(error)
  const code = typeof error.code === "string" ? error.code : null
  const missingColumn =
    /column .* does not exist|42703/i.test(message) || code === "42703" || code === "PGRST204"

  return {
    ok: false,
    code: missingColumn ? "delete_fk_column_missing" : code,
    message: missingColumn
      ? `Column growth.${table}.${deleteFkColumn} is not selectable via PostgREST.`
      : message,
  }
}

export async function validateGrowthResetFkMappingsLive(
  admin: SupabaseClient,
  migrationReport: GrowthResetFkMappingValidationReport,
): Promise<GrowthResetFkMappingValidationReport> {
  const report = emptyReport()

  for (const bucket of [
    migrationReport.validated,
    migrationReport.missing,
    migrationReport.skipped,
  ] as const) {
    for (const entry of bucket) {
      if (entry.status === "skipped" || !entry.delete_fk_column) {
        pushReportEntry(report, entry)
        continue
      }

      if (entry.status === "missing") {
        pushReportEntry(report, entry)
        continue
      }

      const probe = await probeGrowthResetDeleteFkColumn(admin, entry.table, entry.delete_fk_column)
      if (!probe.ok) {
        pushReportEntry(report, {
          ...entry,
          status: "missing",
          reason: "delete_fk_column_missing",
          code: probe.code,
          message: probe.message,
        })
        continue
      }

      pushReportEntry(report, entry)
    }
  }

  return report
}

export async function buildGrowthResetFkMappingValidation(
  admin: SupabaseClient,
  catalog: GrowthResetTableCatalogEntry[],
  cwd = process.cwd(),
): Promise<GrowthResetFkMappingValidationReport> {
  const migrationReport = validateGrowthResetFkMappingsFromMigrations(catalog, cwd)
  return validateGrowthResetFkMappingsLive(admin, migrationReport)
}

export function assertGrowthResetFkMappingPhaseSafe(
  report: GrowthResetFkMappingValidationReport,
): { ok: true } | { ok: false; error: GrowthResetFkMappingPhaseError } {
  if (report.missing.length === 0) return { ok: true }
  return {
    ok: false,
    error: new GrowthResetFkMappingPhaseError(report),
  }
}

export class GrowthResetFkMappingPhaseError extends Error {
  readonly fk_mapping_validation: GrowthResetFkMappingValidationReport

  constructor(report: GrowthResetFkMappingValidationReport) {
    const primary = report.missing[0]
    super(
      primary
        ? `DELETE table FK mapping invalid for ${primary.table}: ${primary.message ?? primary.reason}`
        : "Growth reset FK mapping validation failed.",
    )
    this.name = "GrowthResetFkMappingPhaseError"
    this.fk_mapping_validation = report
  }

  toJSON(): Record<string, unknown> {
    return {
      error: "growth_reset_fk_mapping_validation_failed",
      fk_mapping_validation: this.fk_mapping_validation,
    }
  }
}
