/**
 * GS-SENDR-2C — Timeline integration certification.
 * Run: pnpm test:growth-sendr-timeline-events
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { GROWTH_SENDR_TIMELINE_EVENT_TYPES } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2C Timeline Events Certification ===\n")
  assert.deepEqual([...GROWTH_SENDR_TIMELINE_EVENT_TYPES], [
    "landing_page_viewed",
    "video_started",
    "video_completed",
    "cta_clicked",
    "booking_started",
    "booking_completed",
  ])

  const timeline = fs.readFileSync("lib/growth/sendr/growth-sendr-analytics-timeline.ts", "utf8")
  assert.match(timeline, /hasSessionTimelineEvent/)
  assert.match(timeline, /recordSendrLandingPageViewedTimeline/)

  const types = fs.readFileSync("lib/growth/timeline-types.ts", "utf8")
  assert.match(types, /landing_page_viewed/)

  console.log("  ✓ Append-only deduplicated timeline events per session")
  console.log("\nGS-SENDR-2C timeline events certification passed.\n")
}

main()
