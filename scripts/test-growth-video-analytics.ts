/**
 * Growth Engine A4 — Video analytics certification.
 *
 * Local: pnpm test:growth-video-analytics
 * Production: pnpm test:growth-video-analytics:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES,
  computeGrowthVideoEngagementScore,
  rollupGrowthVideoPageEventsBySession,
} from "../lib/growth/videos/growth-video-engagement-scoring-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"
import {
  GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS,
  GROWTH_VIDEO_ANALYTICS_CONFIRM,
  GROWTH_VIDEO_ANALYTICS_MIGRATION,
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "supabase/migrations/20270828160000_growth_engine_video_analytics_a4.sql",
  "lib/growth/videos/growth-video-analytics-summary-service.ts",
  "lib/growth/videos/growth-video-engagement-scoring-service.ts",
  "lib/growth/videos/growth-video-engagement-timeline-service.ts",
  "lib/growth/videos/growth-video-visitor-service.ts",
  "app/api/growth/videos/analytics/route.ts",
  "app/api/growth/videos/analytics/assets/[id]/route.ts",
  "app/api/growth/videos/analytics/pages/[id]/route.ts",
  "app/api/growth/videos/analytics/visitors/[id]/route.ts",
  "components/growth/videos/growth-video-analytics-shell.tsx",
  "components/growth/videos/growth-video-analytics-charts.tsx",
  "components/growth/videos/growth-video-asset-analytics-panel.tsx",
  "components/growth/videos/growth-video-page-analytics-section.tsx",
  "components/growth/videos/growth-video-visitor-timeline-panel.tsx",
] as const

const ANALYTICS_API_ROUTES = [
  "app/api/growth/videos/analytics/route.ts",
  "app/api/growth/videos/analytics/assets/[id]/route.ts",
  "app/api/growth/videos/analytics/pages/[id]/route.ts",
  "app/api/growth/videos/analytics/visitors/[id]/route.ts",
] as const

function runScoringRegression(): void {
  const rollups = rollupGrowthVideoPageEventsBySession([
    {
      organization_id: "org-1",
      video_asset_id: "asset-1",
      video_page_id: "page-1",
      visitor_identifier: "visitor-1",
      session_id: "session-1",
      event_type: "page_view",
      metadata_json: {},
      created_at: "2026-06-18T10:00:00.000Z",
    },
    {
      organization_id: "org-1",
      video_asset_id: "asset-1",
      video_page_id: "page-1",
      visitor_identifier: "visitor-1",
      session_id: "session-1",
      event_type: "video_play",
      metadata_json: {},
      created_at: "2026-06-18T10:00:05.000Z",
    },
    {
      organization_id: "org-1",
      video_asset_id: "asset-1",
      video_page_id: "page-1",
      visitor_identifier: "visitor-1",
      session_id: "session-1",
      event_type: "video_progress",
      metadata_json: { percent: 30 },
      created_at: "2026-06-18T10:00:30.000Z",
    },
    {
      organization_id: "org-1",
      video_asset_id: "asset-1",
      video_page_id: "page-1",
      visitor_identifier: "visitor-1",
      session_id: "session-1",
      event_type: "cta_click",
      metadata_json: {},
      created_at: "2026-06-18T10:01:00.000Z",
    },
  ])

  assert.equal(rollups.length, 1)
  const score = computeGrowthVideoEngagementScore({
    rollup: rollups[0]!,
    visitorSessionCount: 2,
  })
  assert.equal(score.engagementScore, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.cta_click + 5)
  assert.equal(score.aiSignals.video_cta_clicked, true)
  assert.equal(score.aiSignals.video_return_visitor, true)
  assert.ok(score.aiEngagementSummary.includes("clicked CTA"))

  const calendarScore = computeGrowthVideoEngagementScore({
    rollup: {
      ...rollups[0]!,
      totalCtaClicks: 0,
      totalCalendarClicks: 1,
      highestPercentWatched: 95,
    },
    visitorSessionCount: 1,
  })
  assert.equal(calendarScore.engagementScore, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.calendar_click)
  assert.equal(calendarScore.aiSignals.video_calendar_clicked, true)
  assert.equal(calendarScore.aiSignals.video_high_intent, true)

  for (const signal of GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS) {
    assert.ok(signal.startsWith("video_"))
  }
}

function runLocalRegression(): void {
  console.log(`\n=== A4 Video analytics (${GROWTH_VIDEO_ANALYTICS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_ANALYTICS_QA_MARKER, "growth-video-analytics-a4-v1")
  assert.equal(GROWTH_VIDEO_ANALYTICS_CONFIRM, "RUN_GROWTH_VIDEO_ANALYTICS_CERTIFICATION")
  assert.equal(
    GROWTH_VIDEO_ANALYTICS_MIGRATION,
    "20270828160000_growth_engine_video_analytics_a4.sql",
  )
  console.log("  ✓ QA marker and migration constant")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} A4 module files exist`)

  for (const routePath of ANALYTICS_API_ROUTES) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
    assert.match(source, /requireGrowthVideoAnalyticsSchemaReady/)
  }
  console.log("  ✓ analytics API routes use platform access + schema gates")

  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828160000_growth_engine_video_analytics_a4.sql"),
    "utf8",
  )
  assert.match(migrationSql, /growth\.video_engagement_summaries/)
  assert.match(migrationSql, /enable row level security/)
  assert.match(migrationSql, /grant select, insert, update, delete on growth\.video_engagement_summaries to service_role/)
  console.log("  ✓ migration defines summaries table + RLS + service_role grants")

  const mediaPanelPath = path.join(
    process.cwd(),
    "components/growth/media/growth-media-video-upload-panel.tsx",
  )
  if (fs.existsSync(mediaPanelPath)) {
    const mediaAssetsPanel = fs.readFileSync(mediaPanelPath, "utf8")
    assert.ok(!mediaAssetsPanel.includes("growth-video-analytics-summary-service"))
  }
  const analyticsShell = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-analytics-shell.tsx"),
    "utf8",
  )
  assert.match(analyticsShell, /api\/growth\/videos\/analytics/)
  assert.ok(!analyticsShell.includes("growth.media_assets"))
  console.log("  ✓ Video analytics separate from Media Assets")

  runScoringRegression()
  console.log("  ✓ engagement scoring + AI signal generation")

  console.log("\nA4 Video analytics local regression PASS\n")
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
    ok: schema.analytics_schema_ready,
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    final_verdict: schema.analytics_schema_ready ? "PASS" : "FAIL",
    schema,
    blockers: [
      !schema.analytics_schema_ready ? "video_analytics_schema_not_ready" : null,
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
        qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
        hint: "Run pnpm test:growth-video-analytics:production after applying A4 migration",
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
