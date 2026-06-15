/**
 * Growth Engine SR-2B-4 — Share page booking certification.
 *
 * Local: pnpm test:growth-share-pages:booking
 * Production: pnpm test:growth-share-pages:booking:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { parsePublicBookingSubmitPayload } from "../lib/growth/booking/booking-submit-payload"
import {
  buildSharePageBookingAttribution,
  buildSharePageBookingUrl,
  GROWTH_SHARE_PAGE_BOOKING_REF,
  parseSharePageBookingAttributionFromSearchParams,
} from "../lib/growth/share-pages/share-page-booking-attribution"
import {
  GROWTH_SHARE_PAGES_BOOKING_CONFIRM,
  GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
  GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
} from "../lib/growth/share-pages/share-page-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-4 local regression (${GROWTH_SHARE_PAGES_BOOKING_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_BOOKING_QA_MARKER, "share-pages-booking-sr2b4-v1")
  assert.equal(GROWTH_SHARE_PAGES_BOOKING_CONFIRM, "RUN_GROWTH_SHARE_PAGES_BOOKING_CERTIFICATION")
  assert.equal(GROWTH_SHARE_PAGES_BOOKING_MIGRATION, "20270826120200_growth_engine_share_pages_booking_attribution.sql")
  console.log("  ✓ QA marker, confirm token, migration id")

  const requiredFiles = [
    "supabase/migrations/20270826120200_growth_engine_share_pages_booking_attribution.sql",
    "lib/growth/share-pages/share-page-booking-attribution.ts",
    "lib/growth/share-pages/share-page-booking-service.ts",
    "lib/growth/share-pages/share-page-booking-bridge.ts",
    "lib/growth/share-pages/share-page-booking-diagnostics.ts",
    "components/growth/share-pages/growth-share-page-booking-section.tsx",
    "app/api/growth/share-pages/booking/started/route.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-4 module files exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270826120200_growth_engine_share_pages_booking_attribution.sql"),
    "utf8",
  )
  assert.ok(migration.includes("booking_page_bookings"))
  assert.ok(migration.includes("metadata jsonb"))
  console.log("  ✓ booking metadata migration contents")

  const attribution = buildSharePageBookingAttribution({
    sharePageId: randomUUID(),
    leadId: randomUUID(),
    sourceChannel: "email",
    enrollmentId: randomUUID(),
    sequenceExecutionJobId: randomUUID(),
  })
  const url = buildSharePageBookingUrl("acme-demo", attribution)
  assert.ok(url.startsWith("/book/acme-demo?"))
  assert.ok(url.includes(`${GROWTH_SHARE_PAGE_BOOKING_REF}`))
  assert.ok(url.includes("share_page_id="))
  assert.ok(url.includes("sequence_execution_job_id="))
  console.log("  ✓ booking URL attribution builder")

  const parsedParams = parseSharePageBookingAttributionFromSearchParams(new URL(url, "https://app.equipify.ai").searchParams)
  assert.equal(parsedParams?.sharePageId, attribution.sharePageId)
  assert.equal(parsedParams?.leadId, attribution.leadId)
  console.log("  ✓ booking attribution query parser")

  const submitPayload = parsePublicBookingSubmitPayload({
    name: "Jane Doe",
    email: "jane@example.com",
    slotStartAt: "2026-05-19T14:00:00.000Z",
    slotEndAt: "2026-05-19T14:30:00.000Z",
    attribution: {
      ref: GROWTH_SHARE_PAGE_BOOKING_REF,
      share_page_id: attribution.sharePageId,
      lead_id: attribution.leadId,
      source_channel: attribution.sourceChannel,
    },
  })
  assert.equal(submitPayload.ok, true)
  if (submitPayload.ok) {
    assert.equal(submitPayload.data.attribution?.sharePageId, attribution.sharePageId)
  }
  console.log("  ✓ booking submit payload attribution")

  const ctaSection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-cta-section.tsx"),
    "utf8",
  )
  assert.ok(ctaSection.includes("book_meeting"))
  assert.ok(ctaSection.includes("bookingUrl"))
  console.log("  ✓ book_meeting CTA wiring")

  const bookingService = fs.readFileSync(path.join(process.cwd(), "lib/growth/booking/booking-service.ts"), "utf8")
  assert.match(bookingService, /bridgeSharePageBookingCompleted/)
  assert.match(bookingService, /metadata: bookingMetadata/)
  console.log("  ✓ booking conversion bridge in booking service")

  const bookPage = fs.readFileSync(path.join(process.cwd(), "app/book/[slug]/page.tsx"), "utf8")
  assert.match(bookPage, /index: false/)
  console.log("  ✓ booking route no-index metadata")

  console.log("\nSR-2B-4 local regression PASS\n")
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
  const { executeGrowthSharePageBookingDiagnostics } = await import(
    "../lib/growth/share-pages/share-page-booking-diagnostics"
  )
  return executeGrowthSharePageBookingDiagnostics(admin)
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
          qa_marker: GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:booking:integration after applying migration",
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
