/**
 * Growth Engine D2 — Sequence video attachment send-builder wiring certification.
 *
 * Local: pnpm test:growth-sequence-video-send-builders
 * Production: pnpm test:growth-sequence-video-send-builders:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_CONFIRM,
  GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER,
} from "../lib/growth/sequences/growth-sequence-video-attachment-types"
import {
  applySequenceVideoAttachmentToEmailHtml,
  applySequenceVideoAttachmentToSmsBody,
  applySequenceVideoAttachmentToVoiceDropMessage,
  buildSequenceVideoSendAnalyticsHooks,
  renderSequenceVideoEmailSendBlock,
  renderSequenceVideoSmsSendBlock,
  renderSequenceVideoVoiceDropSendBlock,
} from "../lib/growth/sequences/growth-sequence-video-send-render"
import { probeSequenceVideoAttachmentsSchema } from "../lib/growth/sequences/growth-sequence-video-attachment-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/sequences/growth-sequence-video-send-builder-service.ts",
  "lib/growth/sequences/growth-sequence-video-send-render.ts",
  "lib/growth/sequences/growth-sequence-video-attribution-service.ts",
  "lib/growth/sequences/growth-sequence-video-engagement-service.ts",
  "app/api/growth/sequences/video-assets/send-preview/route.ts",
  "app/api/growth/sequences/video-assets/analytics/route.ts",
  "lib/growth/sequences/execution/sequence-send-builder.ts",
  "lib/growth/sequences/execution/sequence-sms-send-builder.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-send-builder.ts",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/sequences/growth-sequence-video-attachment-service.ts",
  "lib/growth/sequences/growth-sequence-video-render-service.ts",
  "lib/growth/sequences/growth-sequence-video-preview-service.ts",
  "lib/growth/videos/growth-video-personalization-service.ts",
  "lib/growth/videos/growth-video-thumbnail-service.ts",
  "lib/growth/videos/growth-video-analytics-summary-service.ts",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

const WIRED_SEND_BUILDERS = [
  "lib/growth/sequences/execution/sequence-send-builder.ts",
  "lib/growth/sequences/execution/sequence-sms-send-builder.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-send-builder.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== D2 Sequence video send builders (${GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER, "growth-sequence-video-send-builders-d2-v1")
  assert.equal(
    GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_CONFIRM,
    "RUN_GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_CERTIFICATION",
  )
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} D2 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  for (const relativePath of WIRED_SEND_BUILDERS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.match(source, /wireApprovedSequenceVideoAttachment/)
    assert.match(source, /sequenceVideoAttachment/)
    assert.ok(!source.includes("runSequenceExecutionJob"))
    assert.ok(!source.includes("queueSequenceStepTransportJob"))
  }
  console.log("  ✓ email/SMS/voice send builders wire approved attachments")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("wireApprovedSequenceVideoAttachment"))
  }
  console.log("  ✓ sequence schedulers/runners unchanged")

  const sendBuilderService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-send-builder-service.ts"),
    "utf8",
  )
  assert.match(sendBuilderService, /attachmentStatus: "approved"/)
  assert.match(sendBuilderService, /resolveGrowthVideoPublicThumbnailUrls/)
  assert.match(sendBuilderService, /renderGrowthVideoPageFields/)
  assert.match(sendBuilderService, /persistSequenceVideoSendAttribution/)
  assert.ok(!sendBuilderService.includes("runSequenceExecutionJob"))
  console.log("  ✓ send-builder service resolves approved attachments + signed thumbnails")

  const attributionService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-attribution-service.ts"),
    "utf8",
  )
  assert.match(attributionService, /analytics_hooks/)
  assert.match(attributionService, /patchSequenceVideoAttachmentAnalyticsHooks/)
  console.log("  ✓ attribution service patches metadata analytics hooks only")

  const engagementService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-engagement-service.ts"),
    "utf8",
  )
  assert.match(engagementService, /video_engagement_summaries/)
  assert.match(engagementService, /deriveGrowthVideoIntelligenceSignals/)
  assert.match(engagementService, /GROWTH_SEQUENCE_VIDEO_D3_SIGNALS/)
  assert.match(engagementService, /orchestration_enabled: false/)
  console.log("  ✓ engagement service prepares D3 metadata signals only")

  for (const routePath of [
    "app/api/growth/sequences/video-assets/send-preview/route.ts",
    "app/api/growth/sequences/video-assets/analytics/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthSequenceVideoAttachmentPlatformAccess/)
    assert.match(source, /growthSequenceVideoAttachmentSafetyJson/)
    assert.ok(!source.includes("executeTransportSend"))
  }
  console.log("  ✓ diagnostics APIs are read-only + platform gated")

  const emailHtml = renderSequenceVideoEmailSendBlock({
    firstName: "Jane",
    publicUrl: "https://app.equipify.ai/v/demo",
    thumbnailUrl: "https://example.com/thumb.png",
    ctaLabel: "Watch Personalized Video",
  })
  assert.match(emailHtml, /I recorded a quick video for you/)
  assert.match(emailHtml, /Watch Personalized Video/)
  assert.match(emailHtml, /thumb.png/)

  const smsText = renderSequenceVideoSmsSendBlock({
    firstName: "Jane",
    publicUrl: "https://app.equipify.ai/v/demo",
    ctaLabel: "Book a Demo",
    ctaUrl: "https://example.com/demo",
  })
  assert.match(smsText, /Hey Jane/)
  assert.match(smsText, /I recorded a quick video for you/)
  assert.match(smsText, /Book a Demo/)

  const voiceSummary = renderSequenceVideoVoiceDropSendBlock({
    voiceMediaAssetId: "00000000-0000-4000-8000-000000000001",
    publicUrl: "https://app.equipify.ai/v/demo",
  })
  assert.match(voiceSummary, /Voice asset attached/)
  assert.match(voiceSummary, /Follow-up page/)

  const wirePreview = {
    channelPreview: { channel: "email" as const, emailHtml: emailHtml },
    attribution: {
      attachmentId: "00000000-0000-4000-8000-000000000099",
      videoAssetId: null,
      videoPageId: null,
      thumbnailUrl: null,
      voiceMediaAssetId: null,
      avatarMediaAssetId: null,
      publicUrl: null,
      metadataHooks: {},
      analyticsHooks: {},
      aiPayload: {
        attachment_type: "email" as const,
        video_asset_id: null,
        video_page_id: null,
        thumbnail_url: null,
        voice_media_asset_id: null,
        avatar_media_asset_id: null,
        sequence_step_id: null,
        requires_human_review: true as const,
        autonomous_execution_enabled: false as const,
      },
      d3Signals: [],
    },
  }

  assert.match(
    applySequenceVideoAttachmentToEmailHtml("<p>Hello</p>", wirePreview),
    /I recorded a quick video for you/,
  )
  assert.match(
    applySequenceVideoAttachmentToSmsBody("Original body", {
      ...wirePreview,
      channelPreview: { channel: "sms", smsText },
    }),
    /Original body/,
  )
  assert.match(
    applySequenceVideoAttachmentToVoiceDropMessage("Campaign script", {
      ...wirePreview,
      channelPreview: { channel: "voice_drop", voiceDropSummary: voiceSummary },
    }),
    /Campaign script/,
  )
  console.log("  ✓ channel render + apply helpers")

  const analyticsHooks = buildSequenceVideoSendAnalyticsHooks({
    attachment: {
      sequencePatternStepId: "00000000-0000-4000-8000-000000000010",
      analyticsHooks: {},
    },
    sequenceExecutionId: "00000000-0000-4000-8000-000000000011",
    enrollmentStepId: "00000000-0000-4000-8000-000000000012",
    emailSendId: "00000000-0000-4000-8000-000000000013",
  })
  assert.equal(analyticsHooks.sequence_execution_id, "00000000-0000-4000-8000-000000000011")
  assert.equal(analyticsHooks.email_send_id, "00000000-0000-4000-8000-000000000013")
  console.log("  ✓ analytics hook builder populates send attribution fields")

  console.log("\nD2 Sequence video send builders local regression PASS\n")
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
    qa_marker: GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER,
    sequence_video_attachments_ready: schema.sequence_video_attachments_ready,
    blockers: [
      !schema.sequence_video_attachments_ready ? "sequence_video_attachments_schema_not_ready" : null,
    ].filter(Boolean),
    d3_dependencies: [
      "Autopilot orchestration from video engagement signals (requires_human_review only)",
      "Bulk attachment approval queue integration",
      "NBA v2 video intent routing (metadata-only prep complete in D2)",
    ],
    outreach_execution: false,
    sequence_execution_modified: false,
    autonomous_execution_enabled: false,
    requires_human_review: true,
    final_verdict: schema.sequence_video_attachments_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nD2 Sequence video send builders production certification PASS\n")
  }
}

void main()
