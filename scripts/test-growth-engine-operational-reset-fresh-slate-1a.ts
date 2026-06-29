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
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
  REPORT_PATHS,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES,
  getGrowthEngineOperationalResetTableEntries,
} from "../lib/growth/reset/growth-engine-operational-reset-table-inventory"
import { formatGrowthEngineOperationalResetDryRun } from "../lib/growth/reset/growth-engine-operational-reset-service"

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

  const scriptSource = fs.readFileSync(
    path.join(process.cwd(), "scripts/reset-growth-engine-operational-data.ts"),
    "utf8",
  )
  assert.match(scriptSource, /--execute/)
  assert.match(scriptSource, /runGrowthEngineOperationalReset/)
  assert.match(scriptSource, /PRECISION_BIOMEDICAL_AI_OS_ORG_ID/)

  assert.equal(REPORT_PATHS.before, "tmp/growth-engine-operational-reset-before.json")
  assert.equal(REPORT_PATHS.after, "tmp/growth-engine-operational-reset-after.json")
  assert.equal(REPORT_PATHS.summary, "tmp/growth-engine-operational-reset-summary.json")

  console.log("  ✓ org id pinned to Precision Biomedical AI OS workspace")
  console.log("  ✓ delete inventory excludes configuration/infrastructure tables")
  console.log("  ✓ command center / approvals / runtime tables included")
  console.log("  ✓ dependency-safe delete order")
  console.log("  ✓ dry-run formatter documents affected rows")
  console.log("  ✓ reset script supports --execute flag")
}

runStructureCertification()
console.log(`\n${GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER} structure certification passed.\n`)
