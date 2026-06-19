/**
 * Growth Engine F2 — Video Autopilot draft builder certification.
 *
 * Local: pnpm test:growth-video-autopilot-drafts
 * Production: pnpm test:growth-video-autopilot-drafts:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildDeterministicGrowthVideoAutopilotRecommendation,
} from "../lib/growth/videos/growth-video-autopilot-prompt-service"
import {
  deriveGrowthVideoAutopilotChannel,
  deriveGrowthVideoAutopilotVideoType,
  scoreGrowthVideoAutopilotOpportunity,
  shouldRecommendGrowthVideoSend,
} from "../lib/growth/videos/growth-video-autopilot-score-service"
import {
  applyGrowthVideoAutopilotAssetDrafts,
  buildGrowthVideoAutopilotOverlayDraft,
  buildGrowthVideoAutopilotScriptDraft,
  buildGrowthVideoAutopilotThumbnailDraft,
} from "../lib/growth/videos/growth-video-autopilot-asset-builder"
import {
  buildGrowthVideoAutopilotAttachmentDraftMetadata,
  buildGrowthVideoAutopilotChannelPreviewDraft,
} from "../lib/growth/videos/growth-video-autopilot-attachment-builder"
import {
  GROWTH_VIDEO_AUTOPILOT_DRAFT_CONFIRM,
  GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY,
  GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
  GROWTH_VIDEO_AUTOPILOT_DRAFT_STATUSES,
} from "../lib/growth/videos/growth-video-autopilot-draft-types"
import {
  buildGrowthVideoAutopilotAvatarDraft,
  buildGrowthVideoAutopilotVoiceDraft,
} from "../lib/growth/videos/growth-video-autopilot-media-builder"
import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "../lib/growth/videos/growth-video-autopilot-types"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-autopilot-draft-types.ts",
  "lib/growth/videos/growth-video-autopilot-draft-service.ts",
  "lib/growth/videos/growth-video-autopilot-asset-builder.ts",
  "lib/growth/videos/growth-video-autopilot-page-builder.ts",
  "lib/growth/videos/growth-video-autopilot-media-builder.ts",
  "lib/growth/videos/growth-video-autopilot-attachment-builder.ts",
  "app/api/growth/videos/autopilot/drafts/route.ts",
  "app/api/growth/videos/autopilot/drafts/[id]/route.ts",
  "app/api/growth/videos/autopilot/drafts/[id]/build/route.ts",
  "app/api/growth/videos/autopilot/drafts/[id]/discard/route.ts",
  "components/growth/videos/growth-video-autopilot-drafts-panel.tsx",
  "components/growth/videos/growth-video-autopilot-draft-preview.tsx",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function sampleSnapshot() {
  return {
    leadId: "00000000-0000-4000-8000-000000000001",
    companyName: "Summit Diagnostics",
    contactName: "Alex Rivera",
    industry: "Healthcare",
    companySize: "50-200",
    painPoints: ["manual follow-up", "missed service calls"],
    fitScore: 82,
    momentumScore: 68,
    buyingCommitteeSummary: "Alex Rivera (VP Ops)",
    researchSummary: "Growing medical equipment service team.",
    engagementSummary: "Recent email opens.",
    relationshipSummary: "Warm relationship trend.",
    nextBestAction: "call_immediately",
    videoIntelligenceSignals: ["video_high_intent", "video_calendar_clicked"],
    videoEngagementScore: 88,
    sourcesUsed: ["growth.leads", "growth.lead_research_runs"],
  }
}

function sampleRecommendation() {
  const snapshot = sampleSnapshot()
  const scores = scoreGrowthVideoAutopilotOpportunity(snapshot)
  const videoType = deriveGrowthVideoAutopilotVideoType({ snapshot, reasons: scores.reasons })
  const channel = deriveGrowthVideoAutopilotChannel({ scores, snapshot })
  const recommended = buildDeterministicGrowthVideoAutopilotRecommendation({
    snapshot,
    scores,
    videoType,
    shouldSendVideo: shouldRecommendGrowthVideoSend(scores),
    channel,
  })

  return {
    id: randomUUID(),
    leadId: snapshot.leadId,
    organizationId: "00000000-0000-4000-8000-000000000002",
    status: "approved" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: "00000000-0000-4000-8000-000000000099",
    dismissedAt: null,
    dismissedBy: null,
    shouldSendVideo: true,
    videoType,
    scores,
    recommended: {
      ...recommended,
      voiceEnabled: true,
      avatarEnabled: true,
    },
    inputSnapshot: snapshot,
    aiPayload: null,
    sourcesUsed: snapshot.sourcesUsed,
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
    outreachExecution: false as const,
    enrollmentExecution: false as const,
  }
}

function sampleDraftPackage(recommendationId: string) {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    organizationId: "00000000-0000-4000-8000-000000000002",
    leadId: "00000000-0000-4000-8000-000000000001",
    recommendationId,
    status: "draft" as const,
    createdAt: now,
    updatedAt: now,
    builtAt: null,
    discardedAt: null,
    scriptDraft: {
      script: null,
      hook: null,
      talkingPoints: [],
      ctaCopy: null,
      sourcesUsed: [],
    },
    thumbnailDraft: {
      thumbnailText: null,
      previewDataUrl: null,
      storagePath: null,
      sourcesUsed: [],
    },
    overlayDraft: {
      overlayText: null,
      previewHtml: null,
      sourcesUsed: [],
    },
    pageDraft: {
      videoPageId: null,
      videoAssetId: null,
      slug: null,
      title: null,
      description: null,
      status: "draft" as const,
      ctaLabel: null,
      ctaUrl: null,
      calendarUrl: null,
      published: false as const,
      metadata: {},
    },
    voiceDraft: null,
    avatarDraft: null,
    attachmentDraft: {
      sequenceAttachmentId: null,
      attachmentType: "email" as const,
      attachmentStatus: "pending_approval" as const,
      videoPageId: null,
      videoAssetId: null,
      voiceMediaAssetId: null,
      avatarMediaAssetId: null,
      thumbnailUrl: null,
      automationNodeId: null,
      sequencePatternStepId: null,
      metadataHooks: {},
      analyticsHooks: {},
    },
    channelPreviewDraft: {
      channel: "email" as const,
      publicUrl: null,
      emailHtml: null,
      smsText: null,
      voiceDropSummary: null,
    },
    relationships: {
      recommendationId,
      videoPageId: null,
      videoAssetId: null,
      sequenceAttachmentId: null,
      voiceMediaGenerationRunId: null,
      avatarMediaGenerationRunId: null,
    },
    sourcesUsed: ["f1_recommendation"],
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
    outreachExecution: false as const,
    enrollmentExecution: false as const,
    workerExecutionEnabled: false as const,
  }
}

function runLocalRegression(): void {
  console.log(`\n=== F2 Video Autopilot Drafts (${GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER, "growth-video-autopilot-draft-f2-v1")
  assert.equal(GROWTH_VIDEO_AUTOPILOT_DRAFT_CONFIRM, "RUN_GROWTH_VIDEO_AUTOPILOT_DRAFT_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY, "growth_video_autopilot_f2")
  assert.deepEqual([...GROWTH_VIDEO_AUTOPILOT_DRAFT_STATUSES], ["draft", "building", "ready", "discarded"])
  console.log("  ✓ QA marker, confirm token, metadata key, draft states")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} F2 module files exist`)

  const draftService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-autopilot-draft-service.ts"),
    "utf8",
  )
  assert.match(draftService, /buildGrowthVideoAutopilotDraftPackage/)
  assert.match(draftService, /discardGrowthVideoAutopilotDraft/)
  assert.match(draftService, /GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY/)
  assert.ok(!draftService.includes("runSequenceExecutionJob"))
  assert.ok(!draftService.includes("queueSequenceStepTransportJob"))
  assert.ok(!draftService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!draftService.includes("createMediaGenerationJob"))
  assert.ok(!draftService.includes("executeTransportSend"))
  console.log("  ✓ draft service builds/discards only (no sends/enrollment/workers)")

  const mediaBuilder = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-autopilot-media-builder.ts"),
    "utf8",
  )
  assert.match(mediaBuilder, /workerExecutionEnabled: false/)
  assert.match(mediaBuilder, /queued: false/)
  assert.ok(!mediaBuilder.includes("createMediaGenerationJob"))
  console.log("  ✓ voice/avatar drafts are metadata-only")

  for (const routePath of [
    "app/api/growth/videos/autopilot/drafts/route.ts",
    "app/api/growth/videos/autopilot/drafts/[id]/route.ts",
    "app/api/growth/videos/autopilot/drafts/[id]/build/route.ts",
    "app/api/growth/videos/autopilot/drafts/[id]/discard/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
    assert.ok(!source.includes("executeTransportSend"))
    assert.ok(!source.includes("runSequenceExecutionJob"))
  }
  console.log("  ✓ draft APIs are platform gated + safety JSON (no sends)")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("growth_video_autopilot_f2"))
    assert.ok(!source.includes("buildGrowthVideoAutopilotDraftPackage"))
  }
  console.log("  ✓ sequence schedulers/runners unchanged")

  const recommendation = sampleRecommendation()
  const draft = sampleDraftPackage(recommendation.id)
  const built = applyGrowthVideoAutopilotAssetDrafts(draft, recommendation)

  assert.ok(buildGrowthVideoAutopilotScriptDraft(recommendation).script?.includes("Alex"))
  assert.ok(buildGrowthVideoAutopilotThumbnailDraft(recommendation).previewDataUrl?.startsWith("data:image/svg+xml"))
  assert.ok(buildGrowthVideoAutopilotOverlayDraft(recommendation).overlayText)

  const attachmentDraft = buildGrowthVideoAutopilotAttachmentDraftMetadata({
    recommendation,
    build: {
      organizationId: recommendation.organizationId,
      leadId: recommendation.leadId,
      recommendationId: recommendation.id,
    },
  })
  assert.equal(attachmentDraft.attachmentStatus, "pending_approval")

  const channelPreview = buildGrowthVideoAutopilotChannelPreviewDraft({
    recommendation,
    attachmentDraft,
    thumbnailPreviewDataUrl: built.thumbnailDraft.previewDataUrl,
  })
  assert.ok(channelPreview.emailHtml || channelPreview.smsText || channelPreview.voiceDropSummary)

  const voiceDraft = buildGrowthVideoAutopilotVoiceDraft({
    build: {
      organizationId: recommendation.organizationId,
      leadId: recommendation.leadId,
      recommendationId: recommendation.id,
    },
    recommendation,
  })
  const avatarDraft = buildGrowthVideoAutopilotAvatarDraft({
    build: {
      organizationId: recommendation.organizationId,
      leadId: recommendation.leadId,
      recommendationId: recommendation.id,
    },
    recommendation,
  })
  assert.equal(voiceDraft?.status, "draft")
  assert.equal(voiceDraft?.queued, false)
  assert.equal(avatarDraft?.status, "draft")
  assert.equal(avatarDraft?.workerExecutionEnabled, false)

  assert.equal(built.status, "draft")
  assert.equal(built.requiresHumanReview, true)
  assert.equal(built.workerExecutionEnabled, false)
  assert.equal(built.relationships.recommendationId, recommendation.id)
  console.log("  ✓ asset/attachment/media/preview draft builders")

  console.log("\nF2 Video Autopilot Drafts local regression PASS\n")
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
  const schema = await probeGrowthVideoFoundationSchema(admin)

  return {
    ok: schema.ready,
    qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    parent_qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    foundation_schema_ready: schema.ready,
    pages_schema_ready: schema.pages_schema_ready,
    blockers: [
      !schema.ready ? "foundation_schema_not_ready" : null,
      !schema.pages_schema_ready ? "pages_schema_not_ready" : null,
    ].filter(Boolean),
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
    final_verdict: schema.ready && schema.pages_schema_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nF2 Video Autopilot Drafts production certification PASS\n")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
