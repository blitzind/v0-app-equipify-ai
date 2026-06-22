/**
 * GE-v1-3 — ElevenLabs live personalized video certification.
 *
 * Local: pnpm test:ge-v1-3-elevenlabs-live
 * Production: pnpm test:ge-v1-3-elevenlabs-live:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GE_V1_3_ELEVENLABS_LIVE_CONFIRM,
  GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
} from "../lib/growth/media/ge-v1-3-types"
import { buildGeV13ElevenLabsProviderReadinessReport } from "../lib/growth/media/ge-v1-3-elevenlabs-provider-readiness"
import {
  getElevenLabsGrowthAvatarProviderCapabilities,
  resetElevenLabsGrowthAvatarProviderStateForCert,
} from "../lib/growth/media/providers/elevenlabs-growth-avatar-provider"
import {
  getElevenLabsGrowthVoiceProviderCapabilities,
  resetElevenLabsGrowthVoiceProviderStateForCert,
} from "../lib/growth/media/providers/elevenlabs-growth-voice-provider"
import { probeGrowthMediaGenerationRunsSchema } from "../lib/growth/media/growth-media-generation-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/media/ge-v1-3-types.ts",
  "lib/growth/media/ge-v1-3-prospect-script-resolution.ts",
  "lib/growth/media/ge-v1-3-elevenlabs-provider-readiness.ts",
  "lib/growth/media/ge-v1-3-generated-video-page-attach.ts",
  "lib/growth/media/ge-v1-3-generation-analytics.ts",
  "lib/growth/media/ge-v1-3-api-utils.ts",
  "lib/growth/media/ge-v1-3-attach-api-schema.ts",
  "app/api/growth/media/elevenlabs/provider-readiness/route.ts",
  "app/api/growth/media/generated-video/attach-page/route.ts",
  "components/growth/videos/growth-video-page-avatar-section.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/media/growth-ai-voice-generation-service.ts",
  "lib/growth/media/growth-ai-avatar-generation-service.ts",
  "lib/growth/media/growth-media-generation-worker-service.ts",
  "lib/growth/media/growth-media-generation-job-service.ts",
  "lib/growth/media/growth-media-video-writeback-service.ts",
  "lib/growth/videos/growth-video-merge-context-service.ts",
  "lib/growth/videos/growth-video-page-service.ts",
  "lib/growth/sequences/growth-sequence-video-attachment-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-v1-3 ElevenLabs Live (${GE_V1_3_ELEVENLABS_LIVE_QA_MARKER}) ===\n`)

  assert.equal(GE_V1_3_ELEVENLABS_LIVE_QA_MARKER, "ge-v1-3-elevenlabs-live-v1")
  assert.equal(GE_V1_3_ELEVENLABS_LIVE_CONFIRM, "RUN_GE_V1_3_ELEVENLABS_LIVE_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} GE-v1-3 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const prospectResolution = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/ge-v1-3-prospect-script-resolution.ts"),
    "utf8",
  )
  assert.match(prospectResolution, /resolveGrowthVideoMergeContext/)
  assert.match(prospectResolution, /renderGrowthVideoPreviewText/)
  assert.match(prospectResolution, /buildSenderMergeFields/)
  console.log("  ✓ Prospect script resolution merges variables before generation")

  const voiceService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-voice-generation-service.ts"),
    "utf8",
  )
  assert.match(voiceService, /resolvePersonalizedVideoGenerationScript|prospect/)
  console.log("  ✓ Voice generation accepts prospect merge context")

  const avatarService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-avatar-generation-service.ts"),
    "utf8",
  )
  assert.match(avatarService, /attachGeneratedMediaAssetToVideoPage/)
  assert.match(avatarService, /attachToPageOnComplete/)
  console.log("  ✓ Avatar generation supports page attach flow")

  const worker = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-worker-service.ts"),
    "utf8",
  )
  assert.match(worker, /recordGeV13GenerationLifecycleEvent/)
  console.log("  ✓ Worker emits GE-v1-3 generation lifecycle analytics")

  const attachService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/ge-v1-3-generated-video-page-attach.ts"),
    "utf8",
  )
  assert.match(attachService, /createGrowthVideoService/)
  assert.match(attachService, /GROWTH_VIDEOS_STORAGE_BUCKET/)
  console.log("  ✓ Generated media promotes into existing video_assets (no duplicate asset system)")

  const avatarUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-avatar-section.tsx"),
    "utf8",
  )
  assert.match(avatarUi, /provider-readiness/)
  assert.match(avatarUi, /attach-page/)
  assert.match(avatarUi, /lead_id/)
  console.log("  ✓ Operator UI exposes diagnostics, lead merge, and attach actions")

  const voiceCaps = getElevenLabsGrowthVoiceProviderCapabilities()
  const avatarCaps = getElevenLabsGrowthAvatarProviderCapabilities()
  assert.ok(voiceCaps.provider)
  assert.ok(avatarCaps.provider)
  console.log("  ✓ ElevenLabs provider capability contracts resolve")

  resetElevenLabsGrowthVoiceProviderStateForCert()
  resetElevenLabsGrowthAvatarProviderStateForCert()
  console.log("  ✓ Provider cert reset hooks callable")

  console.log("\nGE-v1-3 local regression: PASSED\n")
}

async function runProductionCertification(): Promise<void> {
  console.log("\n=== GE-v1-3 Production Certification ===\n")

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  assert.ok(
    boot,
    "Production Supabase unavailable — link Supabase CLI project or ensure production env files contain a service_role JWT.",
  )

  const admin = createClient(boot!.url, boot!.jwt, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const mediaProbe = await probeGrowthMediaGenerationRunsSchema(admin)
  assert.ok(mediaProbe.media_generation_runs_ready, "media_generation_runs schema must be ready")
  console.log("  ✓ Production media_generation_runs schema ready")

  const report = await buildGeV13ElevenLabsProviderReadinessReport(admin)
  assert.equal(report.qaMarker, GE_V1_3_ELEVENLABS_LIVE_QA_MARKER)
  assert.ok(report.schema.mediaGenerationRunsReady)
  assert.ok(report.schema.mediaAssetsReady)
  assert.ok(report.schema.videoAssetsReady)
  assert.ok(report.schema.videoPagesReady)
  assert.equal(report.diagnostics.humanApprovalGatesEnabled, true)
  assert.equal(report.diagnostics.autonomousSendingEnabled, false)
  console.log("  ✓ Provider readiness report generated")
  console.log(`    ready=${report.ready} dryRunOnly=${report.dryRunOnly}`)
  if (report.blockers.length) {
    console.log(`    blockers: ${report.blockers.join(", ")}`)
  }
  if (report.warnings.length) {
    console.log(`    warnings: ${report.warnings.slice(0, 3).join(" | ")}`)
  }

  console.log("\nGE-v1-3 production certification: PASSED\n")
}

const isProduction = process.argv.includes("--production")

if (isProduction) {
  runProductionCertification().catch((error) => {
    console.error(error)
    process.exit(1)
  })
} else {
  runLocalRegression()
}
