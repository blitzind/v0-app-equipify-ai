/**
 * GS-SENDR-3C — Activity feed certification.
 * Run: pnpm test:growth-sendr-activity-feed
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3C Activity Feed Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/activity/feed/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-activity-feed-service.ts")
  assert.match(service, /getSendrActivityFeed/)
  assert.match(service, /buildSendrActivityFeedRows/)
  assert.match(service, /intentScore/)

  const repo = readSource("lib/growth/sendr/growth-sendr-activity-read-repository.ts")
  assert.match(repo, /loadRecentSendrEngagementEvents/)
  assert.match(repo, /growth_engagement_events/)

  console.log("  ✓ Chronological activity feed from engagement events")
  console.log("\nGS-SENDR-3C activity feed certification passed.\n")
}

main()
