/**
 * AVA-RUNTIME-SHUTDOWN-1A — Certified scheduler boundary regression.
 *
 *   pnpm test:ava-runtime-shutdown-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CRON_ROUTES_AVA_SHUTDOWN_RETIRED_FROM_VERCEL,
  GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL,
  growthCronApiPath,
} from "@/lib/growth/runtime/cron-telemetry-types"

const CERT_ID = "ava-runtime-shutdown-1a-v1" as const

const WARMUP_BRIDGE_ROUTES = [
  "growth-dns-verify",
  "growth-reputation-snapshot",
  "growth-warmup-progression",
  "growth-warmup-send-executor",
  "growth-event-retention",
] as const

const CORE_EQUIPIFY_ROUTES = [
  "/api/cron/maintenance-due",
  "/api/cron/process-ai-jobs",
  "/api/cron/process-import-runs",
  "/api/cron/ai-ops-digest",
  "/api/cron/process-technician-push-queue",
] as const

function readVercelCrons(): Array<{ path: string; schedule: string }> {
  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>
  }
  return vercel.crons
}

function main(): void {
  console.log(`[${CERT_ID}] certification\n`)

  const crons = readVercelCrons()
  const paths = new Set(crons.map((cron) => cron.path))

  for (const route of CORE_EQUIPIFY_ROUTES) {
    assert.ok(paths.has(route), `core cron must remain scheduled: ${route}`)
  }
  console.log("  ✓ Equipify core crons preserved")

  for (const routeId of WARMUP_BRIDGE_ROUTES) {
    const apiPath = growthCronApiPath(routeId)
    assert.ok(paths.has(apiPath), `warmup bridge cron must remain scheduled: ${apiPath}`)
    assert.ok(
      fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
      `warmup route handler must exist: ${routeId}`,
    )
  }
  console.log("  ✓ Warmup bridge crons preserved")

  for (const routeId of GROWTH_CRON_ROUTES_AVA_SHUTDOWN_RETIRED_FROM_VERCEL) {
    const apiPath = growthCronApiPath(routeId)
    assert.ok(!paths.has(apiPath), `Ava cron must not be scheduled: ${apiPath}`)
    assert.ok(
      fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
      `Ava route handler must be preserved: ${routeId}`,
    )
  }
  console.log("  ✓ Ava shutdown crons removed from vercel.json; handlers preserved")

  assert.equal(
    new Set(GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL).size,
    GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL.length,
    "retired cron registry must be unique",
  )
  console.log("  ✓ Retired cron registry is consistent")

  const growthScheduled = crons.filter((cron) => cron.path.startsWith("/api/cron/growth-"))
  assert.equal(growthScheduled.length, WARMUP_BRIDGE_ROUTES.length)
  console.log(`  ✓ scheduled growth crons = ${growthScheduled.length} (warmup bridge only)`)

  console.log(`\n[${CERT_ID}] PASS`)
}

main()
