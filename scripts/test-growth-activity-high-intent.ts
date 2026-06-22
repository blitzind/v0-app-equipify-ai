/**
 * GS-AI-PLAYBOOK-5C — Activity high-intent rail certification.
 * Run: pnpm test:growth-activity-high-intent
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthActivityRailQueues } from "../lib/growth/activity/growth-activity-unified-feed"
import { GROWTH_ACTIVITY_RAIL_QUEUE_LABELS } from "../lib/growth/activity/growth-activity-workspace-constants"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity High Intent Rail Certification ===\n")

  assert.equal(Object.keys(GROWTH_ACTIVITY_RAIL_QUEUE_LABELS).length, 4)

  const rail = readSource("components/growth/activity/growth-activity-high-intent-rail.tsx")
  assert.match(rail, /needs-attention/)
  assert.match(rail, /hot-prospects/)
  assert.match(rail, /meetings-ready/)
  assert.match(rail, /stalled-opportunities/)
  assert.match(rail, /overflow-y-auto/)

  const queues = buildGrowthActivityRailQueues({
    sendrProspects: [
      {
        leadId: "lead-1",
        name: "Nicole",
        company: "Sterling",
        score: 75,
        reason: "High video completion",
        queueId: "hot-prospects",
        lastActivityAt: new Date().toISOString(),
        actions: [],
      },
      {
        leadId: "lead-2",
        name: "Alex",
        company: "Northwind",
        score: 58,
        reason: "Needs follow-up",
        queueId: "needs-attention",
        lastActivityAt: new Date().toISOString(),
        actions: [],
      },
    ],
    signalHot: [],
    events: [
      {
        id: "e1",
        type: "meeting_scheduled",
        category: "sales",
        title: "Meeting Booked",
        description: "Demo scheduled",
        leadId: "lead-3",
        leadName: "Jordan",
        companyName: "Acme",
        occurredAt: new Date().toISOString(),
        urgency: "high",
        score: 72,
        source: "lead_timeline",
        actions: [],
        metadata: {},
      },
      {
        id: "e2",
        type: "opportunity_stage_changed",
        category: "sales",
        title: "Opportunity stalled",
        description: "No activity in 14 days",
        leadId: "lead-4",
        leadName: "Sam",
        companyName: "Globex",
        occurredAt: new Date().toISOString(),
        urgency: "medium",
        score: 40,
        source: "lead_timeline",
        actions: [],
        metadata: {},
      },
    ],
  })

  assert.ok(queues["hot-prospects"].length >= 1)
  assert.ok(queues["meetings-ready"].length >= 1)
  assert.ok(queues["stalled-opportunities"].length >= 1)

  console.log("  ✓ four operator queues")
  console.log("  ✓ rail queue builder")
  console.log("\nActivity high-intent rail certification passed.\n")
}

main()
