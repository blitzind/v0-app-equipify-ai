/**
 * Growth Engine C2 — AI avatar generation certification.
 *
 * Local: pnpm test:growth-ai-avatar-generation
 * Production: pnpm test:growth-ai-avatar-generation:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_AI_AVATAR_DEFAULT_RESOLUTION,
  GROWTH_AI_AVATAR_GENERATION_CONFIRM,
  GROWTH_AI_AVATAR_GENERATION_QA_MARKER,
} from "../lib/growth/media/growth-ai-avatar-generation-types"
import {
  getElevenLabsGrowthAvatarProviderCapabilities,
  resetElevenLabsGrowthAvatarProviderStateForCert,
} from "../lib/growth/media/providers/elevenlabs-growth-avatar-provider"
import {
  getRetellGrowthAvatarProviderCapabilities,
  resetRetellGrowthAvatarProviderStateForCert,
} from "../lib/growth/media/providers/retell-growth-avatar-provider"
import { buildAvatarVideoStoragePath } from "../lib/growth/media/growth-media-video-writeback-service"
import { probeGrowthMediaGenerationRunsSchema } from "../lib/growth/media/growth-media-generation-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/media/growth-ai-avatar-generation-service.ts",
  "lib/growth/media/growth-ai-avatar-provider-config.ts",
  "lib/growth/media/providers/elevenlabs-growth-avatar-provider.ts",
  "lib/growth/media/providers/retell-growth-avatar-provider.ts",
  "lib/growth/media/growth-media-video-writeback-service.ts",
  "app/api/growth/media/avatar/generate/route.ts",
  "app/api/growth/media/avatar/jobs/[id]/route.ts",
  "app/api/growth/media/avatar/jobs/[id]/retry/route.ts",
  "app/api/growth/media/avatar/jobs/[id]/cancel/route.ts",
  "components/growth/videos/growth-video-page-avatar-section.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/media/growth-media-generation-job-service.ts",
  "lib/growth/media/growth-media-generation-worker-service.ts",
  "lib/growth/media/growth-media-provider-contracts.ts",
  "lib/growth/media/growth-ai-voice-generation-service.ts",
  "lib/growth/media/media-asset-repository.ts",
  "lib/growth/videos/growth-video-script-generation-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== C2 AI avatar generation (${GROWTH_AI_AVATAR_GENERATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AI_AVATAR_GENERATION_QA_MARKER, "growth-ai-avatar-generation-c2-v1")
  assert.equal(GROWTH_AI_AVATAR_GENERATION_CONFIRM, "RUN_GROWTH_AI_AVATAR_GENERATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} C2 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const avatarService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-avatar-generation-service.ts"),
    "utf8",
  )
  assert.match(avatarService, /createMediaGenerationJob/)
  assert.match(avatarService, /processAvatarGenerationRun/)
  assert.match(avatarService, /resolveVideoPageVoiceScript/)
  assert.ok(!avatarService.includes("runSequenceExecutionJob"))
  assert.ok(!avatarService.includes("queueSequenceStepTransportJob"))
  console.log("  ✓ avatar service reuses C3 jobs + B4 scripts + C1 voice assets (no automation triggers)")

  const worker = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-worker-service.ts"),
    "utf8",
  )
  assert.match(worker, /processAvatarGenerationRun/)
  assert.match(worker, /writebackGeneratedAvatarVideoAsset/)
  assert.match(worker, /cancelAvatarGenerationRun/)
  console.log("  ✓ worker service includes avatar progress + video writeback")

  const elevenlabsProvider = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/elevenlabs-growth-avatar-provider.ts"),
    "utf8",
  )
  assert.match(elevenlabsProvider, /generateAvatarVideo/)
  assert.match(elevenlabsProvider, /getGenerationStatus/)
  assert.match(elevenlabsProvider, /cancelGeneration/)
  assert.match(elevenlabsProvider, /isGrowthElevenLabsAvatarEnabled/)

  const retellProvider = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/retell-growth-avatar-provider.ts"),
    "utf8",
  )
  assert.match(retellProvider, /generateAvatarVideo/)
  assert.match(retellProvider, /isGrowthRetellAvatarEnabled/)

  const providerConfig = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-avatar-provider-config.ts"),
    "utf8",
  )
  assert.match(providerConfig, /GROWTH_ELEVENLABS_AVATAR_ENABLED/)
  assert.match(providerConfig, /GROWTH_RETELL_AVATAR_ENABLED/)
  assert.match(providerConfig, /RETELL_API_KEY/)
  console.log("  ✓ avatar providers implement C3 contract + dual env gates")

  const writeback = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-video-writeback-service.ts"),
    "utf8",
  )
  assert.match(writeback, /createMediaAsset/)
  assert.match(writeback, /generated_avatar_video|GROWTH_AI_AVATAR_MEDIA_SUBTYPE/)
  assert.match(writeback, /organizations\//)
  console.log("  ✓ video writeback creates media assets with avatar metadata")

  const contracts = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-provider-contracts.ts"),
    "utf8",
  )
  assert.match(contracts, /generateAvatarVideo/)
  assert.match(contracts, /AIAvatarProviderJobStatus/)
  console.log("  ✓ AIAvatarProvider contract expanded for C2")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Avatar/)
  assert.match(detailPanel, /GrowthVideoPageAvatarSection/)
  console.log("  ✓ page detail panel includes Avatar tab")

  for (const routePath of [
    "app/api/growth/media/avatar/generate/route.ts",
    "app/api/growth/media/avatar/jobs/[id]/route.ts",
    "app/api/growth/media/avatar/jobs/[id]/retry/route.ts",
    "app/api/growth/media/avatar/jobs/[id]/cancel/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthMediaGenerationPlatformAccess/)
    assert.match(source, /growthAiAvatarSafetyJson/)
  }
  console.log("  ✓ avatar API routes use platform access + safety payloads")

  resetElevenLabsGrowthAvatarProviderStateForCert()
  resetRetellGrowthAvatarProviderStateForCert()
  const elevenlabsCaps = getElevenLabsGrowthAvatarProviderCapabilities()
  const retellCaps = getRetellGrowthAvatarProviderCapabilities()
  assert.equal(elevenlabsCaps.requires_human_review, true)
  assert.equal(retellCaps.autonomous_execution_enabled, false)
  console.log("  ✓ provider capabilities include human-review safety flags")

  const storagePath = buildAvatarVideoStoragePath({
    organizationId: "00000000-0000-4000-8000-000000000002",
    runId: "00000000-0000-4000-8000-000000000001",
  })
  assert.match(storagePath, /organizations\/.*\/media\/avatar\/.*\/avatar\.mp4/)
  console.log("  ✓ avatar video storage path helper")

  assert.equal(GROWTH_AI_AVATAR_DEFAULT_RESOLUTION, "1280x720")
  console.log("  ✓ default resolution")

  console.log("\nC2 AI avatar generation local regression PASS\n")
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

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const schema = await probeGrowthMediaGenerationRunsSchema(admin)
  const elevenlabs = getElevenLabsGrowthAvatarProviderCapabilities()
  const retell = getRetellGrowthAvatarProviderCapabilities()

  return {
    ok: schema.media_generation_runs_ready,
    qa_marker: GROWTH_AI_AVATAR_GENERATION_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    media_generation_runs_ready: schema.media_generation_runs_ready,
    elevenlabs_provider_enabled: elevenlabs.enabled,
    elevenlabs_dry_run_only: elevenlabs.dryRunOnly,
    retell_provider_enabled: retell.enabled,
    retell_dry_run_only: retell.dryRunOnly,
    blockers: [
      !schema.media_generation_runs_ready ? "media_generation_runs_schema_not_ready" : null,
    ].filter(Boolean),
    production_deploy_required: [
      "C2 avatar APIs + Avatar tab require Vercel Production deploy",
      "Live ElevenLabs avatar generation requires GROWTH_ELEVENLABS_AVATAR_ENABLED=true and ELEVENLABS_API_KEY on Production",
      "Live Retell avatar generation requires GROWTH_RETELL_AVATAR_ENABLED=true and RETELL_API_KEY on Production",
    ],
    final_verdict: schema.media_generation_runs_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nC2 AI avatar generation production certification PASS\n")
  }
}

void main()
