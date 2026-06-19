/**
 * Growth Engine SP-INT-1 — Share page intelligence certification.
 *
 * Local: pnpm test:growth-share-page-intelligence
 * Production: pnpm test:growth-share-page-intelligence:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthSharePageIntelligenceMetrics,
  deriveGrowthSharePageIntelligenceSignals,
  mapGrowthSharePageSignalsToNbaSuggestions,
} from "../lib/growth/share-pages/growth-share-page-intelligence-mappings"
import {
  GROWTH_SHARE_PAGE_INTELLIGENCE_CONFIRM,
  GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY,
  GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  growthSharePageIntelligenceSafetyPayload,
} from "../lib/growth/share-pages/growth-share-page-intelligence-types"
import { EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY } from "../lib/growth/share-pages/share-page-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

const REQUIRED_FILES = [
  "lib/growth/share-pages/growth-share-page-intelligence-service.ts",
  "lib/growth/share-pages/growth-share-page-intelligence-types.ts",
  "lib/growth/share-pages/growth-share-page-intelligence-mappings.ts",
  "lib/growth/share-pages/growth-share-page-intelligence-timeline.ts",
  "lib/growth/share-pages/growth-share-page-intelligence-conversations.ts",
  "lib/growth/share-pages/growth-share-page-engagement-service.ts",
  "lib/growth/share-pages/growth-share-page-attribution-service.ts",
  "app/api/growth/share-pages/intelligence/route.ts",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function samplePage() {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    organizationId: "00000000-0000-4000-8000-000000000002",
    leadId: "00000000-0000-4000-8000-000000000001",
    companyId: null,
    campaignId: null,
    enrollmentId: null,
    sequenceStepId: "00000000-0000-4000-8000-000000000201",
    sequenceEnrollmentStepId: null,
    sequenceExecutionJobId: "00000000-0000-4000-8000-000000000202",
    sourceChannel: "manual" as const,
    status: "published" as const,
    tokenPrefix: "sp_test",
    publishedAt: new Date().toISOString(),
    expiresAt: null,
    revokedAt: null,
    archivedAt: null,
    firstViewedAt: new Date().toISOString(),
    lastViewedAt: new Date().toISOString(),
    maxViews: null,
    engagementSummary: {
      ...EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY,
      viewCount: 3,
      uniqueSessionCount: 2,
      ctaClickCount: 1,
      bookingStartedCount: 1,
      bookingCompletedCount: 0,
    },
    personalizationSnapshot: {},
    personalizationContextVersion: 1,
    sourcesUsed: ["growth.leads"],
    evidenceCoverageScore: 72,
    theme: {
      brandColor: "#059669",
      accentColor: "#047857",
      logoUrl: null,
      heroImageUrl: null,
      publicThemeMode: "system" as const,
      footerNote: null,
    },
    headline: "A note for Alex",
    subheadline: null,
    heroMessage: "Hi Alex",
    whyReachingOut: null,
    companyObservations: [],
    ctaConfig: [{ id: "cta-1", label: "Book a call", kind: "primary" as const, action: "book_meeting" as const, destinationUrl: null, resourceId: null, trackingKey: "book" }],
    resources: [],
    bookingPageId: null,
    heroMediaType: "none" as const,
    heroMediaUrl: null,
    heroMediaThumbnailUrl: null,
    voiceAssetId: null,
    videoAssetId: null,
    sharePageTemplateId: null,
    sharePageTemplateVersionId: null,
    templateBlocksSnapshot: null,
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    requiresHumanReview: true as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function runStaticChecks() {
  console.log(`Growth Share Page Intelligence certification (${GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER})`)
  console.log(`Metadata key: ${GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY}`)
  console.log(`Confirm token: ${GROWTH_SHARE_PAGE_INTELLIGENCE_CONFIRM}`)

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("syncGrowthSharePageEngagementIntelligence"))
    assert.ok(!source.includes("processGrowthSharePageEventIntelligence"))
  }

  const intelligenceService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/growth-share-page-intelligence-service.ts"),
    "utf8",
  )
  assert.match(intelligenceService, /syncGrowthSharePageEngagementIntelligence/)
  assert.match(intelligenceService, /resolveGrowthSharePageIntelligenceSnapshot/)
  assert.match(intelligenceService, /processGrowthSharePageEventIntelligence/)
  assert.match(intelligenceService, /GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY/)
  assert.ok(!intelligenceService.includes("runSequenceExecutionJob"))
  assert.ok(!intelligenceService.includes("dispatchSequenceEventWakeSafely"))

  const analyticsService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-analytics-service.ts"),
    "utf8",
  )
  assert.match(analyticsService, /processGrowthSharePageEventIntelligence/)

  const timelineService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/growth-share-page-intelligence-timeline.ts"),
    "utf8",
  )
  assert.match(timelineService, /contains\("payload"/)
  assert.match(timelineService, /syncSharePageIntelligenceTimelineEvents/)

  const conversationService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/growth-share-page-intelligence-conversations.ts"),
    "utf8",
  )
  assert.match(conversationService, /Viewed personalized page/)
  assert.match(conversationService, /conversation_timeline_events/)

  const intelligenceRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/share-pages/intelligence/route.ts"),
    "utf8",
  )
  assert.match(intelligenceRoute, /requireSharePagePlatformAccess/)
  assert.match(intelligenceRoute, /growthSharePageWorkspaceSafetyJson/)
  assert.ok(!intelligenceRoute.includes("syncGrowthSharePageEngagementIntelligence"))

  for (const eventType of [
    "share_page_viewed",
    "share_page_cta_clicked",
    "share_page_calendar_clicked",
    "share_page_return_visit",
    "share_page_high_intent",
  ]) {
    assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(eventType as never))
  }

  const safety = growthSharePageIntelligenceSafetyPayload()
  assert.equal(safety.autonomous_execution_enabled, false)
  assert.equal(safety.orchestration_enabled, false)
}

function runUnitChecks() {
  const page = samplePage()
  const metrics = buildGrowthSharePageIntelligenceMetrics({
    page,
    analytics: null,
    sessionCount: 2,
    primarySessionId: "session-a",
  })
  const signals = deriveGrowthSharePageIntelligenceSignals({
    totalViews: metrics.totalViews,
    ctaClicks: metrics.ctaClicks,
    calendarClicks: metrics.calendarClicks,
    sessionCount: metrics.sessionCount,
    highIntent: true,
  })
  assert.ok(signals.includes("share_page_high_intent"))
  assert.ok(signals.includes("share_page_return_visitor"))

  const nba = mapGrowthSharePageSignalsToNbaSuggestions({ signals, metrics })
  assert.ok(nba.some((item) => item.suggestedAction === "schedule_meeting"))
  assert.ok(nba.every((item) => item.requiresHumanReview === true))
}

async function main() {
  runStaticChecks()
  runUnitChecks()
  console.log("PASS — growth share page intelligence certification")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
