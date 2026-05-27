/**
 * Regression checks for outbound lifecycle operations (Phase 4).
 * Run: pnpm test:growth-outbound-lifecycle-ops
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER } from "../lib/growth/outbound/lifecycle-ops-types"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"

const LIFECYCLE_MIGRATION = "20270531120000_growth_outbound_lifecycle_ops.sql"

async function main(): Promise<void> {
  assert.equal(GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER, "growth-outbound-lifecycle-ops-v1")
  assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-lifecycle-maintenance"))

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${LIFECYCLE_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /inbox_lifecycle_events/)
  assert.match(migration, /maintenance_tasks/)
  assert.match(migration, /operational_alerts/)
  assert.match(migration, /lifecycle_stage/)

  const lifecycle = fs.readFileSync(path.join(process.cwd(), "lib/growth/outbound/inbox-lifecycle-engine.ts"), "utf8")
  assert.match(lifecycle, /computeDeterministicLifecycleStage/)
  assert.match(lifecycle, /no auto-retire|Retirement candidate/i)

  const maintenance = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/sender-maintenance-engine.ts"),
    "utf8",
  )
  assert.match(maintenance, /recommendation_only/)
  assert.match(maintenance, /runSenderMaintenanceScan/)

  const alerting = fs.readFileSync(path.join(process.cwd(), "lib/growth/outbound/operational-alerting.ts"), "utf8")
  assert.match(alerting, /GROWTH_OPS_SLACK_WEBHOOK_URL/)
  assert.match(alerting, /runOperationalAlertScan/)

  const fit = fs.readFileSync(path.join(process.cwd(), "lib/growth/outbound/infrastructure-fit-scoring.ts"), "utf8")
  assert.match(fit, /advisoryOnly/)

  const ui = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-internal-outbound-operations-dashboard.tsx"),
    "utf8",
  )
  assert.match(ui, /GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER/)
  assert.match(ui, /maintenance/)
  assert.match(ui, /sustainability/)

  const cron = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-lifecycle-maintenance/route.ts"),
    "utf8",
  )
  assert.match(cron, /runLifecycleOpsMaintenanceScan/)

  console.log("growth outbound lifecycle ops tests passed")
}

void main()
