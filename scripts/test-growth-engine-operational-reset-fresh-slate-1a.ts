/**
 * GE-AVA-FRESH-SLATE-1A — Certification for Growth Engine operational reset utility.
 *
 * Run: pnpm test:growth-engine-operational-reset-fresh-slate-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV,
  GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
  GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER,
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
  REPORT_PATHS,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import {
  GROWTH_HOME_STALE_DATA_SOURCES,
  listGrowthHomeStaleDataSourceTables,
} from "../lib/growth/reset/growth-home-stale-data-source-map"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES,
  getGrowthEngineOperationalResetTableEntries,
} from "../lib/growth/reset/growth-engine-operational-reset-table-inventory"
import {
  formatGrowthEngineOperationalResetDryRun,
  formatGrowthEngineOperationalResetExecutionReport,
  type GrowthEngineOperationalResetTableDeleteResult,
} from "../lib/growth/reset/growth-engine-operational-reset-service"
import { extractSupabaseProjectRefFromUrl } from "../lib/growth/reset/growth-test-data-reset-credentials"

function runStructureCertification(): void {
  console.log(`\n=== ${GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER} (structure) ===\n`)

  assert.equal(PRECISION_BIOMEDICAL_AI_OS_ORG_ID, "5876176a-61ec-4532-ad99-0c31482d5a91")
  assert.equal(GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV, "GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID")

  const entries = getGrowthEngineOperationalResetTableEntries()
  assert.ok(entries.length >= 80, "expected 80+ operational tables")

  const deleteTables = new Set(entries.map((entry) => entry.table))
  for (const preserved of GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES) {
    assert.equal(
      deleteTables.has(preserved),
      false,
      `preserved table must not appear in delete inventory: ${preserved}`,
    )
  }

  assert.ok(deleteTables.has("ai_work_orders"), "must clear ai_work_orders")
  assert.ok(deleteTables.has("human_execution_approvals"), "must clear human_execution_approvals")
  assert.ok(deleteTables.has("sequence_execution_jobs"), "must clear sequence_execution_jobs")
  assert.ok(deleteTables.has("outreach_queue"), "must clear outreach_queue")
  assert.ok(deleteTables.has("lead_research_runs"), "must clear lead_research_runs")
  assert.ok(deleteTables.has("operator_notifications"), "must clear operator_notifications")
  assert.ok(deleteTables.has("operational_alerts"), "must clear operational_alerts")
  assert.ok(deleteTables.has("inbox_threads"), "must clear inbox_threads (Home replies waiting)")
  assert.ok(deleteTables.has("outbound_replies"), "must clear outbound_replies")
  assert.ok(deleteTables.has("lead_inbox"), "must clear lead_inbox (Home qualified prospects)")
  assert.ok(deleteTables.has("opportunities"), "must clear opportunities")
  assert.ok(deleteTables.has("cadence_tasks"), "must clear cadence_tasks (call-ready leads)")
  assert.ok(deleteTables.has("leads"), "must clear leads (daily work queue inputs)")

  const homeSourceTables = listGrowthHomeStaleDataSourceTables()
  const preservedSet = new Set<string>(GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES)
  const uncovered = homeSourceTables.filter(
    (table) => !deleteTables.has(table) && !preservedSet.has(table),
  )
  assert.equal(
    uncovered.length,
    0,
    `Home source tables must be in reset inventory: ${uncovered.join(", ")}`,
  )
  assert.ok(GROWTH_HOME_STALE_DATA_SOURCES.length >= 10)

  assert.equal(GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER, "growth-home-stale-data-diagnostic-fresh-slate-1b-v1")

  assert.equal(deleteTables.has("mailbox_connections"), false)
  assert.equal(deleteTables.has("sender_domains"), false)
  assert.equal(deleteTables.has("sender_pools"), false)
  assert.equal(deleteTables.has("warmup_profiles"), false)
  assert.equal(deleteTables.has("warmup_schedule"), false)
  assert.equal(deleteTables.has("organization_growth_objectives"), false)

  const ordered = entries.map((entry) => entry.delete_order)
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b), "delete_order must be ascending")

  const jobsIndex = entries.findIndex((entry) => entry.table === "sequence_execution_jobs")
  const enrollStepsIndex = entries.findIndex((entry) => entry.table === "sequence_enrollment_steps")
  const enrollmentsIndex = entries.findIndex((entry) => entry.table === "sequence_enrollments")
  assert.ok(jobsIndex >= 0 && enrollStepsIndex >= 0 && enrollmentsIndex >= 0)
  assert.ok(jobsIndex < enrollStepsIndex, "execution jobs must delete before enrollment steps")
  assert.ok(enrollStepsIndex < enrollmentsIndex, "enrollment steps must delete before enrollments")

  const dryRunSample = formatGrowthEngineOperationalResetDryRun({
    qa_marker: GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
    generated_at: new Date().toISOString(),
    mode: "dry_run",
    organization_id: PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
    organization_name: "Precision Biomedical Services",
    scope_summary: {
      org_scoped_tables: 10,
      lead_scoped_tables: 10,
      single_tenant_tables: 5,
      resolved_lead_ids: 3,
      single_tenant_attribution: "test",
    },
    preserved_tables: [{ table: "mailbox_connections", row_count: 2 }],
    tables: [
      {
        table: "ai_work_orders",
        category: "ai_os_command_center",
        scope: "organization_id",
        row_count: 4,
        count_status: "ok",
        count_error: null,
        scope_filter: `organization_id = ${PRECISION_BIOMEDICAL_AI_OS_ORG_ID}`,
        notes: "Ava command center work orders",
      },
    ],
    summary: {
      tables_with_rows: 1,
      total_rows_to_clear: 4,
      count_unavailable_tables: 0,
    },
  })
  assert.match(dryRunSample, /No rows deleted/)
  assert.match(dryRunSample, /growth\.ai_work_orders: 4 row\(s\)/)

  const failedResult: GrowthEngineOperationalResetTableDeleteResult = {
    table: "ai_decision_record_audit_events",
    rows_before: 12,
    delete_attempted: true,
    rows_deleted: 0,
    rows_after: 12,
    status: "failed",
    error: "permission denied for table ai_decision_record_audit_events",
  }
  const executionReport = formatGrowthEngineOperationalResetExecutionReport({
    table_results: [failedResult],
    execution_summary: {
      total_rows_before: 12,
      total_rows_deleted: 0,
      total_rows_remaining: 12,
      failed_tables: ["ai_decision_record_audit_events"],
      skipped_tables: [],
      top_remaining_tables: [{ table: "ai_decision_record_audit_events", rows_remaining: 12 }],
      strict_mode: false,
      completed_with_warnings: true,
    },
  })
  assert.match(executionReport, /status=failed/)
  assert.match(executionReport, /permission denied/)
  assert.match(executionReport, /total_rows_remaining: 12/)
  assert.match(executionReport, /ai_decision_record_audit_events/)

  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/reset/growth-engine-operational-reset-service.ts"),
    "utf8",
  )
  assert.match(serviceSource, /attemptDeleteScopedRows/)
  assert.match(serviceSource, /deleteInventoryTable/)
  assert.match(serviceSource, /status: "failed"/)
  assert.doesNotMatch(serviceSource, /throw new Error\(`\$\{entry\.table\}/)

  const scriptSource = fs.readFileSync(
    path.join(process.cwd(), "scripts/reset-growth-engine-operational-data.ts"),
    "utf8",
  )
  assert.match(scriptSource, /--execute/)
  assert.match(scriptSource, /runGrowthEngineOperationalReset/)
  assert.match(scriptSource, /PRECISION_BIOMEDICAL_AI_OS_ORG_ID/)
  assert.match(scriptSource, /logOperationalResetSafetyConfirmation/)
  assert.match(scriptSource, /allowPrompt = argv.includes\("--prompt"\)/)
  assert.match(scriptSource, /--strict/)
  assert.match(scriptSource, /formatGrowthEngineOperationalResetExecutionReport/)
  assert.doesNotMatch(scriptSource, /--no-prompt/)
  assert.equal(
    extractSupabaseProjectRefFromUrl("https://byyfylkklbxcdofaspye.supabase.co"),
    "byyfylkklbxcdofaspye",
  )

  assert.equal(REPORT_PATHS.before, "tmp/growth-engine-operational-reset-before.json")
  assert.equal(REPORT_PATHS.after, "tmp/growth-engine-operational-reset-after.json")
  assert.equal(REPORT_PATHS.summary, "tmp/growth-engine-operational-reset-summary.json")

  console.log("  ✓ org id pinned to Precision Biomedical AI OS workspace")
  console.log("  ✓ delete inventory excludes configuration/infrastructure tables")
  console.log("  ✓ command center / approvals / runtime tables included")
  console.log("  ✓ dependency-safe delete order")
  console.log("  ✓ dry-run formatter documents affected rows")
  console.log("  ✓ Home stale source tables covered by reset inventory")
  console.log("  ✓ reset script supports --execute flag")
  console.log("  ✓ per-table delete failures continue with warnings (--strict to fail)")

  const diagnosticSource = fs.readFileSync(
    path.join(process.cwd(), "scripts/diagnose-growth-home-stale-data-sources.ts"),
    "utf8",
  )
  assert.match(diagnosticSource, /GROWTH_HOME_STALE_DATA_SOURCES/)
  assert.match(diagnosticSource, /derived_home_signals/)
  console.log("  ✓ Home stale data diagnostic script present")
}

runStructureCertification()
console.log(`\n${GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER} structure certification passed.\n`)
