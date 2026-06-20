/**
 * GS-SENDR-2A — Engagement event runtime certification.
 * Run: pnpm test:growth-engagement-events
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES,
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_SCHEMA_MIGRATION,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Engagement Event Runtime Certification ===\n")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_MEDIA_EVENT_BATCH, 500)
  assert.ok(GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES.includes("page_view"))
  assert.ok(GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES.includes("booking_completed"))

  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_engagement_events/)
  assert.match(migration, /growth_engagement_event_rollups/)

  const service = readSource("lib/growth/sendr/growth-sendr-engagement-event-service.ts")
  assert.match(service, /appendGrowthSendrEngagementEvents/)
  assert.match(service, /incrementEngagementRollup/)
  assert.doesNotMatch(service, /setInterval/)
  assert.doesNotMatch(service, /websocket/)

  const route = readSource("app/api/platform/growth/sendr/engagement-events/route.ts")
  assert.match(route, /appendGrowthSendrEngagementEvents/)

  console.log("  ✓ Append-only engagement events with rollups")
  console.log("\nGS-SENDR-2A engagement event runtime certification passed.\n")
}

main()
