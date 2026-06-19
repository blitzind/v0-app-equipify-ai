/**
 * Growth Engine C1 — AI voice generation certification.
 *
 * Local: pnpm test:growth-ai-voice-generation
 * Production: pnpm test:growth-ai-voice-generation:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_AI_VOICE_GENERATION_CONFIRM,
  GROWTH_AI_VOICE_GENERATION_QA_MARKER,
  GROWTH_AI_VOICE_DEFAULT_SETTINGS,
} from "../lib/growth/media/growth-ai-voice-generation-types"
import {
  getElevenLabsGrowthVoiceProviderCapabilities,
  resetElevenLabsGrowthVoiceProviderStateForCert,
} from "../lib/growth/media/providers/elevenlabs-growth-voice-provider"
import { buildVoiceoverStoragePath } from "../lib/growth/media/growth-media-audio-writeback-service"
import { probeGrowthMediaGenerationRunsSchema } from "../lib/growth/media/growth-media-generation-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/media/growth-ai-voice-generation-service.ts",
  "lib/growth/media/growth-ai-voice-provider-config.ts",
  "lib/growth/media/providers/elevenlabs-growth-voice-provider.ts",
  "lib/growth/media/growth-media-generation-worker-service.ts",
  "lib/growth/media/growth-media-audio-writeback-service.ts",
  "app/api/growth/media/voice/generate/route.ts",
  "app/api/growth/media/voice/jobs/[id]/route.ts",
  "app/api/growth/media/voice/jobs/[id]/retry/route.ts",
  "app/api/growth/media/voice/jobs/[id]/cancel/route.ts",
  "components/growth/videos/growth-video-page-voice-section.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/media/growth-media-generation-job-service.ts",
  "lib/growth/media/growth-media-provider-contracts.ts",
  "lib/growth/media/providers/elevenlabs-voice-provider.ts",
  "lib/growth/media/media-asset-repository.ts",
  "lib/growth/videos/growth-video-script-generation-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== C1 AI voice generation (${GROWTH_AI_VOICE_GENERATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AI_VOICE_GENERATION_QA_MARKER, "growth-ai-voice-generation-c1-v1")
  assert.equal(GROWTH_AI_VOICE_GENERATION_CONFIRM, "RUN_GROWTH_AI_VOICE_GENERATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} C1 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const voiceService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-voice-generation-service.ts"),
    "utf8",
  )
  assert.match(voiceService, /createMediaGenerationJob/)
  assert.match(voiceService, /processVoiceGenerationRun/)
  assert.match(voiceService, /resolveVideoPageVoiceScript/)
  assert.ok(!voiceService.includes("runSequenceExecutionJob"))
  assert.ok(!voiceService.includes("queueSequenceStepTransportJob"))
  console.log("  ✓ voice service reuses C3 jobs + B4 scripts (no sequence/automation triggers)")

  const provider = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/elevenlabs-growth-voice-provider.ts"),
    "utf8",
  )
  assert.match(provider, /implements AIVoiceProvider|class ElevenLabsGrowthVoiceProvider/)
  assert.match(provider, /generateVoice/)
  assert.match(provider, /getGenerationStatus/)
  assert.match(provider, /cancelGeneration/)
  assert.match(provider, /isGrowthElevenLabsVoiceEnabled/)
  const providerConfig = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-ai-voice-provider-config.ts"),
    "utf8",
  )
  assert.match(providerConfig, /GROWTH_ELEVENLABS_VOICE_ENABLED/)
  assert.match(providerConfig, /ELEVENLABS_API_KEY/)
  console.log("  ✓ ElevenLabs growth provider implements C3 contract + env gate")

  const worker = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-worker-service.ts"),
    "utf8",
  )
  assert.match(worker, /writebackGeneratedAudioAsset/)
  assert.match(worker, /recordMediaGenerationProgress/)
  console.log("  ✓ worker service updates progress + audio writeback")

  const writeback = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-audio-writeback-service.ts"),
    "utf8",
  )
  assert.match(writeback, /createMediaAsset/)
  assert.match(writeback, /voiceover_audio|GROWTH_AI_VOICE_MEDIA_SUBTYPE/)
  assert.match(writeback, /organizations\//)
  console.log("  ✓ audio writeback creates media assets with voiceover metadata")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Voice/)
  assert.match(detailPanel, /GrowthVideoPageVoiceSection/)
  console.log("  ✓ page detail panel includes Voice tab")

  for (const routePath of [
    "app/api/growth/media/voice/generate/route.ts",
    "app/api/growth/media/voice/jobs/[id]/route.ts",
    "app/api/growth/media/voice/jobs/[id]/retry/route.ts",
    "app/api/growth/media/voice/jobs/[id]/cancel/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthMediaGenerationPlatformAccess/)
    assert.match(source, /growthAiVoiceSafetyJson/)
  }
  console.log("  ✓ voice API routes use platform access + safety payloads")

  resetElevenLabsGrowthVoiceProviderStateForCert()
  const capabilities = getElevenLabsGrowthVoiceProviderCapabilities()
  assert.equal(capabilities.requires_human_review, true)
  assert.equal(capabilities.autonomous_execution_enabled, false)
  console.log("  ✓ provider capabilities include human-review safety flags")

  const storagePath = buildVoiceoverStoragePath({
    organizationId: "00000000-0000-4000-8000-000000000002",
    runId: "00000000-0000-4000-8000-000000000001",
  })
  assert.match(storagePath, /organizations\/.*\/media\/voice\/.*\/voiceover\.mp3/)
  console.log("  ✓ voiceover storage path helper")

  assert.equal(GROWTH_AI_VOICE_DEFAULT_SETTINGS.stability, 0.5)
  assert.equal(GROWTH_AI_VOICE_DEFAULT_SETTINGS.similarity, 0.75)
  assert.equal(GROWTH_AI_VOICE_DEFAULT_SETTINGS.speed, 1.0)
  console.log("  ✓ default voice settings")

  console.log("\nC1 AI voice generation local regression PASS\n")
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
  const providerState = getElevenLabsGrowthVoiceProviderCapabilities()

  return {
    ok: schema.media_generation_runs_ready,
    qa_marker: GROWTH_AI_VOICE_GENERATION_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    media_generation_runs_ready: schema.media_generation_runs_ready,
    provider_enabled: providerState.enabled,
    provider_dry_run_only: providerState.dryRunOnly,
    blockers: [
      !schema.media_generation_runs_ready ? "media_generation_runs_schema_not_ready" : null,
    ].filter(Boolean),
    production_deploy_required: [
      "C1 voice APIs + Voice tab require Vercel Production deploy",
      "Live ElevenLabs generation requires GROWTH_ELEVENLABS_VOICE_ENABLED=true and ELEVENLABS_API_KEY on Production",
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
    console.log("\nC1 AI voice generation production certification PASS\n")
  }
}

void main()
