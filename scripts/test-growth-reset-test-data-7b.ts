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
import { assertGrowthResetConfirmAllowed } from "../lib/growth/reset/growth-test-data-reset-service"
import {
  GROWTH_RESET_CREDENTIALS_ERROR,
  GROWTH_RESET_CREDENTIALS_HELP,
  pickServiceRoleFromApiKeys,
} from "../lib/growth/reset/growth-test-data-reset-credentials"

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
