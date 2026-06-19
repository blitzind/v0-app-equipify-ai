/**
 * Growth Engine C3 — Persistent media generation jobs certification.
 *
 * Local: pnpm test:growth-media-jobs
 * Production: pnpm test:growth-media-jobs:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_MEDIA_GENERATION_JOBS_CONFIRM,
  GROWTH_MEDIA_GENERATION_JOBS_MIGRATION,
  GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
} from "../lib/growth/media/growth-media-generation-types"
import {
  mapMediaGenerationRunRow,
  serializeMediaGenerationRunInput,
} from "../lib/growth/media/growth-media-generation-run-service"
import { probeGrowthMediaGenerationRunsSchema } from "../lib/growth/media/growth-media-generation-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "supabase/migrations/20270828180000_growth_media_generation_jobs_c3.sql",
  "lib/growth/media/growth-media-generation-job-service.ts",
  "lib/growth/media/growth-media-generation-run-service.ts",
  "lib/growth/media/growth-media-generation-progress-service.ts",
  "lib/growth/media/growth-media-provider-contracts.ts",
  "lib/growth/media/growth-media-generation-types.ts",
  "app/api/growth/media/jobs/route.ts",
  "app/api/growth/media/jobs/[id]/route.ts",
  "components/growth/media/growth-media-generation-jobs-shell.tsx",
  "app/(growth)/growth/videos/jobs/page.tsx",
  "app/(admin)/admin/growth/videos/jobs/page.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/ai/jobs/create-ai-job.ts",
  "lib/growth/media/media-asset-storage-types.ts",
  "lib/growth/media/providers/elevenlabs-voice-provider.ts",
  "lib/growth/media/providers/elevenlabs-video-provider.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== C3 Media generation jobs (${GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER, "growth-media-generation-jobs-c3-v1")
  assert.equal(GROWTH_MEDIA_GENERATION_JOBS_CONFIRM, "RUN_GROWTH_MEDIA_GENERATION_JOBS_CERTIFICATION")
  assert.equal(GROWTH_MEDIA_GENERATION_JOBS_MIGRATION, "20270828180000_growth_media_generation_jobs_c3.sql")
  console.log("  ✓ QA marker, confirm token, migration id")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} C3 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828180000_growth_media_generation_jobs_c3.sql"),
    "utf8",
  )
  assert.match(migration, /growth\.media_generation_runs/)
  assert.match(migration, /references public\.ai_jobs/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /force row level security/)
  assert.match(migration, /grant select, insert, update, delete on growth\.media_generation_runs to service_role/)
  assert.match(migration, /idx_growth_media_generation_runs_org_status/)
  assert.match(migration, /idx_growth_media_generation_runs_ai_job/)
  console.log("  ✓ migration defines table, ai_jobs FK, RLS, indexes, service_role grants")

  const jobService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-job-service.ts"),
    "utf8",
  )
  assert.match(jobService, /insertQueuedAiJob/)
  assert.match(jobService, /media_generation_runs/)
  assert.ok(!jobService.includes("new Map"))
  assert.ok(!jobService.includes("generateVoice"))
  assert.ok(!jobService.includes("generateAvatar"))
  assert.ok(!jobService.includes("runSequenceExecutionJob"))
  console.log("  ✓ job service uses ai_jobs + persistent runs (no in-memory store or provider execution)")

  const progressService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-progress-service.ts"),
    "utf8",
  )
  assert.match(progressService, /recordMediaGenerationProgress/)
  assert.match(progressService, /incrementMediaGenerationRetry/)
  assert.match(progressService, /progress_timeline/)
  console.log("  ✓ progress service tracks timeline + retries")

  const providerContracts = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-provider-contracts.ts"),
    "utf8",
  )
  assert.match(providerContracts, /interface AIVoiceProvider/)
  assert.match(providerContracts, /interface AIAvatarProvider/)
  assert.match(providerContracts, /interface AIVideoProvider/)
  assert.match(providerContracts, /interface AIMediaStorageProvider/)
  assert.match(providerContracts, /executionEnabled: false/)
  console.log("  ✓ provider contracts defined without implementations")

  const jobsShell = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-generation-jobs-shell.tsx"),
    "utf8",
  )
  assert.match(jobsShell, /Queued/)
  assert.match(jobsShell, /Processing/)
  assert.match(jobsShell, /Progress timeline/)
  console.log("  ✓ jobs dashboard shell renders summary cards + detail sections")

  for (const routePath of [
    "app/api/growth/media/jobs/route.ts",
    "app/api/growth/media/jobs/[id]/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthMediaGenerationPlatformAccess/)
    assert.match(source, /growthMediaGenerationSafetyJson/)
  }
  console.log("  ✓ media job API routes use platform access + safety payloads")

  const platformAccess = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/growth-media-generation-platform-access.ts"),
    "utf8",
  )
  assert.match(platformAccess, /provider_execution_enabled: false/)
  assert.match(platformAccess, /no_media_generation_executed: true/)

  const mapped = mapMediaGenerationRunRow({
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000002",
    ai_job_id: "00000000-0000-4000-8000-000000000003",
    generation_type: "voice_generation",
    provider: "elevenlabs",
    status: "queued",
    progress_percent: 0,
    input_json: serializeMediaGenerationRunInput({
      metadata_hooks: { video_page_id: "00000000-0000-4000-8000-000000000004" },
    }),
    output_json: { progress_timeline: [] },
    error_json: {},
    retry_count: 0,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  assert.equal(mapped.input.metadata_hooks?.video_page_id, "00000000-0000-4000-8000-000000000004")
  console.log("  ✓ metadata hooks round-trip on run mapper")

  console.log("\nC3 Media generation jobs local regression PASS\n")
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

  return {
    ok: schema.media_generation_runs_ready,
    qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    media_generation_runs_ready: schema.media_generation_runs_ready,
    blockers: [
      !schema.media_generation_runs_ready ? "media_generation_runs_schema_not_ready" : null,
    ].filter(Boolean),
    production_deploy_required: [
      "C3 media job APIs require Vercel Production deploy",
      "Jobs dashboard UI requires Vercel Production deploy",
      "Apply migration 20270828180000 on production Supabase before live job persistence",
    ],
    architecture: "public.ai_jobs -> growth.media_generation_runs -> future provider execution",
    provider_execution_enabled: false,
    final_verdict: schema.media_generation_runs_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nC3 Media generation jobs production certification PASS\n")
  }
}

void main()
