/**
 * Growth Engine A3 — Personalized video pages certification.
 *
 * Local: pnpm test:growth-video-pages
 * Production: pnpm test:growth-video-pages:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_PAGES_CONFIRM,
  GROWTH_VIDEO_PAGES_MIGRATION,
  GROWTH_VIDEO_PAGES_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import {
  assertGrowthVideoPageSlug,
  buildGrowthVideoPublicPath,
  slugFromGrowthVideoPageTitle,
} from "../lib/growth/videos/growth-video-page-validation"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "supabase/migrations/20270828150000_growth_engine_personalized_video_pages_a3.sql",
  "lib/growth/videos/growth-video-page-service.ts",
  "lib/growth/videos/growth-video-page-event-service.ts",
  "lib/growth/videos/growth-video-page-validation.ts",
  "lib/growth/videos/growth-video-public-page-service.ts",
  "app/api/growth/videos/pages/route.ts",
  "app/api/growth/videos/pages/[id]/route.ts",
  "app/api/growth/videos/pages/[id]/publish/route.ts",
  "app/api/growth/videos/pages/[id]/archive/route.ts",
  "app/api/growth/videos/page-events/route.ts",
  "app/v/[slug]/page.tsx",
  "components/growth/videos/growth-video-pages-panel.tsx",
  "components/growth/videos/growth-video-page-create-panel.tsx",
  "components/growth/videos/growth-video-page-preview-card.tsx",
  "components/growth/videos/growth-video-page-step-card.tsx",
  "components/growth/videos/growth-video-page-detail-panel.tsx",
  "components/growth/videos/growth-video-public-page-view.tsx",
  "components/growth/videos/use-growth-video-pages.ts",
  "app/(growth)/growth/videos/pages/page.tsx",
  "app/(growth)/growth/videos/pages/new/page.tsx",
  "app/(growth)/growth/videos/pages/[id]/page.tsx",
  "app/(admin)/admin/growth/videos/pages/page.tsx",
  "app/(admin)/admin/growth/videos/pages/new/page.tsx",
  "app/(admin)/admin/growth/videos/pages/[id]/page.tsx",
] as const

const MANAGEMENT_API_ROUTES = [
  "app/api/growth/videos/pages/route.ts",
  "app/api/growth/videos/pages/[id]/route.ts",
  "app/api/growth/videos/pages/[id]/publish/route.ts",
  "app/api/growth/videos/pages/[id]/archive/route.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== A3 Video pages (${GROWTH_VIDEO_PAGES_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_PAGES_QA_MARKER, "growth-video-pages-a3-v1")
  assert.equal(GROWTH_VIDEO_PAGES_CONFIRM, "RUN_GROWTH_VIDEO_PAGES_CERTIFICATION")
  assert.equal(
    GROWTH_VIDEO_PAGES_MIGRATION,
    "20270828150000_growth_engine_personalized_video_pages_a3.sql",
  )
  console.log("  ✓ QA marker and migration constant")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} A3 module files exist`)

  for (const routePath of MANAGEMENT_API_ROUTES) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ management API routes use platform access + safety payloads")

  const publicEventRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/videos/page-events/route.ts"),
    "utf8",
  )
  assert.ok(!publicEventRoute.includes("requireGrowthVideoPlatformAccess"))
  assert.match(publicEventRoute, /createGrowthVideoPageEventService/)
  console.log("  ✓ page-events route is public-safe (no platform admin gate)")

  const publicPageService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-public-page-service.ts"),
    "utf8",
  )
  assert.ok(!publicPageService.includes("requireGrowthVideoPlatformAccess"))
  assert.match(publicPageService, /resolveGrowthVideoPublicPageBySlug/)
  console.log("  ✓ public page service does not require platform admin auth")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828150000_growth_engine_personalized_video_pages_a3.sql"),
    "utf8",
  )
  assert.ok(migration.includes("growth.video_pages"))
  assert.ok(migration.includes("growth.video_page_events"))
  assert.ok(migration.includes("page_view"))
  assert.ok(migration.includes("cta_click"))
  assert.ok(migration.includes("calendar_click"))
  console.log("  ✓ A3 migration defines pages + events tables")

  assert.equal(assertGrowthVideoPageSlug("my-page"), "my-page")
  assert.throws(() => assertGrowthVideoPageSlug("ab"))
  assert.equal(slugFromGrowthVideoPageTitle("Hello World!"), "hello-world")
  assert.equal(buildGrowthVideoPublicPath("demo"), "/v/demo")
  console.log("  ✓ page validation helpers")

  const mediaMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827120700_growth_media_assets_s1_5.sql"),
    "utf8",
  )
  assert.ok(mediaMigration.includes("growth-media-assets"))
  assert.ok(!mediaMigration.includes("video_pages"))
  const pagesMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828150000_growth_engine_personalized_video_pages_a3.sql"),
    "utf8",
  )
  assert.ok(!pagesMigration.includes("media_assets"))
  console.log("  ✓ Video Pages remain separate from Media Assets")

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-video-workspace-navigation.ts"),
    "utf8",
  )
  const libraryIdx = navSource.indexOf('"Library"')
  const pagesIdx = navSource.indexOf('"Pages"')
  const recordIdx = navSource.indexOf('"Record"')
  assert.ok(libraryIdx < pagesIdx && pagesIdx < recordIdx)
  console.log("  ✓ navigation order: Library → Pages → Record")

  console.log("\nA3 Video pages local regression PASS\n")
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
    ok: schema.ready && schema.pages_schema_ready,
    qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
    final_verdict: schema.ready && schema.pages_schema_ready ? "PASS" : "FAIL",
    schema,
    blockers: [
      !schema.ready ? "video_schema_not_ready" : null,
      !schema.pages_schema_ready ? "video_pages_schema_not_ready" : null,
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
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
        hint: "Run pnpm test:growth-video-pages:production after applying A3 migration",
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
