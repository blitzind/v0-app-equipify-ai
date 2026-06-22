/**
 * GS-AI-PLAYBOOK-5C — Activity filters certification.
 * Run: pnpm test:growth-activity-filters
 */
import assert from "node:assert/strict"
import {
  filterGrowthActivityEvents,
  searchGrowthActivityEvents,
} from "../lib/growth/activity/growth-activity-workspace-filters"
import { GROWTH_ACTIVITY_FILTER_OPTIONS } from "../lib/growth/activity/growth-activity-workspace-constants"
import type { GrowthActivityEventView } from "../lib/growth/activity/growth-activity-workspace-types"

function event(partial: Partial<GrowthActivityEventView>): GrowthActivityEventView {
  return {
    id: partial.id ?? "e1",
    type: partial.type ?? "test",
    category: partial.category ?? "communication",
    title: partial.title ?? "Email Opened",
    description: partial.description ?? "Prospect opened email",
    leadId: partial.leadId ?? "lead-1",
    leadName: partial.leadName ?? "Nicole",
    companyName: partial.companyName ?? "Sterling Biomedical",
    occurredAt: partial.occurredAt ?? new Date().toISOString(),
    urgency: partial.urgency ?? "low",
    score: partial.score ?? 40,
    source: partial.source ?? "lead_timeline",
    actions: partial.actions ?? [],
    metadata: partial.metadata ?? {},
  }
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity Filters Certification ===\n")

  assert.ok(GROWTH_ACTIVITY_FILTER_OPTIONS.some((option) => option.id === "personalization"))
  assert.ok(GROWTH_ACTIVITY_FILTER_OPTIONS.some((option) => option.id === "needs-attention"))
  assert.ok(GROWTH_ACTIVITY_FILTER_OPTIONS.some((option) => option.id === "unread"))

  const events = [
    event({ id: "e1", category: "communication", score: 80, urgency: "high", description: "Prospect opened email" }),
    event({ id: "e2", category: "personalization", metadata: { isUnread: true }, description: "Draft generated" }),
    event({ id: "e3", category: "sales", title: "Meeting Booked", description: "Demo scheduled" }),
  ]

  assert.equal(filterGrowthActivityEvents(events, "personalization").length, 1)
  assert.equal(filterGrowthActivityEvents(events, "communication").length, 1)
  assert.equal(filterGrowthActivityEvents(events, "high-intent").length, 1)
  assert.equal(filterGrowthActivityEvents(events, "unread").length, 1)
  assert.equal(filterGrowthActivityEvents(events, "needs-attention").length, 2)

  const searched = searchGrowthActivityEvents(events, "sterling")
  assert.equal(searched.length, 3)

  const descriptionSearch = searchGrowthActivityEvents(events, "prospect opened")
  assert.equal(descriptionSearch.length, 1)

  console.log("  ✓ category + quick filters")
  console.log("  ✓ search on title, company, description")
  console.log("\nActivity filters certification passed.\n")
}

main()
