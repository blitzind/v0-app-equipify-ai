/**
 * Growth Engine B2 — Video overlay preview certification.
 *
 * Local: pnpm test:growth-video-overlays
 * Production: pnpm test:growth-video-overlays:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_OVERLAYS_CONFIRM,
  GROWTH_VIDEO_OVERLAYS_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import { buildGrowthVideoBrandingPreview } from "../lib/growth/videos/growth-video-branding-service"
import {
  createDefaultGrowthVideoOverlayItem,
  growthVideoOverlayB2ToMediaSpec,
  normalizeGrowthVideoOverlayConfig,
  resolveGrowthVideoOverlayPreviewItems,
} from "../lib/growth/videos/growth-video-overlay-render-service"
import { previewGrowthVideoOverlays } from "../lib/growth/videos/growth-video-overlay-preview-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-overlay-service.ts",
  "lib/growth/videos/growth-video-overlay-preview-service.ts",
  "lib/growth/videos/growth-video-branding-service.ts",
  "lib/growth/videos/growth-video-overlay-render-service.ts",
  "app/api/growth/videos/overlays/preview/route.ts",
  "app/api/growth/videos/pages/[id]/overlays/route.ts",
  "components/growth/videos/growth-video-page-overlay-section.tsx",
  "components/growth/videos/growth-video-overlay-preview.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/media/media-video-overlay-types.ts",
  "lib/growth/media/media-video-overlay-utils.ts",
  "lib/growth/share-pages/share-page-types.ts",
  "lib/growth/videos/growth-video-merge-context-service.ts",
  "lib/growth/videos/growth-video-preview-render-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== B2 Video overlays (${GROWTH_VIDEO_OVERLAYS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_OVERLAYS_QA_MARKER, "growth-video-overlays-b2-v1")
  assert.equal(GROWTH_VIDEO_OVERLAYS_CONFIRM, "RUN_GROWTH_VIDEO_OVERLAYS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} B2 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const renderService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-overlay-render-service.ts"),
    "utf8",
  )
  assert.match(renderService, /media-video-overlay-utils/)
  assert.match(renderService, /growthVideoOverlayB2ToMediaSpec/)
  assert.ok(!renderService.includes("ffmpeg"))
  assert.ok(!renderService.includes("remotion"))
  console.log("  ✓ render service reuses S2-E overlay utils (no ffmpeg/remotion)")

  const overlayService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-overlay-service.ts"),
    "utf8",
  )
  assert.match(overlayService, /resolveGrowthVideoMergeContext/)
  assert.match(overlayService, /GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY/)
  assert.ok(!overlayService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!overlayService.includes("runSequenceExecutionJob"))
  console.log("  ✓ overlay service reuses B1 merge + metadata only")

  const brandingService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-branding-service.ts"),
    "utf8",
  )
  assert.match(brandingService, /DEFAULT_GROWTH_SHARE_PAGE_THEME/)
  console.log("  ✓ branding service reuses Share Page theme defaults")

  const publicPageView = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-public-page-view.tsx"),
    "utf8",
  )
  assert.match(publicPageView, /overlayItems/)
  assert.match(publicPageView, /pointer-events-none/)
  assert.ok(!publicPageView.includes("ffmpeg"))
  console.log("  ✓ public page renders HTML/CSS overlay preview")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Overlays/)
  assert.match(detailPanel, /GrowthVideoPageOverlaySection/)
  console.log("  ✓ page detail panel includes Overlays tab")

  for (const routePath of [
    "app/api/growth/videos/overlays/preview/route.ts",
    "app/api/growth/videos/pages/[id]/overlays/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ overlay API routes use platform access + safety payloads")

  const config = normalizeGrowthVideoOverlayConfig({
    enabled: true,
    items: [
      createDefaultGrowthVideoOverlayItem("intro_banner"),
      createDefaultGrowthVideoOverlayItem("company_badge"),
    ],
  })
  config.items[0]!.textTemplate = "A quick video for {{first_name}}"
  config.items[1]!.textTemplate = "{{company}} · {{industry}}"

  const preview = previewGrowthVideoOverlays({
    config,
    pageBranding: { primaryColor: "#2563eb" },
    previewForm: {
      firstName: "John",
      company: "Precision Biomedical",
      industry: "Medical Equipment",
    },
  })
  assert.ok(preview.previewItems.length >= 2)
  assert.match(preview.previewItems[0]?.resolvedText ?? "", /John/)
  assert.match(preview.previewItems[1]?.resolvedText ?? "", /Precision Biomedical/)
  assert.ok(preview.aiPayload.overlay_score > 0)
  console.log("  ✓ preview merge resolution + AI payload")

  const mediaSpec = growthVideoOverlayB2ToMediaSpec(config, "#2563eb")
  assert.ok(mediaSpec.overlays.length >= 2)
  console.log("  ✓ B2 config maps to S2-E media overlay spec")

  const brandingPreview = buildGrowthVideoBrandingPreview({ primaryColor: "#111827" })
  assert.ok(brandingPreview.primaryColor)
  console.log("  ✓ branding preview helper")

  console.log("\nB2 Video overlays local regression PASS\n")
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
    qa_marker: GROWTH_VIDEO_OVERLAYS_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    pages_schema_ready: schema.pages_schema_ready,
    blockers: [!schema.pages_schema_ready ? "pages_schema_not_ready" : null].filter(Boolean),
    production_deploy_required: [
      "B2 overlay APIs require Vercel Production deploy",
      "Overlays tab UI requires Vercel Production deploy",
      "Public HTML/CSS overlays require Vercel Production deploy",
    ],
    preview_only_limitation: "No video burn-in, ffmpeg, remotion, or new overlay engine",
    final_verdict: schema.pages_schema_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nB2 Video overlays production certification PASS\n")
  }
}

void main()
