/**
 * GS-AI-PLAYBOOK-5C — Activity source adapters certification.
 * Run: pnpm test:growth-activity-adapters
 */
import assert from "node:assert/strict"
import {
  mapEngagementTimelineEventToEventView,
  mapLeadTimelineRowToEventView,
  mapPersonalizationGenerationToEventViews,
  mapSendrActivityFeedRowToEventView,
  mapSignalFeedItemToEventView,
} from "../lib/growth/activity/growth-activity-source-adapters"
import { GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES } from "../lib/growth/activity/growth-activity-event-types"

function runSendrAdapterCert(): void {
  const event = mapSendrActivityFeedRowToEventView({
    id: "e1",
    eventType: "video_complete",
    eventLabel: "Video Completed",
    occurredAt: "2026-06-21T12:00:00.000Z",
    leadId: "lead-1",
    leadName: "Nicole",
    companyName: "Sterling",
    intentScore: 88,
    landingPageId: "page-1",
    landingPageTitle: "Demo",
    sessionId: null,
    metadata: {},
  })
  assert.equal(event.category, "content")
  assert.equal(event.source, "personalized_video")
  assert.ok(event.metadata.rawEventType)
  console.log("  ✓ Sendr engagement adapter")
}

function runTimelineAdapterCert(): void {
  for (const eventType of GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES.slice(0, 3)) {
    const event = mapLeadTimelineRowToEventView({
      id: "t1",
      leadId: "lead-1",
      leadName: "Nicole",
      companyName: "Sterling",
      eventType,
      title: "Email Opened",
      summary: "Prospect opened outreach",
      occurredAt: "2026-06-21T12:00:00.000Z",
      payload: { channel: "email" },
    })
    assert.equal(event.category, "communication")
    assert.equal(event.source, "lead_timeline")
  }
  console.log("  ✓ lead timeline communication adapter")
}

function runPersonalizationAdapterCert(): void {
  const events = mapPersonalizationGenerationToEventViews({
    id: "gen-1",
    leadId: "lead-1",
    leadLabel: "Sterling Biomedical",
    status: "approved",
    subject: "Quick question",
    body: "Hi there",
    personalizationScore: 82,
    evidenceCoverageScore: 55,
    riskLevel: "low",
    blockedReason: "",
    sourceSummary: [],
    requiresHumanReview: true,
    approvedAt: "2026-06-21T13:00:00.000Z",
    rejectedAt: null,
    sentAt: null,
    createdAt: "2026-06-21T12:00:00.000Z",
    updatedAt: "2026-06-21T13:00:00.000Z",
  })
  assert.ok(events.some((event) => event.type === "personalization_generated"))
  assert.ok(events.some((event) => event.type === "personalization_approved"))
  assert.ok(events.every((event) => event.category === "personalization"))
  console.log("  ✓ personalization generation adapter")
}

function runEngagementAdapterCert(): void {
  const event = mapEngagementTimelineEventToEventView({
    eventId: "sp-1",
    eventType: "high_intent_detected",
    occurredAt: "2026-06-21T12:00:00.000Z",
    leadId: "lead-1",
    sharePageId: "share-1",
    templateId: null,
    mediaAssetId: null,
    ctaKey: null,
    sessionId: null,
    title: "High intent detected",
    description: "Repeat CTA engagement",
    metadata: { intent_score: 78 },
    source: "signal",
  })
  assert.equal(event.category, "intelligence")
  assert.equal(event.source, "share_page")
  console.log("  ✓ engagement timeline adapter")
}

function runSignalAdapterCert(): void {
  const event = mapSignalFeedItemToEventView({
    qa_marker: "growth-signal-feed-gs1d-v1",
    id: "sig-1",
    audit_event_id: "audit-1",
    lead_id: "lead-1",
    company_name: "Sterling",
    signal_type: "reply_received",
    signal_label: "Reply received",
    source_domain: "inbox",
    confidence: 0.9,
    urgency: "high",
    signal_score: 85,
    occurred_at: "2026-06-21T12:00:00.000Z",
    recommended_action: "Review reply",
    expected_impact: "Advance opportunity",
    reasoning: "Positive tone",
    priority: "high",
    status: "new",
    dedupe_hash: null,
    collapsed_count: 1,
    queue_hint: null,
    cta: { view_lead: null, review_company: null, open_timeline: null, review_sequence: null },
    requires_human_approval: true,
  })
  assert.equal(event.category, "communication")
  assert.equal(event.metadata.isUnread, true)
  console.log("  ✓ signal feed adapter")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5C Activity Adapters Certification ===\n")
  runSendrAdapterCert()
  runTimelineAdapterCert()
  runPersonalizationAdapterCert()
  runEngagementAdapterCert()
  runSignalAdapterCert()
  console.log("\nActivity adapters certification passed.\n")
}

main()
