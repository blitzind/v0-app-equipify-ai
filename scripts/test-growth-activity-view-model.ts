/**
 * GS-AI-PLAYBOOK-5C — Activity view model certification.
 * Run: pnpm test:growth-activity-view-model
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { mergeGrowthActivityEvents } from "../lib/growth/activity/growth-activity-unified-feed"
import { GROWTH_ACTIVITY_CATEGORIES } from "../lib/growth/activity/growth-activity-workspace-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleEvent(id: string, category: string, occurredAt: string) {
  return {
    id,
    type: "test",
    category: category as "communication",
    title: "Test",
    description: null,
    leadId: "lead-1",
    leadName: "Nicole",
    companyName: "Sterling",
    occurredAt,
    urgency: "low" as const,
    score: 50,
    source: "test",
    actions: [],
    metadata: {},
  }
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity View Model Certification ===\n")

  assert.deepEqual(GROWTH_ACTIVITY_CATEGORIES, [
    "communication",
    "personalization",
    "sales",
    "intelligence",
    "content",
  ])

  const types = readSource("lib/growth/activity/growth-activity-workspace-types.ts")
  assert.match(types, /metadata: GrowthActivityEventMetadata/)
  assert.match(types, /GrowthActivityMetricsView/)
  assert.match(types, /GrowthActivityRailQueueId/)

  const merged = mergeGrowthActivityEvents(
    [sampleEvent("a", "communication", "2026-06-21T10:00:00.000Z")],
    [sampleEvent("b", "sales", "2026-06-21T11:00:00.000Z"), sampleEvent("a", "communication", "2026-06-21T10:00:00.000Z")],
  )
  assert.equal(merged.length, 2)
  assert.equal(merged[0]?.id, "b")

  const workspace = readSource("components/growth/activity/growth-activity-workspace.tsx")
  assert.match(workspace, /GROWTH_ACTIVITY_UNIFIED_API_PATH/)
  assert.match(workspace, /computeGrowthActivityMetrics/)

  console.log("  ✓ categories + metadata + merge sort")
  console.log("  ✓ workspace wired to unified feed")
  console.log("\nActivity view model certification passed.\n")
}

main()
