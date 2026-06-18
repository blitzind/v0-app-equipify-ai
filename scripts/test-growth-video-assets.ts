/**
 * Growth Engine A2 — Video assets upload certification.
 *
 * Local: pnpm test:growth-video-assets
 * Production: pnpm test:growth-video-assets:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_ASSETS_CONFIRM,
  GROWTH_VIDEO_ASSETS_QA_MARKER,
  GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION,
  GROWTH_VIDEOS_STORAGE_BUCKET,
  GROWTH_VIDEO_MAX_UPLOAD_BYTES,
} from "../lib/growth/videos/growth-video-types"
import {
  assertGrowthVideoFileSize,
  assertGrowthVideoMimeType,
  buildGrowthVideoSourceStoragePath,
  sanitizeGrowthVideoFilename,
} from "../lib/growth/videos/growth-video-validation"
import { growthVideoUploadSafetyPayload } from "../lib/growth/videos/growth-video-upload-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"
import { isGrowthVideoWorkspaceEnabled } from "../lib/growth/videos/growth-video-route-gates"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "supabase/migrations/20270828140000_growth_engine_video_assets_upload_a2.sql",
  "lib/growth/videos/growth-video-validation.ts",
  "lib/growth/videos/growth-video-upload-service.ts",
  "lib/growth/videos/growth-video-platform-access.ts",
  "lib/growth/videos/growth-video-api-schema.ts",
  "lib/growth/videos/providers/supabase-video-storage-provider.ts",
  "lib/growth/videos/growth-video-storage-factory.ts",
  "app/api/growth/videos/assets/route.ts",
  "app/api/growth/videos/assets/[id]/route.ts",
  "app/api/growth/videos/assets/[id]/upload-url/route.ts",
  "app/api/growth/videos/assets/[id]/complete-upload/route.ts",
  "components/growth/videos/growth-video-library-panel.tsx",
  "components/growth/videos/growth-video-upload-modal.tsx",
  "components/growth/videos/growth-video-asset-detail-panel.tsx",
  "app/(growth)/growth/videos/library/[id]/page.tsx",
] as const

const API_ROUTES = [
  "app/api/growth/videos/assets/route.ts",
  "app/api/growth/videos/assets/[id]/route.ts",
  "app/api/growth/videos/assets/[id]/upload-url/route.ts",
  "app/api/growth/videos/assets/[id]/complete-upload/route.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== A2 Video assets (${GROWTH_VIDEO_ASSETS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_ASSETS_QA_MARKER, "growth-video-assets-a2-v1")
  assert.equal(GROWTH_VIDEO_ASSETS_CONFIRM, "RUN_GROWTH_VIDEO_ASSETS_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION, "20270828140000_growth_engine_video_assets_upload_a2.sql")
  console.log("  ✓ QA marker and migration constant")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} A2 module files exist`)

  for (const routePath of API_ROUTES) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ API routes use platform access + safety payloads")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828140000_growth_engine_video_assets_upload_a2.sql"),
    "utf8",
  )
  assert.ok(migration.includes("upload_status"))
  assert.ok(migration.includes("'growth-videos'"))
  assert.ok(migration.includes("262144000"))
  console.log("  ✓ upload migration defines bucket and size limit")

  assert.equal(assertGrowthVideoMimeType("video/mp4"), "video/mp4")
  assert.throws(() => assertGrowthVideoMimeType("video/avi"))
  assert.equal(assertGrowthVideoFileSize(1024), 1024)
  assert.throws(() => assertGrowthVideoFileSize(GROWTH_VIDEO_MAX_UPLOAD_BYTES + 1))
  const pathSample = buildGrowthVideoSourceStoragePath({
    organizationId: "org-1",
    assetId: "asset-1",
    extension: "mp4",
  })
  assert.equal(pathSample, "organizations/org-1/videos/asset-1/source.mp4")
  assert.equal(sanitizeGrowthVideoFilename("../evil.mp4"), "evil.mp4")
  console.log("  ✓ validation helpers")

  const safety = growthVideoUploadSafetyPayload()
  assert.equal(safety.requires_human_review, true)
  assert.equal(safety.outreach_execution, false)
  console.log("  ✓ upload safety invariants")

  const mediaMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827120700_growth_media_assets_s1_5.sql"),
    "utf8",
  )
  assert.ok(mediaMigration.includes("growth-media-assets"))
  assert.ok(!mediaMigration.includes("growth-videos"))
  console.log("  ✓ no Media Assets bucket collision in media migration")

  const providerSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/providers/supabase-video-storage-provider.ts"),
    "utf8",
  )
  assert.match(providerSource, /GROWTH_VIDEOS_STORAGE_BUCKET/)
  assert.equal(GROWTH_VIDEOS_STORAGE_BUCKET, "growth-videos")
  console.log("  ✓ Supabase storage provider targets growth-videos bucket")

  console.log("\nA2 Video assets local regression PASS\n")
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
    ok: schema.ready && schema.upload_schema_ready && schema.storage_bucket.ok,
    qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
    final_verdict:
      schema.ready && schema.upload_schema_ready && schema.storage_bucket.ok ? "PASS" : "FAIL",
    workspace_enabled: isGrowthVideoWorkspaceEnabled(),
    schema,
    blockers: [
      !schema.ready ? "video_schema_not_ready" : null,
      !schema.upload_schema_ready ? "video_upload_schema_not_ready" : null,
      !schema.storage_bucket.ok ? `storage_bucket:${schema.storage_bucket.error}` : null,
    ].filter(Boolean),
  }
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")
  runLocalRegression()

  if (!production) {
    console.log(
      JSON.stringify({
        ok: true,
        local_only: true,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
        hint: "Run pnpm test:growth-video-assets:production after applying A2 migration",
      }),
    )
    return
  }

  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
