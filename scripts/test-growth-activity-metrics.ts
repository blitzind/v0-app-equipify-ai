/**
 * GS-AI-PLAYBOOK-5C — Activity metrics certification.
 * Run: pnpm test:growth-activity-metrics
 */
import assert from "node:assert/strict"
import { computeGrowthActivityMetrics } from "../lib/growth/activity/growth-activity-unified-feed"
import type { GrowthActivityEventView } from "../lib/growth/activity/growth-activity-workspace-types"

function event(partial: Partial<GrowthActivityEventView>): GrowthActivityEventView {
  return {
    id: partial.id ?? "e1",
    type: partial.type ?? "test",
    category: partial.category ?? "communication",
    title: partial.title ?? "Test",
    description: partial.description ?? null,
    leadId: partial.leadId ?? "lead-1",
    leadName: partial.leadName ?? "Nicole",
    companyName: partial.companyName ?? "Sterling",
    occurredAt: partial.occurredAt ?? new Date().toISOString(),
    urgency: partial.urgency ?? "low",
    score: partial.score ?? 50,
    source: partial.source ?? "test",
    actions: [],
    metadata: partial.metadata ?? {},
  }
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity Metrics Certification ===\n")

  const now = new Date().toISOString()
  const weekAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const metrics = computeGrowthActivityMetrics([
    event({ id: "1", occurredAt: now, category: "personalization", type: "personalization_generated" }),
    event({ id: "2", occurredAt: now, type: "meeting_booked", title: "Meeting Booked", urgency: "high", score: 80 }),
    event({ id: "3", occurredAt: weekAgo, type: "live_call_completed", category: "sales" }),
    event({ id: "4", occurredAt: now, metadata: { isUnread: true }, urgency: "critical" }),
  ])

  assert.equal(metrics.today, 3)
  assert.equal(metrics.thisWeek, 4)
  assert.equal(metrics.personalizationsGenerated, 1)
  assert.equal(metrics.meetingsBooked, 1)
  assert.equal(metrics.callsCompleted, 1)
  assert.ok(metrics.needsAttention >= 2)
  assert.ok(metrics.highIntent >= 1)

  console.log("  ✓ client-side metrics from unified view model")
  console.log("\nActivity metrics certification passed.\n")
}

main()
