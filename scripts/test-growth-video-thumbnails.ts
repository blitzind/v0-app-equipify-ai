/**
 * Growth Engine B3 — Personalized thumbnails & Open Graph certification.
 *
 * Local: pnpm test:growth-video-thumbnails
 * Production: pnpm test:growth-video-thumbnails:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_THUMBNAILS_CONFIRM,
  GROWTH_VIDEO_THUMBNAILS_MIGRATION,
  GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoThumbnailLayout,
  renderGrowthVideoThumbnailSvg,
} from "../lib/growth/videos/growth-video-thumbnail-render-service"
import { previewGrowthVideoThumbnail } from "../lib/growth/videos/growth-video-thumbnail-preview-service"
import { buildGrowthVideoOgMetadata } from "../lib/growth/videos/growth-video-og-image-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-thumbnail-render-service.ts",
  "lib/growth/videos/growth-video-thumbnail-preview-service.ts",
  "lib/growth/videos/growth-video-og-image-service.ts",
  "lib/growth/videos/growth-video-thumbnail-service.ts",
  "app/api/growth/videos/thumbnails/generate/route.ts",
  "app/api/growth/videos/thumbnails/preview/route.ts",
  "app/api/growth/videos/pages/[id]/thumbnail/route.ts",
  "components/growth/videos/growth-video-page-thumbnail-section.tsx",
  "supabase/migrations/20270828170000_growth_engine_video_thumbnails_b3.sql",
] as const

const MANAGEMENT_API_ROUTES = [
  "app/api/growth/videos/thumbnails/generate/route.ts",
  "app/api/growth/videos/thumbnails/preview/route.ts",
  "app/api/growth/videos/pages/[id]/thumbnail/route.ts",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/media/media-video-thumbnail-types.ts",
  "lib/growth/videos/growth-video-merge-context-service.ts",
  "lib/growth/videos/growth-video-preview-render-service.ts",
  "lib/growth/videos/growth-video-storage-factory.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== B3 Video thumbnails (${GROWTH_VIDEO_THUMBNAILS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_THUMBNAILS_QA_MARKER, "growth-video-thumbnails-b3-v1")
  assert.equal(GROWTH_VIDEO_THUMBNAILS_CONFIRM, "RUN_GROWTH_VIDEO_THUMBNAILS_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_THUMBNAILS_MIGRATION, "20270828170000_growth_engine_video_thumbnails_b3.sql")
  console.log("  ✓ QA marker, confirm token, migration id")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} B3 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  for (const routePath of MANAGEMENT_API_ROUTES) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ management API routes use platform access + safety payloads")

  const renderService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-thumbnail-render-service.ts"),
    "utf8",
  )
  assert.match(renderService, /media-video-thumbnail-types/)
  assert.match(renderService, /renderGrowthVideoThumbnailSvg/)
  assert.ok(!renderService.includes("ffmpeg"))
  console.log("  ✓ render service reuses S2-C MIME constants (no ffmpeg)")

  const thumbnailService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-thumbnail-service.ts"),
    "utf8",
  )
  assert.match(thumbnailService, /resolveGrowthVideoMergeContext/)
  assert.match(thumbnailService, /sharp/)
  assert.match(thumbnailService, /GROWTH_VIDEOS_STORAGE_BUCKET/)
  assert.ok(!thumbnailService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!thumbnailService.includes("runSequenceExecutionJob"))
  assert.ok(!thumbnailService.includes("media-video-thumbnail-service"))
  console.log("  ✓ thumbnail service reuses B1 merge + sharp rasterization + growth-videos bucket")

  const publicPageService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-public-page-service.ts"),
    "utf8",
  )
  assert.match(publicPageService, /resolveGrowthVideoPublicThumbnailUrls/)
  assert.match(publicPageService, /ogImageUrl/)
  assert.ok(!publicPageService.includes("requireGrowthVideoPlatformAccess"))
  console.log("  ✓ public page service resolves thumbnail/OG URLs without admin auth")

  const publicSlugPage = fs.readFileSync(path.join(process.cwd(), "app/v/[slug]/page.tsx"), "utf8")
  assert.match(publicSlugPage, /buildGrowthVideoOgMetadata/)
  assert.match(publicSlugPage, /ogImageUrl/)
  console.log("  ✓ public /v/[slug] generateMetadata includes OG image")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Thumbnail/)
  assert.match(detailPanel, /GrowthVideoPageThumbnailSection/)
  console.log("  ✓ page detail panel includes Thumbnail tab")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828170000_growth_engine_video_thumbnails_b3.sql"),
    "utf8",
  )
  assert.match(migration, /growth-videos/)
  assert.match(migration, /image\/jpeg/)
  assert.match(migration, /image\/png/)
  assert.ok(!migration.includes("create table"))
  console.log("  ✓ B3 migration extends growth-videos bucket MIME types only")

  const mergeValues = {
    first_name: "John",
    company: "Precision Biomedical",
    industry: "Medical Equipment",
  }
  const layout = buildGrowthVideoThumbnailLayout({
    type: "prospect",
    mergeValues,
    ctaLabel: "Watch Video",
  })
  assert.match(layout.headline, /John/)
  assert.match(layout.subheadline, /Precision Biomedical/)
  assert.match(layout.badge, /Medical Equipment/)
  console.log("  ✓ prospect thumbnail layout merge resolution")

  const rendered = renderGrowthVideoThumbnailSvg({
    type: "prospect",
    mergeValues,
    ctaLabel: "Watch Video",
  })
  assert.ok(rendered.svg.includes("<svg"))
  assert.equal(rendered.width, 640)
  assert.equal(rendered.height, 360)
  console.log("  ✓ deterministic SVG thumbnail rendering")

  const preview = previewGrowthVideoThumbnail({
    type: "prospect",
    form: {
      firstName: "John",
      company: "Precision Biomedical",
      industry: "Medical Equipment",
      ctaLabel: "Watch Video",
    },
  })
  assert.ok(preview.previewDataUrl.startsWith("data:image/svg+xml"))
  assert.ok(preview.aiPayload.thumbnail_score >= 0)
  assert.ok(Array.isArray(preview.aiPayload.sources_used))
  console.log("  ✓ preview service + AI payload shape")

  const ogMeta = buildGrowthVideoOgMetadata({
    title: "Video for John",
    description: "Personalized outreach",
    ogImageUrl: "https://example.com/og.jpg",
  })
  assert.equal(ogMeta.openGraph?.images?.[0]?.url, "https://example.com/og.jpg")
  assert.equal(ogMeta.twitter?.card, "summary_large_image")
  console.log("  ✓ OG metadata helper")

  console.log("\nB3 Video thumbnails local regression PASS\n")
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

  const { data: bucketRows, error: bucketError } = await admin.storage.listBuckets()
  const growthVideosBucket = bucketRows?.find((row) => row.id === "growth-videos")
  const allowedMimeTypes = growthVideosBucket?.allowed_mime_types ?? []
  const bucketAllowsImages =
    allowedMimeTypes.includes("image/jpeg") && allowedMimeTypes.includes("image/png")

  const blockers = [
    !schema.pages_schema_ready ? "pages_schema_not_ready" : null,
    bucketError ? `storage_buckets:${bucketError.message}` : null,
    !growthVideosBucket ? "growth_videos_bucket_missing" : null,
    growthVideosBucket && !bucketAllowsImages ? "growth_videos_bucket_image_mime_not_applied" : null,
  ].filter(Boolean)

  return {
    ok: schema.pages_schema_ready && !bucketError && !!growthVideosBucket && bucketAllowsImages,
    qa_marker: GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    pages_schema_ready: schema.pages_schema_ready,
    growth_videos_bucket_ready: !!growthVideosBucket,
    growth_videos_bucket_image_mime_ready: bucketAllowsImages,
    migration_id: GROWTH_VIDEO_THUMBNAILS_MIGRATION,
    blockers,
    production_deploy_required: [
      "B3 thumbnail APIs require Vercel Production deploy",
      "Thumbnail tab UI requires Vercel Production deploy",
      "B3 migration must be applied on production Supabase before image uploads succeed",
    ],
    final_verdict:
      schema.pages_schema_ready && !bucketError && growthVideosBucket && bucketAllowsImages
        ? "PASS"
        : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nB3 Video thumbnails production certification PASS\n")
  }
}

void main()
