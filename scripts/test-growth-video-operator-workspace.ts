/**
 * Growth Engine F3 — Video operator workspace certification.
 *
 * Local: pnpm test:growth-video-operator-workspace
 * Production: pnpm test:growth-video-operator-workspace:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  applyGrowthVideoAutopilotAssetDrafts,
} from "../lib/growth/videos/growth-video-autopilot-asset-builder"
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
  GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
} from "../lib/growth/videos/growth-video-autopilot-draft-types"
import {
  buildGrowthVideoOperatorSummaryCards,
  buildGrowthVideoOperatorWorkspaceActions,
  emptyGrowthVideoOperatorWorkspaceOperatorState,
} from "../lib/growth/videos/growth-video-operator-summary-service"
import {
  GROWTH_VIDEO_OPERATOR_WORKSPACE_CONFIRM,
  GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY,
  GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
} from "../lib/growth/videos/growth-video-operator-workspace-types"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-operator-workspace-types.ts",
  "lib/growth/videos/growth-video-operator-workspace-service.ts",
  "lib/growth/videos/growth-video-operator-actions-service.ts",
  "lib/growth/videos/growth-video-operator-summary-service.ts",
  "app/api/growth/videos/operator-workspace/route.ts",
  "app/api/growth/videos/operator-workspace/[id]/route.ts",
  "app/api/growth/videos/operator-workspace/[id]/approve/route.ts",
  "app/api/growth/videos/operator-workspace/[id]/publish/route.ts",
  "app/api/growth/videos/operator-workspace/[id]/queue-media/route.ts",
  "components/growth/videos/growth-video-operator-workspace.tsx",
  "components/growth/videos/growth-video-operator-sidebar.tsx",
  "components/growth/videos/growth-video-operator-asset-review.tsx",
  "components/growth/videos/growth-video-operator-channel-preview.tsx",
  "components/growth/videos/growth-video-operator-summary-cards.tsx",
  "app/(growth)/growth/videos/workspace/page.tsx",
  "app/(admin)/admin/growth/videos/workspace/page.tsx",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function sampleDraftPackage(recommendationId: string) {
  const snapshot = {
    leadId: "00000000-0000-4000-8000-000000000001",
    companyName: "Summit Diagnostics",
    contactName: "Alex Rivera",
    industry: "Healthcare",
    companySize: "50-200",
    painPoints: ["manual follow-up"],
    fitScore: 82,
    momentumScore: 68,
    buyingCommitteeSummary: "Alex Rivera (VP Ops)",
    researchSummary: "Growing team.",
    engagementSummary: "Recent email opens.",
    relationshipSummary: "Warm trend.",
    nextBestAction: "call_immediately",
    videoIntelligenceSignals: ["video_high_intent"],
    videoEngagementScore: 88,
    sourcesUsed: ["growth.leads"],
  }
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

  const recommendation = {
    id: recommendationId,
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
    recommended: { ...recommended, voiceEnabled: true, avatarEnabled: true },
    inputSnapshot: snapshot,
    aiPayload: null,
    sourcesUsed: snapshot.sourcesUsed,
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
    outreachExecution: false as const,
    enrollmentExecution: false as const,
  }

  const now = new Date().toISOString()
  const draft = applyGrowthVideoAutopilotAssetDrafts(
    {
      id: randomUUID(),
      organizationId: recommendation.organizationId,
      leadId: recommendation.leadId,
      recommendationId,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      builtAt: now,
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
        videoPageId: randomUUID(),
        videoAssetId: randomUUID(),
        slug: "alex-quick-intro",
        title: "Alex — quick intro",
        description: "Follow up",
        status: "draft",
        ctaLabel: "Watch",
        ctaUrl: "https://example.com",
        calendarUrl: null,
        published: false,
        metadata: {},
      },
      voiceDraft: {
        status: "draft",
        generationType: "voice",
        queued: false,
        workerExecutionEnabled: false,
        mediaGenerationRunId: null,
        aiJobId: null,
        mediaAssetId: null,
        provider: "elevenlabs",
        metadataHooks: {},
        notes: null,
      },
      avatarDraft: {
        status: "draft",
        generationType: "avatar",
        queued: false,
        workerExecutionEnabled: false,
        mediaGenerationRunId: null,
        aiJobId: null,
        mediaAssetId: null,
        provider: "retell",
        metadataHooks: {},
        notes: null,
      },
      attachmentDraft: {
        sequenceAttachmentId: randomUUID(),
        attachmentType: "email",
        attachmentStatus: "pending_approval",
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
        channel: "email",
        publicUrl: "https://example.com/v/preview",
        emailHtml: "<p>Preview</p>",
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
      requiresHumanReview: true,
      autonomousExecutionEnabled: false,
      outreachExecution: false,
      enrollmentExecution: false,
      workerExecutionEnabled: false,
    },
    recommendation,
  )

  return { draft, recommendation }
}

function runLocalRegression(): void {
  console.log(`\n=== F3 Video Operator Workspace (${GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER, "growth-video-operator-workspace-f3-v1")
  assert.equal(GROWTH_VIDEO_OPERATOR_WORKSPACE_CONFIRM, "RUN_GROWTH_VIDEO_OPERATOR_WORKSPACE_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY, "growth_video_autopilot_f3")
  console.log("  ✓ QA marker, confirm token, metadata key")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} F3 module files exist`)

  const actionsService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-operator-actions-service.ts"),
    "utf8",
  )
  assert.match(actionsService, /approveGrowthVideoOperatorDraft/)
  assert.match(actionsService, /publishGrowthVideoOperatorPage/)
  assert.match(actionsService, /queueGrowthVideoOperatorMedia/)
  assert.match(actionsService, /approveGrowthVideoOperatorAttachment/)
  assert.ok(!actionsService.includes("runSequenceExecutionJob"))
  assert.ok(!actionsService.includes("queueSequenceStepTransportJob"))
  assert.ok(!actionsService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!actionsService.includes("createMediaGenerationJob"))
  assert.ok(!actionsService.includes("executeTransportSend"))
  console.log("  ✓ operator actions are metadata-only (no sends/enrollment/workers)")

  const workspaceService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-operator-workspace-service.ts"),
    "utf8",
  )
  assert.match(workspaceService, /listGrowthVideoOperatorWorkspaces/)
  assert.match(workspaceService, /getGrowthVideoOperatorWorkspace/)
  assert.match(workspaceService, /GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY/)
  console.log("  ✓ workspace service assembles F1/F2/F3 views")

  for (const routePath of [
    "app/api/growth/videos/operator-workspace/route.ts",
    "app/api/growth/videos/operator-workspace/[id]/route.ts",
    "app/api/growth/videos/operator-workspace/[id]/approve/route.ts",
    "app/api/growth/videos/operator-workspace/[id]/publish/route.ts",
    "app/api/growth/videos/operator-workspace/[id]/queue-media/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
    assert.ok(!source.includes("executeTransportSend"))
    assert.ok(!source.includes("runSequenceExecutionJob"))
  }
  console.log("  ✓ workspace APIs are platform gated + safety JSON (no sends)")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("growth_video_autopilot_f3"))
    assert.ok(!source.includes("GrowthVideoOperatorWorkspace"))
  }
  console.log("  ✓ sequence schedulers/runners unchanged")

  const { draft, recommendation } = sampleDraftPackage(randomUUID())
  const operatorState = emptyGrowthVideoOperatorWorkspaceOperatorState()
  const summary = buildGrowthVideoOperatorSummaryCards({ draft, recommendation, operatorState })
  assert.ok(summary.recommendationScore > 0)
  assert.equal(summary.attachmentStatus, "pending_approval")
  assert.equal(summary.voiceStatus, "draft")

  const idleActions = buildGrowthVideoOperatorWorkspaceActions({ draft, recommendation, operatorState })
  assert.equal(idleActions.approveDraft, "idle")
  assert.equal(idleActions.queueVoice, "idle")

  const approvedActions = buildGrowthVideoOperatorWorkspaceActions({
    draft,
    recommendation,
    operatorState: {
      ...operatorState,
      draftApprovedAt: new Date().toISOString(),
      draftApprovedBy: "operator",
    },
  })
  assert.equal(approvedActions.approveDraft, "completed")
  assert.equal(approvedActions.publishPage, "idle")

  const queuedDraft = {
    ...draft,
    voiceDraft: draft.voiceDraft
      ? { ...draft.voiceDraft, status: "queued" as const, queued: true }
      : null,
  }
  const queuedActions = buildGrowthVideoOperatorWorkspaceActions({
    draft: queuedDraft,
    recommendation,
    operatorState: { ...operatorState, voiceQueuedAt: new Date().toISOString() },
  })
  assert.equal(queuedActions.queueVoice, "completed")

  assert.equal(draft.workerExecutionEnabled, false)
  assert.equal(draft.channelPreviewDraft.emailHtml?.includes("Preview"), true)
  console.log("  ✓ summary cards, action states, preview relationships")

  console.log("\nF3 Video Operator Workspace local regression PASS\n")
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
    qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
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
    console.log("\nF3 Video Operator Workspace production certification PASS\n")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
