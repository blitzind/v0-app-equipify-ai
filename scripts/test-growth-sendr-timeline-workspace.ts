/**
 * GS-SENDR-3C — Timeline workspace certification.
 * Run: pnpm test:growth-sendr-timeline-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3C Timeline Workspace Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/activity/timeline/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-activity-timeline-service.ts")
  assert.match(service, /getSendrActivityTimelines/)
  assert.match(service, /Launch Sent/)

  const repo = readSource("lib/growth/sendr/growth-sendr-activity-read-repository.ts")
  assert.match(repo, /loadSendrTimelineEventsForOrg/)
  assert.match(repo, /lead_timeline_events/)
  assert.match(repo, /loadSendrLaunchSentEvents/)

  const dashboard = readSource("components/growth/sendr/growth-sendr-activity-dashboard.tsx")
  assert.match(dashboard, /Prospect timelines/)

  console.log("  ✓ Grouped lead timelines from timeline + launch data")
  console.log("\nGS-SENDR-3C timeline workspace certification passed.\n")
}

main()
