/**
 * Regression checks for native dialer schema health v2.
 * Run: pnpm test:growth-native-dialer-schema-health
 *
 * Manual QA:
 * - If probeUncertain persists, reload Supabase PostgREST schema cache.
 * - After 20270315123000 service_role grants, verify start / end / wrap-up succeed.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { looksLikePostgrestMissingSchemaError } from "../lib/blitzpay/blitzpay-schema-health-detect"

assert.equal(looksLikePostgrestMissingSchemaError("Could not find the table in the schema cache", "PGRST205"), true)

const schemaHealthSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-schema-health.ts"),
  "utf8",
)
assert.match(schemaHealthSource, /native-dialer-schema-health-v2/)
assert.match(schemaHealthSource, /GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION = "v2"/)
assert.match(schemaHealthSource, /native_dialer_settings/)
assert.match(schemaHealthSource, /native_dialer_queue_items/)
assert.match(schemaHealthSource, /native_call_workspace_sessions/)
assert.match(schemaHealthSource, /native_call_wrapups/)
assert.match(schemaHealthSource, /probeGrowthNativeDialerSchemaHealth/)
assert.match(schemaHealthSource, /fetchGrowthNativeDialerSchemaAdminDiagnostics/)
assert.match(schemaHealthSource, /isPostgrestSchemaCacheStaleError/)
assert.match(schemaHealthSource, /Accept-Profile/)
assert.match(schemaHealthSource, /probeUncertain/)
assert.match(schemaHealthSource, /Dialer setup verification incomplete/)
assert.match(schemaHealthSource, /reload the Supabase PostgREST schema cache/)
assert.match(schemaHealthSource, /20270315123000_growth_engine_native_dialer_service_role_grants/)
assert.doesNotMatch(schemaHealthSource, /\.from\("growth\.native/)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270315120000_growth_engine_native_dialer.sql"),
  "utf8",
)
assert.match(migration, /native_dialer_settings/)
assert.match(migration, /native_dialer_queue_items/)
assert.match(migration, /native_call_workspace_sessions/)
assert.match(migration, /native_call_wrapups/)

const adminRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/schema-health/route.ts"),
  "utf8",
)
assert.match(adminRoute, /fetchGrowthNativeDialerSchemaAdminDiagnostics/)
assert.match(adminRoute, /requireGrowthEnginePlatformAccess/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /probeGrowthNativeDialerSchemaHealth/)
assert.match(dashboardRoute, /growthNativeDialerSchemaResponseMeta/)

const workspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspace, /probeUncertain/)
assert.match(workspace, /setupWarning/)

console.log("growth-native-dialer-schema-health-v2 checks passed")
