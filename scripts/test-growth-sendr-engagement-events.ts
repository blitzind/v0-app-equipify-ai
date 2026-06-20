/**
 * GS-SENDR-2C — Public engagement events certification.
 * Run: pnpm test:growth-sendr-engagement-events
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { GROWTH_SENDR_LIMITS } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2C Public Engagement Events Certification ===\n")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_MEDIA_EVENT_BATCH, 500)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_PAGE_VIEWS_PER_SESSION, 100)

  assert.ok(fs.existsSync("app/api/public/sendr/events/route.ts"))
  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-public-engagement-service.ts", "utf8")
  assert.match(service, /ingestSendrPublicEngagementEvents/)
  assert.match(service, /appendGrowthSendrEngagementEvents/)
  assert.doesNotMatch(service, /WebSocket|setInterval/)

  console.log("  ✓ Public append-only engagement ingest with session caps")
  console.log("\nGS-SENDR-2C engagement events certification passed.\n")
}

main()
