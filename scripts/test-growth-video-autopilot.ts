/**
 * Growth Engine F1 — Video Autopilot recommendation certification.
 *
 * Local: pnpm test:growth-video-autopilot
 * Production: pnpm test:growth-video-autopilot:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
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
  GROWTH_VIDEO_AUTOPILOT_CONFIRM,
  GROWTH_VIDEO_AUTOPILOT_METADATA_KEY,
  GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
} from "../lib/growth/videos/growth-video-autopilot-types"
import { buildGrowthVideoAutopilotPreviewBundle } from "../lib/growth/videos/growth-video-autopilot-preview-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-autopilot-types.ts",
  "lib/growth/videos/growth-video-autopilot-service.ts",
  "lib/growth/videos/growth-video-autopilot-prompt-service.ts",
  "lib/growth/videos/growth-video-autopilot-recommendation-service.ts",
  "lib/growth/videos/growth-video-autopilot-score-service.ts",
  "lib/growth/videos/growth-video-autopilot-preview-service.ts",
  "app/api/growth/videos/autopilot/recommendations/route.ts",
  "app/api/growth/videos/autopilot/recommendations/[id]/route.ts",
  "app/api/growth/videos/autopilot/generate-preview/route.ts",
  "components/growth/videos/growth-video-autopilot-panel.tsx",
  "components/growth/videos/growth-video-autopilot-preview.tsx",
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

function runLocalRegression(): void {
  console.log(`\n=== F1 Video Autopilot (${GROWTH_VIDEO_AUTOPILOT_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_AUTOPILOT_QA_MARKER, "growth-video-autopilot-f1-v1")
  assert.equal(GROWTH_VIDEO_AUTOPILOT_CONFIRM, "RUN_GROWTH_VIDEO_AUTOPILOT_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_AUTOPILOT_METADATA_KEY, "growth_video_autopilot_f1")
  console.log("  ✓ QA marker, confirm token, metadata key")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} F1 module files exist`)

  const service = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-autopilot-service.ts"),
    "utf8",
  )
  assert.match(service, /buildGrowthVideoAutopilotInputSnapshot/)
  assert.match(service, /generateGrowthVideoAutopilotRecommendation/)
  assert.match(service, /reviewGrowthVideoAutopilotRecommendation/)
  assert.match(service, /runAiTask/)
  assert.match(service, /growth_video_script_generation/)
  assert.ok(!service.includes("runSequenceExecutionJob"))
  assert.ok(!service.includes("queueSequenceStepTransportJob"))
  assert.ok(!service.includes("insertGrowthSequenceEnrollment"))
  console.log("  ✓ autopilot service generates recommendations only (no execution)")

  const recommendationService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-autopilot-recommendation-service.ts"),
    "utf8",
  )
  assert.match(recommendationService, /lead\.metadata/)
  assert.match(recommendationService, /updateGrowthVideoAutopilotRecommendationStatus/)
  assert.match(recommendationService, /"draft"/)
  assert.match(recommendationService, /"approved"/)
  assert.match(recommendationService, /"dismissed"/)
  console.log("  ✓ recommendation metadata supports draft/approved/dismissed")

  for (const routePath of [
    "app/api/growth/videos/autopilot/recommendations/route.ts",
    "app/api/growth/videos/autopilot/recommendations/[id]/route.ts",
    "app/api/growth/videos/autopilot/generate-preview/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
    assert.ok(!source.includes("executeTransportSend"))
    assert.ok(!source.includes("runSequenceExecutionJob"))
  }
  console.log("  ✓ autopilot APIs are platform gated + safety JSON (no sends)")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("generateGrowthVideoAutopilotRecommendation"))
    assert.ok(!source.includes("growth_video_autopilot_f1"))
  }
  console.log("  ✓ sequence schedulers/runners unchanged")

  const snapshot = sampleSnapshot()
  const scores = scoreGrowthVideoAutopilotOpportunity(snapshot)
  assert.ok(scores.videoOpportunityScore >= 40)
  assert.ok(scores.personalizationScore >= 40)
  assert.ok(scores.reasons.includes("high_fit"))
  assert.ok(shouldRecommendGrowthVideoSend(scores))

  const videoType = deriveGrowthVideoAutopilotVideoType({ snapshot, reasons: scores.reasons })
  const channel = deriveGrowthVideoAutopilotChannel({ scores, snapshot })
  const recommended = buildDeterministicGrowthVideoAutopilotRecommendation({
    snapshot,
    scores,
    videoType,
    shouldSendVideo: true,
    channel,
  })
  assert.ok(recommended.script?.includes("Alex"))
  assert.ok(recommended.thumbnailText)

  const preview = buildGrowthVideoAutopilotPreviewBundle({
    recommendation: {
      id: "00000000-0000-4000-8000-000000000010",
      leadId: snapshot.leadId,
      organizationId: "00000000-0000-4000-8000-000000000002",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      dismissedAt: null,
      dismissedBy: null,
      shouldSendVideo: true,
      videoType,
      scores,
      recommended,
      inputSnapshot: snapshot,
      aiPayload: null,
      sourcesUsed: snapshot.sourcesUsed,
      requiresHumanReview: true,
      autonomousExecutionEnabled: false,
      outreachExecution: false,
      enrollmentExecution: false,
    },
  })
  assert.ok(preview.scriptPreview)
  assert.ok(preview.thumbnailPreviewDataUrl?.startsWith("data:image/svg+xml"))
  assert.ok(preview.channelPreview.emailHtml || preview.channelPreview.smsText)
  console.log("  ✓ scoring, recommendation, and preview generation")

  console.log("\nF1 Video Autopilot local regression PASS\n")
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
    qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
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
    final_verdict: schema.ready && schema.pages_schema_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nF1 Video Autopilot production certification PASS\n")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
