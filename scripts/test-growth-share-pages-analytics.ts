/**
 * Growth Engine SR-2B-3 — Share page analytics certification.
 *
 * Local: pnpm test:growth-share-pages:analytics
 * Production: pnpm test:growth-share-pages:analytics:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { computeAttributionEngagementScore, GROWTH_ATTRIBUTION_SCORE_POINTS } from "../lib/growth/tracking/engagement-score"
import { checkSharePageAnalyticsRateLimit, resetSharePageAnalyticsRateLimitForTests } from "../lib/growth/share-pages/share-page-analytics-rate-limit"
import { isHighIntentSharePageSignalType } from "../lib/growth/share-pages/share-page-analytics-signals"
import {
  GROWTH_SHARE_PAGES_ANALYTICS_CONFIRM,
  GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
  GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
} from "../lib/growth/share-pages/share-page-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"
import { GROWTH_SIGNAL_TYPES } from "../lib/growth/signals/signal-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-3 local regression (${GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER, "share-pages-analytics-sr2b3-v1")
  assert.equal(GROWTH_SHARE_PAGES_ANALYTICS_CONFIRM, "RUN_GROWTH_SHARE_PAGES_ANALYTICS_CERTIFICATION")
  assert.equal(GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION, "20270826120100_growth_engine_share_pages_analytics.sql")
  console.log("  ✓ QA marker, confirm token, migration id")

  const requiredFiles = [
    "supabase/migrations/20270826120100_growth_engine_share_pages_analytics.sql",
    "app/api/growth/share-pages/[token]/events/route.ts",
    "components/growth/share-pages/share-page-tracker.tsx",
    "lib/growth/share-pages/share-page-analytics-service.ts",
    "lib/growth/share-pages/share-page-analytics-timeline.ts",
    "lib/growth/share-pages/share-page-analytics-signals.ts",
    "lib/growth/share-pages/share-page-analytics-rate-limit.ts",
    "lib/growth/share-pages/share-page-analytics-diagnostics.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-3 module files exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270826120100_growth_engine_share_pages_analytics.sql"),
    "utf8",
  )
  for (const token of [
    "share_page_viewed",
    "share_page_engaged",
    "page_views",
    "page_engaged",
    "page_cta_clicks",
    "page_bookings_completed",
  ]) {
    assert.ok(migration.includes(token), `Missing migration token: ${token}`)
  }
  console.log("  ✓ analytics migration contents")

  for (const eventType of [
    "share_page_viewed",
    "share_page_engaged",
    "share_page_cta_clicked",
    "share_page_booking_started",
    "share_page_booking_completed",
    "share_page_resource_opened",
  ]) {
    assert.ok((GROWTH_LEAD_TIMELINE_EVENT_TYPES as readonly string[]).includes(eventType), `Missing timeline type: ${eventType}`)
  }
  console.log("  ✓ timeline event types registered")

  for (const signalType of [
    "share_page_viewed",
    "share_page_engaged",
    "share_page_cta_clicked",
    "share_page_booking_started",
    "share_page_booking_completed",
  ]) {
    assert.ok((GROWTH_SIGNAL_TYPES as readonly string[]).includes(signalType), `Missing signal type: ${signalType}`)
    assert.ok(isHighIntentSharePageSignalType(signalType), `Not high-intent: ${signalType}`)
  }
  console.log("  ✓ high-intent signal types registered")

  assert.equal(GROWTH_ATTRIBUTION_SCORE_POINTS.pageView, 5)
  assert.equal(GROWTH_ATTRIBUTION_SCORE_POINTS.pageEngaged, 5)
  assert.equal(GROWTH_ATTRIBUTION_SCORE_POINTS.pageCtaClick, 15)
  assert.equal(GROWTH_ATTRIBUTION_SCORE_POINTS.pageBookingCompleted, 50)
  assert.equal(
    computeAttributionEngagementScore({
      opens: 0,
      clicks: 0,
      replies: 0,
      meetings: 0,
      pageViews: 1,
      pageEngaged: 1,
      pageCtaClicks: 1,
      pageBookingsCompleted: 1,
      lastActivityAt: new Date().toISOString(),
    }).score,
    75,
  )
  console.log("  ✓ attribution score points")

  resetSharePageAnalyticsRateLimitForTests()
  const allowed = checkSharePageAnalyticsRateLimit("cert-key")
  assert.equal(allowed.allowed, true)
  console.log("  ✓ rate limit helper")

  const apiRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/share-pages/[token]/events/route.ts"),
    "utf8",
  )
  assert.ok(!apiRoute.includes("token_hash"))
  assert.ok(!apiRoute.includes("tokenHash"))
  console.log("  ✓ API route never exposes hashes")

  console.log("\nSR-2B-3 local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_SHARE_PAGES_CERT_ALLOW_LOCAL = process.env.GROWTH_SHARE_PAGES_CERT_ALLOW_LOCAL ?? "1"

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthSharePageAnalyticsDiagnostics } = await import(
    "../lib/growth/share-pages/share-page-analytics-diagnostics"
  )
  return executeGrowthSharePageAnalyticsDiagnostics(admin)
}

async function main(): Promise<void> {
  const integration = process.argv.includes("--integration") || process.argv.includes("--production")
  runLocalRegression()

  if (!integration) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:analytics:integration after applying migration",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
