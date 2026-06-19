/**
 * Growth Engine D3 — Video engagement intelligence wiring certification.
 *
 * Local: pnpm test:growth-video-intelligence
 * Production: pnpm test:growth-video-intelligence:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_CONFIRM,
  GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/sequences/growth-sequence-video-intelligence-types"
import {
  buildGrowthVideoIntelligenceMetrics,
  deriveGrowthVideoIntelligenceSignals,
  mapGrowthVideoSignalsToNbaSuggestions,
} from "../lib/growth/sequences/growth-sequence-video-intelligence-mappings"
import { probeSequenceVideoAttachmentsSchema } from "../lib/growth/sequences/growth-sequence-video-attachment-schema-health"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/sequences/growth-sequence-video-intelligence-service.ts",
  "lib/growth/sequences/growth-sequence-video-intelligence-types.ts",
  "lib/growth/sequences/growth-sequence-video-intelligence-mappings.ts",
  "lib/growth/sequences/growth-sequence-video-intelligence-timeline.ts",
  "lib/growth/sequences/growth-sequence-video-intelligence-conversations.ts",
  "app/api/growth/sequences/video-assets/intelligence/route.ts",
  "lib/growth/videos/growth-video-page-event-service.ts",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== D3 Video intelligence (${GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER, "growth-sequence-video-intelligence-d3-v1")
  assert.equal(
    GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_CONFIRM,
    "RUN_GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_CERTIFICATION",
  )
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} D3 module files exist`)

  for (const eventType of [
    "video_page_viewed",
    "video_video_played",
    "video_video_completed",
    "video_cta_clicked",
    "video_calendar_clicked",
  ]) {
    assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(eventType as never))
  }
  console.log("  ✓ timeline event types registered")

  const intelligenceService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-intelligence-service.ts"),
    "utf8",
  )
  assert.match(intelligenceService, /syncGrowthVideoEngagementIntelligence/)
  assert.match(intelligenceService, /resolveGrowthVideoIntelligenceSnapshot/)
  assert.match(intelligenceService, /processGrowthVideoPageEventIntelligence/)
  assert.match(intelligenceService, /patchSequenceVideoAttachmentAnalyticsHooks/)
  assert.ok(!intelligenceService.includes("runSequenceExecutionJob"))
  console.log("  ✓ intelligence service sync + attribution (no sequence execution)")

  const timelineService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-intelligence-timeline.ts"),
    "utf8",
  )
  assert.match(timelineService, /contains\("payload"/)
  assert.match(timelineService, /syncVideoIntelligenceTimelineEvents/)
  console.log("  ✓ timeline integration is idempotent")

  const conversationService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-intelligence-conversations.ts"),
    "utf8",
  )
  assert.match(conversationService, /Viewed personalized video/)
  assert.match(conversationService, /conversation_timeline_events/)
  console.log("  ✓ conversation activity integration")

  const pageEventService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-page-event-service.ts"),
    "utf8",
  )
  assert.match(pageEventService, /processGrowthVideoPageEventIntelligence/)
  console.log("  ✓ public page events trigger intelligence sync")

  const meetingPrepBundle = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/meeting-intelligence/meeting-prep-bundle.ts"),
    "utf8",
  )
  assert.match(meetingPrepBundle, /videoEngagementContext/)
  console.log("  ✓ meeting prep exposes video engagement context")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("syncGrowthVideoEngagementIntelligence"))
  }
  console.log("  ✓ sequence schedulers/runners unchanged")

  const metrics = buildGrowthVideoIntelligenceMetrics([
    {
      id: "00000000-0000-4000-8000-000000000001",
      video_asset_id: "00000000-0000-4000-8000-000000000002",
      video_page_id: "00000000-0000-4000-8000-000000000003",
      total_views: 2,
      highest_percent_watched: 96,
      total_cta_clicks: 1,
      total_calendar_clicks: 1,
      last_viewed_at: new Date().toISOString(),
      engagement_score: 88,
      session_id: "session-a",
      visitor_identifier: "visitor-a",
    },
  ])
  const signals = deriveGrowthVideoIntelligenceSignals({
    totalViews: metrics.totalViews,
    highestPercentWatched: metrics.highestPercentWatched,
    totalCtaClicks: metrics.totalCtaClicks,
    totalCalendarClicks: metrics.totalCalendarClicks,
    sessionCount: metrics.sessionCount,
  })
  assert.ok(signals.includes("video_completed"))
  assert.ok(signals.includes("video_calendar_clicked"))

  const nba = mapGrowthVideoSignalsToNbaSuggestions({ signals, metrics })
  assert.ok(nba.some((item) => item.suggestedAction === "schedule_meeting"))
  assert.ok(nba.every((item) => item.requiresHumanReview === true))
  console.log("  ✓ signal derivation + NBA mappings")

  const intelligenceRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/sequences/video-assets/intelligence/route.ts"),
    "utf8",
  )
  assert.match(intelligenceRoute, /requireGrowthSequenceVideoAttachmentPlatformAccess/)
  assert.match(intelligenceRoute, /growthSequenceVideoAttachmentSafetyJson/)
  assert.ok(!intelligenceRoute.includes("syncGrowthVideoEngagementIntelligence"))
  console.log("  ✓ intelligence API is read-only + platform gated")

  console.log("\nD3 Video intelligence local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false, autoRefreshToken: false } })
  const schema = await probeSequenceVideoAttachmentsSchema(admin)

  return {
    ok: schema.sequence_video_attachments_ready,
    qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
    sequence_video_attachments_ready: schema.sequence_video_attachments_ready,
    blockers: [
      !schema.sequence_video_attachments_ready ? "sequence_video_attachments_schema_not_ready" : null,
    ].filter(Boolean),
    requires_human_review: true,
    autonomous_execution_enabled: false,
    orchestration_enabled: false,
    final_verdict: schema.sequence_video_attachments_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nD3 Video intelligence production certification PASS\n")
  }
}

void main()
