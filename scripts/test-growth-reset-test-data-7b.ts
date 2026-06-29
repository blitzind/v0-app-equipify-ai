/**
 * GS-GROWTH-OPS-7B — Structure certification for Growth test data reset utility.
 */
import assert from "node:assert/strict"
import {
  GROWTH_RESET_CONFIRM_ENV,
  GROWTH_RESET_CONFIRM_VALUE,
  GROWTH_TEST_DATA_RESET_QA_MARKER,
  REPORT_PATHS,
} from "../lib/growth/reset/growth-test-data-reset-constants"
import {
  buildGrowthResetTableCatalog,
  extractGrowthTablesFromMigrations,
  getOrderedDeleteTables,
} from "../lib/growth/reset/growth-test-data-reset-table-inventory"
import { assertGrowthResetConfirmAllowed, assertGrowthResetCountPhaseSafe } from "../lib/growth/reset/growth-test-data-reset-service"
import {
  assertGrowthResetDeletePreflightSafe,
  extractGrowthTablePrimaryKeysFromMigrations,
  resolveGrowthResetDeleteStrategy,
} from "../lib/growth/reset/growth-test-data-reset-delete-strategy"
import {
  describeGrowthResetCountQuery,
  formatGrowthResetCountFailureForTest,
} from "../lib/growth/reset/growth-test-data-reset-count"
import {
  assertGrowthResetAdminConfirmAllowed,
  assertGrowthResetAdminDryRunAllowed,
  GROWTH_RESET_ADMIN_CONFIRM_PHRASE,
  parseGrowthResetAdminRunMode,
} from "../lib/growth/reset/growth-test-data-reset-admin-route-gates"
import {
  GROWTH_RESET_CREDENTIALS_ERROR,
  GROWTH_RESET_CREDENTIALS_HELP,
  pickServiceRoleFromApiKeys,
} from "../lib/growth/reset/growth-test-data-reset-credentials"
import fs from "node:fs"
import path from "node:path"

const catalog = buildGrowthResetTableCatalog()
const migrationTables = extractGrowthTablesFromMigrations()

assert.equal(catalog.length, migrationTables.length, "catalog must cover all migration tables")
assert.ok(catalog.length >= 400, "expected 400+ growth tables")

const keep = catalog.filter((t) => t.classification === "KEEP")
const del = catalog.filter((t) => t.classification === "DELETE")
const manual = catalog.filter((t) => t.classification === "MANUAL_REVIEW")

assert.ok(keep.length > 50, "KEEP tables expected")
assert.ok(del.length > 200, "DELETE tables expected")
assert.ok(manual.length >= 5, "MANUAL_REVIEW tables expected")

const deleteOrder = getOrderedDeleteTables(catalog).map((t) => t.table)
const leadsIndex = deleteOrder.indexOf("leads")
const companiesIndex = deleteOrder.indexOf("companies")
const timelineIndex = deleteOrder.indexOf("lead_timeline_events")
assert.ok(timelineIndex >= 0 && leadsIndex >= 0, "timeline and leads must be in delete order")
assert.ok(timelineIndex < leadsIndex, "timeline events must delete before leads")
assert.ok(companiesIndex < leadsIndex, "companies must delete before leads")

assert.equal(REPORT_PATHS.before, "tmp/growth-reset-report-before.json")
assert.equal(REPORT_PATHS.after, "tmp/growth-reset-report-after.json")
assert.equal(REPORT_PATHS.summary, "tmp/growth-reset-summary.json")

const prevConfirm = process.env[GROWTH_RESET_CONFIRM_ENV]
delete process.env[GROWTH_RESET_CONFIRM_ENV]
assert.equal(assertGrowthResetConfirmAllowed().ok, false)
process.env[GROWTH_RESET_CONFIRM_ENV] = GROWTH_RESET_CONFIRM_VALUE
assert.equal(assertGrowthResetConfirmAllowed().ok, true)
if (prevConfirm === undefined) delete process.env[GROWTH_RESET_CONFIRM_ENV]
else process.env[GROWTH_RESET_CONFIRM_ENV] = prevConfirm

assert.match(GROWTH_RESET_CREDENTIALS_HELP, /NEXT_PUBLIC_SUPABASE_URL/)
assert.match(GROWTH_RESET_CREDENTIALS_HELP, /SUPABASE_PROJECT_REF/)
assert.match(GROWTH_RESET_CREDENTIALS_HELP, /Supabase Dashboard/)
assert.equal(GROWTH_RESET_CREDENTIALS_ERROR.includes("Vercel encrypted env values cannot be pulled"), true)

const legacyKey = pickServiceRoleFromApiKeys([
  { name: "anon", api_key: "anon-key" },
  { name: "service_role", api_key: "eyJ.test.service" },
])
assert.equal(legacyKey, "eyJ.test.service")

const secretKey = pickServiceRoleFromApiKeys([
  {
    type: "secret",
    api_key: "sb_secret_test",
    secret_jwt_template: { role: "service_role" },
  },
])
assert.equal(secretKey, "sb_secret_test")

const primaryKeys = extractGrowthTablePrimaryKeysFromMigrations()
assert.deepEqual(primaryKeys.ai_copilot_generation_playbook_rules, [
  "generation_id",
  "approved_rule_id",
])
assert.deepEqual(primaryKeys.growth_engagement_event_rollups, [
  "organization_id",
  "rollup_date",
  "event_type",
])
assert.deepEqual(primaryKeys.leads, ["id"])

const keepEntry = catalog.find((entry) => entry.table === "sender_accounts")
assert.ok(keepEntry)
const keepStrategy = resolveGrowthResetDeleteStrategy(keepEntry!, primaryKeys)
assert.equal(keepStrategy.kind, "skip_keep")

const manualEntry = catalog.find((entry) => entry.table === "apollo_pilot_cohorts")
assert.ok(manualEntry)
const manualStrategy = resolveGrowthResetDeleteStrategy(manualEntry!, primaryKeys)
assert.equal(manualStrategy.kind, "skip_manual_review")

const leadEntry = catalog.find((entry) => entry.table === "leads")
assert.ok(leadEntry)
const leadStrategy = resolveGrowthResetDeleteStrategy(leadEntry!, primaryKeys)
assert.equal(leadStrategy.kind, "delete_by_fk_exclusion")
assert.deepEqual(leadStrategy.primary_key_columns, ["id"])

const rollupEntry = catalog.find((entry) => entry.table === "growth_engagement_event_rollups")
assert.ok(rollupEntry)
assert.equal(rollupEntry!.classification, "DELETE")
const rollupStrategy = resolveGrowthResetDeleteStrategy(rollupEntry!, primaryKeys)
assert.equal(rollupStrategy.kind, "delete_by_composite_key")
assert.deepEqual(rollupStrategy.primary_key_columns, [
  "organization_id",
  "rollup_date",
  "event_type",
])

const playbookRulesEntry = catalog.find((entry) => entry.table === "ai_copilot_generation_playbook_rules")
assert.ok(playbookRulesEntry)
assert.equal(playbookRulesEntry!.classification, "KEEP")
assert.equal(
  resolveGrowthResetDeleteStrategy(playbookRulesEntry!, primaryKeys).kind,
  "skip_keep",
)

const unknownKeyStrategy = resolveGrowthResetDeleteStrategy(
  {
    table: "unknown_no_pk_table",
    classification: "DELETE",
    reset_order: 999,
    dependencies: [],
    golden_entity: null,
    delete_fk_column: null,
    notes: null,
  },
  {},
)
assert.equal(unknownKeyStrategy.kind, "delete_by_uuid_id")
assert.deepEqual(unknownKeyStrategy.primary_key_columns, ["id"])

const blockedPreflight = assertGrowthResetDeletePreflightSafe({
  deletable_tables: ["leads"],
  skipped_tables: ["sender_accounts"],
  blocked_delete_tables: [
    {
      table: "broken_delete_table",
      classification: "DELETE",
      reason: "delete_key_unavailable",
      primary_key_columns: ["missing_id"],
      message: "column missing_id does not exist",
      code: "42703",
      details: null,
      hint: null,
    },
  ],
  delete_plan: [
    {
      table: "leads",
      classification: "DELETE",
      status: "deletable",
      strategy: "delete_by_uuid_id",
      primary_key_columns: ["id"],
      preserve_fk_column: "lead_id",
      reason: null,
    },
    {
      table: "broken_delete_table",
      classification: "DELETE",
      status: "blocked",
      strategy: "delete_by_uuid_id",
      primary_key_columns: ["missing_id"],
      preserve_fk_column: null,
      reason: "column missing_id does not exist",
    },
  ],
})
assert.equal(blockedPreflight.ok, false)

const safePreflight = assertGrowthResetDeletePreflightSafe({
  deletable_tables: ["leads"],
  skipped_tables: keep.map((entry) => entry.table).slice(0, 3),
  blocked_delete_tables: [],
  delete_plan: [],
})
assert.equal(safePreflight.ok, true)

assert.match(
  describeGrowthResetCountQuery("growth", "buying_stage_assessments", "id"),
  /growth\.buying_stage_assessments.*select=id/,
)

const emptyPostgrestFailure = formatGrowthResetCountFailureForTest({
  table: "buying_stage_assessments",
  classification: "DELETE",
  response: {
    count: null,
    error: { message: "" },
    status: 403,
    statusText: "Forbidden",
  },
})
assert.equal(emptyPostgrestFailure.code, null)
assert.match(emptyPostgrestFailure.message, /HTTP 403 Forbidden/)
assert.match(emptyPostgrestFailure.message, /GRANT SELECT privileges for service_role/)
assert.equal(emptyPostgrestFailure.http_status, 403)
assert.equal(emptyPostgrestFailure.http_status_text, "Forbidden")
assert.equal(emptyPostgrestFailure.schema, "growth")
assert.equal(emptyPostgrestFailure.select, "id")
assert.equal(emptyPostgrestFailure.count_source, "postgrest")
assert.notEqual(emptyPostgrestFailure.message, "Unknown count error")

const keepOnlyGate = assertGrowthResetCountPhaseSafe({
  blocking_count_errors: [],
  count_unavailable_tables: ["sender_accounts"],
  count_errors: [
    {
      table: "sender_accounts",
      classification: "KEEP",
      operation: "count",
      code: "42703",
      message: "column sender_accounts.id does not exist",
      details: null,
      hint: null,
      http_status: 400,
      http_status_text: "Bad Request",
      schema: "growth",
      select: "id",
      query: "growth.sender_accounts HEAD/GET ?select=id (Prefer: count=exact)",
      count_source: "postgrest",
      raw_error: { message: "column sender_accounts.id does not exist", code: "42703" },
      response_body: null,
    },
  ],
})
assert.equal(keepOnlyGate.ok, true)

const deleteGate = assertGrowthResetCountPhaseSafe({
  blocking_count_errors: [
    {
      table: "ai_copilot_generation_playbook_rules",
      classification: "DELETE",
      operation: "count",
      code: "42703",
      message: "column ai_copilot_generation_playbook_rules.id does not exist",
      details: null,
      hint: null,
      http_status: 400,
      http_status_text: "Bad Request",
      schema: "growth",
      select: "id",
      query: "growth.ai_copilot_generation_playbook_rules HEAD/GET ?select=id (Prefer: count=exact)",
      count_source: "postgrest",
      raw_error: {
        message: "column ai_copilot_generation_playbook_rules.id does not exist",
        code: "42703",
      },
      response_body: null,
    },
  ],
  count_unavailable_tables: ["ai_copilot_generation_playbook_rules"],
  count_errors: [
    {
      table: "ai_copilot_generation_playbook_rules",
      classification: "DELETE",
      operation: "count",
      code: "42703",
      message: "column ai_copilot_generation_playbook_rules.id does not exist",
      details: null,
      hint: null,
      http_status: 400,
      http_status_text: "Bad Request",
      schema: "growth",
      select: "id",
      query: "growth.ai_copilot_generation_playbook_rules HEAD/GET ?select=id (Prefer: count=exact)",
      count_source: "postgrest",
      raw_error: {
        message: "column ai_copilot_generation_playbook_rules.id does not exist",
        code: "42703",
      },
      response_body: null,
    },
  ],
})
assert.equal(deleteGate.ok, false)

const adminRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/reset/test-data/route.ts"),
  "utf8",
)
assert.match(adminRouteSource, /requireGrowthPlatformAdminAccess/)
assert.match(adminRouteSource, /runGrowthTestDataResetFromAdminRuntime/)
assert.match(adminRouteSource, /assertGrowthResetAdminDryRunAllowed/)
assert.match(adminRouteSource, /assertGrowthResetAdminConfirmAllowed/)
assert.doesNotMatch(adminRouteSource, /SUPABASE_SERVICE_ROLE_KEY/)
assert.doesNotMatch(adminRouteSource, /resolveGrowthResetSupabaseConfig/)
assert.doesNotMatch(adminRouteSource, /createClient\(/)
if (!adminRouteSource.includes("if (!access.ok) return access.response")) {
  assert.fail("admin reset route must return access.response when unauthorized")
}

assert.equal(parseGrowthResetAdminRunMode(null), "dry_run")
assert.equal(parseGrowthResetAdminRunMode({}), "dry_run")
assert.equal(parseGrowthResetAdminRunMode({ mode: "dry_run" }), "dry_run")
assert.equal(parseGrowthResetAdminRunMode({ mode: "confirm" }), "confirm")

const prodEnv = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://byyfylkklbxcdofaspye.supabase.co",
  GROWTH_RESET_TEST_DATA_CONFIRM: "yes",
} as NodeJS.ProcessEnv

assert.equal(assertGrowthResetAdminDryRunAllowed(prodEnv).ok, true)
assert.equal(
  assertGrowthResetAdminConfirmAllowed(prodEnv, GROWTH_RESET_ADMIN_CONFIRM_PHRASE).ok,
  true,
)
assert.equal(assertGrowthResetAdminConfirmAllowed(prodEnv, "wrong phrase").ok, false)
assert.equal(
  assertGrowthResetAdminDryRunAllowed({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })
    .ok,
  false,
)

console.log(
  JSON.stringify(
    {
      ok: true,
      qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
      table_count: catalog.length,
      keep: keep.length,
      delete: del.length,
      manual_review: manual.length,
    },
    null,
    2,
  ),
)

console.log("\nGS-GROWTH-OPS-7B reset utility structure certification passed.\n")
