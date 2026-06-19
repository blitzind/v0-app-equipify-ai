/**
 * Growth Engine B4 — Video script generation bridge certification.
 *
 * Local: pnpm test:growth-video-scripts
 * Production: pnpm test:growth-video-scripts:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_SCRIPTS_CONFIRM,
  GROWTH_VIDEO_SCRIPTS_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoScriptPreviewPrompt,
  growthVideoScriptModelSchema,
  normalizeGrowthVideoScriptGenerationInput,
} from "../lib/growth/videos/growth-video-script-prompt-service"
import {
  buildDeterministicGrowthVideoScript,
  previewGrowthVideoScriptContext,
} from "../lib/growth/videos/growth-video-script-preview-service"
import {
  appendGrowthVideoScriptVersion,
  emptyGrowthVideoScriptMetadata,
  GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY,
  parseGrowthVideoScriptMetadata,
} from "../lib/growth/videos/growth-video-script-version-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-script-generation-service.ts",
  "lib/growth/videos/growth-video-script-prompt-service.ts",
  "lib/growth/videos/growth-video-script-preview-service.ts",
  "lib/growth/videos/growth-video-script-version-service.ts",
  "app/api/growth/videos/scripts/generate/route.ts",
  "app/api/growth/videos/scripts/preview/route.ts",
  "app/api/growth/videos/pages/[id]/scripts/route.ts",
  "components/growth/videos/growth-video-page-script-section.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/ai/tasks.ts",
  "lib/ai/server.ts",
  "lib/growth/ai-copilot-provider.ts",
  "lib/growth/videos/growth-video-merge-context-service.ts",
  "lib/growth/videos/growth-video-personalization-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== B4 Video scripts (${GROWTH_VIDEO_SCRIPTS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_SCRIPTS_QA_MARKER, "growth-video-scripts-b4-v1")
  assert.equal(GROWTH_VIDEO_SCRIPTS_CONFIRM, "RUN_GROWTH_VIDEO_SCRIPTS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} B4 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const aiTasks = fs.readFileSync(path.join(process.cwd(), "lib/ai/tasks.ts"), "utf8")
  const aiTypes = fs.readFileSync(path.join(process.cwd(), "lib/ai/types.ts"), "utf8")
  assert.match(aiTasks, /growth_video_script_generation/)
  assert.match(aiTypes, /growth_video_script_generation/)
  console.log("  ✓ growth_video_script_generation registered in AI task registry")

  const generationService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-script-generation-service.ts"),
    "utf8",
  )
  assert.match(generationService, /resolveGrowthVideoMergeContext/)
  assert.match(generationService, /runAiTask/)
  assert.match(generationService, /growth_video_script_generation/)
  assert.match(generationService, /GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY/)
  assert.ok(!generationService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!generationService.includes("runSequenceExecutionJob"))
  assert.ok(!generationService.includes("queueSequenceStepTransportJob"))
  console.log("  ✓ generation service reuses B1 merge + AI router (no sequence/automation triggers)")

  const promptService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-script-prompt-service.ts"),
    "utf8",
  )
  assert.match(promptService, /growthVideoScriptModelSchema/)
  assert.ok(!promptService.includes("runAiTask"))
  console.log("  ✓ prompt service defines structured model schema")

  const previewService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-script-preview-service.ts"),
    "utf8",
  )
  assert.match(previewService, /buildDeterministicGrowthVideoScript/)
  assert.match(previewService, /requires_human_review: true/)
  console.log("  ✓ preview service provides deterministic fallback + human review flags")

  const versionService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-script-version-service.ts"),
    "utf8",
  )
  assert.match(versionService, /GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY/)
  console.log("  ✓ version service persists in metadata_json")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Scripts/)
  assert.match(detailPanel, /GrowthVideoPageScriptSection/)
  console.log("  ✓ page detail panel includes Scripts tab")

  for (const routePath of [
    "app/api/growth/videos/scripts/generate/route.ts",
    "app/api/growth/videos/scripts/preview/route.ts",
    "app/api/growth/videos/pages/[id]/scripts/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ script API routes use platform access + safety payloads")

  const input = normalizeGrowthVideoScriptGenerationInput({
    goal: "Book demo",
    targetPersona: "HVAC owner",
    painPoint: "missed jobs and manual follow-up",
    offer: "Equipify",
    cta: "Schedule a demo",
    lengthSeconds: 45,
  })

  const fallback = buildDeterministicGrowthVideoScript({
    generationInput: input,
    mergeVariables: {
      first_name: "John",
      company: "Precision Biomedical",
      industry: "Medical Equipment",
    },
    sourcesUsed: ["preview_form"],
  })
  assert.ok(fallback.script.length > 20)
  assert.equal(fallback.talking_points.length, 3)
  assert.equal(fallback.requires_human_review, true)
  assert.equal(fallback.autonomous_execution_enabled, false)
  assert.match(fallback.recommended_thumbnail_text, /John/)
  console.log("  ✓ deterministic fallback script generation")

  const preview = previewGrowthVideoScriptContext({
    generationInput: input,
    mergeVariables: { first_name: "John", company: "Acme HVAC" },
    sourcesUsed: ["preview_form"],
  })
  assert.ok(preview.aiPayload.generated_script)
  assert.equal(preview.aiPayload.requires_human_review, true)
  console.log("  ✓ preview context + AI payload")

  const promptPreview = buildGrowthVideoScriptPreviewPrompt({
    generationInput: input,
    previewContext: preview.previewContext,
  })
  assert.match(promptPreview, /Book demo/)
  console.log("  ✓ prompt preview builder")

  growthVideoScriptModelSchema.parse({
    script: fallback.script,
    hook: fallback.hook,
    talking_points: fallback.talking_points,
    cta_copy: fallback.cta_copy,
    landing_page_title: fallback.landing_page_title,
    landing_page_description: fallback.landing_page_description,
    follow_up_email: fallback.follow_up_email,
    follow_up_sms: fallback.follow_up_sms,
  })
  console.log("  ✓ model schema accepts generated output shape")

  const stored = appendGrowthVideoScriptVersion({
    existing: emptyGrowthVideoScriptMetadata(),
    generationInput: input,
    output: fallback,
    aiPayload: preview.aiPayload,
    provider: "deterministic_fallback",
  })
  const parsed = parseGrowthVideoScriptMetadata({
    [GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY]: stored,
  })
  assert.equal(parsed.versions.length, 1)
  assert.ok(parsed.current_version_id)
  console.log("  ✓ script version metadata round-trip")

  console.log("\nB4 Video scripts local regression PASS\n")
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
  const schema = await probeGrowthVideoFoundationSchema(admin)

  return {
    ok: schema.pages_schema_ready,
    qa_marker: GROWTH_VIDEO_SCRIPTS_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    pages_schema_ready: schema.pages_schema_ready,
    blockers: [!schema.pages_schema_ready ? "pages_schema_not_ready" : null].filter(Boolean),
    production_deploy_required: [
      "B4 script APIs require Vercel Production deploy",
      "Scripts tab UI requires Vercel Production deploy",
    ],
    ai_task: "growth_video_script_generation",
    metadata_key: GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY,
    final_verdict: schema.pages_schema_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nB4 Video scripts production certification PASS\n")
  }
}

void main()
