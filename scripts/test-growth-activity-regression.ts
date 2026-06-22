/**
 * GS-AI-PLAYBOOK-5C — Activity center regression certification.
 * Run: pnpm test:growth-activity-regression
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ACTIVITY_UNIFIED_API_PATH,
  GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER,
  GROWTH_ACTIVITY_WORKSPACE_PATH,
  GROWTH_ACTIVITY_WORKSPACE_QA_MARKER,
} from "../lib/growth/activity/growth-activity-workspace-constants"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity Regression Certification ===\n")

  assert.equal(GROWTH_ACTIVITY_WORKSPACE_PATH, "/growth/activity")
  assert.equal(GROWTH_ACTIVITY_UNIFIED_API_PATH, "/api/platform/growth/activity/unified")
  assert.ok(GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER.includes("5c"))

  assert.ok(fs.existsSync("app/api/platform/growth/activity/unified/route.ts"))
  assert.ok(fs.existsSync("lib/growth/activity/growth-activity-unified-read-service.ts"))
  assert.ok(fs.existsSync("lib/growth/activity/growth-activity-source-adapters.ts"))

  const activityPage = readSource("app/(growth)/growth/activity/page.tsx")
  assert.match(activityPage, /GrowthActivityWorkspace/)
  assert.match(activityPage, /title="Activity"/)

  const workspace = readSource("components/growth/activity/growth-activity-workspace.tsx")
  assert.match(workspace, /GROWTH_ACTIVITY_WORKSPACE_QA_MARKER/)
  assert.match(workspace, /GrowthActivityFeedSkeleton/)
  assert.match(workspace, /useMemo/)
  assert.doesNotMatch(workspace, /setInterval|poll/i)

  const readService = readSource("lib/growth/activity/growth-activity-unified-read-service.ts")
  assert.match(readService, /Promise.allSettled/)
  assert.match(readService, /buildSendrActivityFeedRows/)
  assert.match(readService, /loadGrowthActivityLeadTimelineForOrg/)
  assert.match(readService, /listPersonalizationGenerations/)
  assert.doesNotMatch(readService, /runAiTask|generatePersonalizationDraft/)

  const shellNav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(shellNav, /id: "activity"/)

  console.log("  ✓ routes + unified API + no generation changes")
  console.log("  ✓ skeleton loading + memoized filters")
  console.log("  ✓ parallel read aggregation without polling")
  console.log("\nActivity regression certification passed.\n")
}

main()
