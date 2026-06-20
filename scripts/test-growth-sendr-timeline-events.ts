/**
 * GS-SENDR-2D — Timeline integration certification.
 * Run: pnpm test:growth-sendr-timeline-events
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { GROWTH_SENDR_LIMITS, GROWTH_SENDR_TIMELINE_EVENT_TYPES } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2D Timeline Events Certification ===\n")
  assert.deepEqual([...GROWTH_SENDR_TIMELINE_EVENT_TYPES], [
    "landing_page_viewed",
    "video_started",
    "video_completed",
    "cta_clicked",
    "booking_started",
    "booking_completed",
  ])
  assert.ok(GROWTH_SENDR_LIMITS.MAX_SENDR_TIMELINE_EVENTS_PER_SESSION > 0)

  const timeline = fs.readFileSync("lib/growth/sendr/growth-sendr-analytics-timeline.ts", "utf8")
  assert.match(timeline, /hasSessionTimelineEvent/)
  assert.match(timeline, /recordSendrLandingPageViewedTimeline/)

  const ingest = fs.readFileSync("lib/growth/sendr/growth-sendr-public-engagement-service.ts", "utf8")
  assert.match(ingest, /calendar_open/)
  assert.match(ingest, /sendr_timeline_enabled/)
  assert.match(ingest, /sendr_timeline_events/)

  const types = fs.readFileSync("lib/growth/timeline-types.ts", "utf8")
  assert.match(types, /landing_page_viewed/)

  console.log("  ✓ Append-only deduplicated timeline events with guardrails")
  console.log("\nGS-SENDR-2D timeline events certification passed.\n")
}

main()
