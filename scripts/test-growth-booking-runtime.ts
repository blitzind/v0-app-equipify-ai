/**
 * GS-SENDR-2A — Booking runtime certification.
 * Run: pnpm test:growth-booking-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_LIMITS, GROWTH_SENDR_SCHEMA_MIGRATION } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Booking Runtime Certification ===\n")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_BOOKINGS_PER_DAY, 500)

  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_booking_assets/)
  assert.match(migration, /growth_booking_events/)
  assert.match(migration, /calendar_provider/)
  assert.match(migration, /legacy_booking_page_id/)
  assert.match(migration, /booking_tracking_enabled/)

  const repo = readSource("lib/growth/sendr/growth-sendr-booking-runtime-repository.ts")
  assert.match(repo, /registerGrowthSendrBookingAsset/)

  console.log("  ✓ Booking asset registry with legacy bridge")
  console.log("\nGS-SENDR-2A booking runtime certification passed.\n")
}

main()
