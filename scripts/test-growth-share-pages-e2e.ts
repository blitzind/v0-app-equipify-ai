/**
 * Growth Engine SR-2B-6 — Share pages end-to-end certification + consolidated readiness.
 *
 * Local: pnpm test:growth-share-pages:e2e
 * Integration: pnpm test:growth-share-pages:e2e:integration
 * Production: pnpm test:growth-share-pages:e2e:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildSharePageCreationCandidate,
  buildSharePageLinkForSequenceStep,
  canCreateSharePageForLead,
  GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
  GROWTH_SHARE_PAGES_E2E_CONFIRM,
  GROWTH_SHARE_PAGES_E2E_QA_MARKER,
  GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER,
  validateSharePageCampaignReadiness,
} from "../lib/growth/share-pages/share-page-campaign-handoff"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-6 local regression (${GROWTH_SHARE_PAGES_E2E_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_E2E_QA_MARKER, "share-pages-e2e-sr2b6-v1")
  assert.equal(GROWTH_SHARE_PAGES_E2E_CONFIRM, "RUN_GROWTH_SHARE_PAGES_E2E_CERTIFICATION")
  assert.equal(GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER, "share-pages-campaign-handoff-sr2b6-v1")
  assert.equal(GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER, "share-pages-consolidated-sr2b6-v1")
  console.log("  ✓ QA markers and confirm token")

  const requiredFiles = [
    "lib/growth/share-pages/share-page-campaign-handoff.ts",
    "lib/growth/share-pages/share-pages-e2e-diagnostics.ts",
    "lib/growth/share-pages/share-pages-consolidated-report.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-6 module files exist")

  const canCreate = canCreateSharePageForLead({
    leadId: "544492e9-2e75-4460-9eb7-dd66b6114c46",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
  })
  assert.equal(canCreate.ok, true)
  const blocked = canCreateSharePageForLead({ leadId: "", organizationId: "" })
  assert.equal(blocked.ok, false)
  console.log("  ✓ canCreateSharePageForLead")

  const candidate = buildSharePageCreationCandidate({
    leadId: "544492e9-2e75-4460-9eb7-dd66b6114c46",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    sourceChannel: "sequence",
  })
  assert.equal(candidate.status, "pending_review")
  assert.equal(candidate.autoCreateEnabled, false)
  assert.equal(candidate.requiresHumanReview, true)
  console.log("  ✓ buildSharePageCreationCandidate")

  const readiness = validateSharePageCampaignReadiness({
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    leadId: "544492e9-2e75-4460-9eb7-dd66b6114c46",
    schemaReady: true,
    hasLeadRecord: true,
    bookingPageEnabled: true,
  })
  assert.equal(readiness.ready, true)
  assert.equal(readiness.autoCreateEnabled, false)
  assert.ok(readiness.warnings.includes("auto_create_on_enrollment_not_enabled"))
  console.log("  ✓ validateSharePageCampaignReadiness")

  const linkWithoutToken = buildSharePageLinkForSequenceStep({
    campaignId: "11111111-1111-4111-8111-111111111111",
    enrollmentId: "22222222-2222-4222-8222-222222222222",
  })
  assert.equal(linkWithoutToken.href, null)
  assert.equal(linkWithoutToken.tokenRequired, true)
  assert.equal(linkWithoutToken.requiresHumanApproval, true)

  const linkWithToken = buildSharePageLinkForSequenceStep({
    publicToken: "abc123def456ghi789",
    campaignId: "11111111-1111-4111-8111-111111111111",
  })
  assert.ok(linkWithToken.href?.includes("/p/abc123def456ghi789"))
  assert.ok(linkWithToken.href?.includes("utm_source=sequence"))
  console.log("  ✓ buildSharePageLinkForSequenceStep")

  const publicPage = fs.readFileSync(path.join(process.cwd(), "app/p/[token]/page.tsx"), "utf8")
  assert.match(publicPage, /index: false/)
  assert.match(publicPage, /follow: false/)

  const previewPage = fs.readFileSync(path.join(process.cwd(), "app/p-preview/[token]/page.tsx"), "utf8")
  assert.match(previewPage, /index: false/)
  assert.match(previewPage, /noarchive: true/)
  console.log("  ✓ preview/public routes no-index metadata")

  const handoff = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-campaign-handoff.ts"),
    "utf8",
  )
  assert.ok(handoff.includes("autoCreateEnabled: false"))
  assert.ok(handoff.includes("enrollmentExecution: false"))
  console.log("  ✓ campaign handoff safety gates")

  const e2eModule = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-pages-e2e-diagnostics.ts"),
    "utf8",
  )
  for (const step of [
    "admin_create",
    "personalization_context",
    "preview_route_resolves",
    "approve_publish",
    "public_route_resolves",
    "tracker_page_view",
    "cta_click_analytics",
    "booking_started_analytics",
    "booking_completed_attribution",
    "timeline_events",
    "engagement_score_updated",
    "signal_emitted",
    "realtime_event_published",
    "revoke_blocks_public",
    "archive_blocks_public",
    "expired_blocks_public",
  ]) {
    assert.ok(e2eModule.includes(step), `Missing e2e check: ${step}`)
  }
  console.log("  ✓ e2e lifecycle check ids")

  const consolidated = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-pages-consolidated-report.ts"),
    "utf8",
  )
  assert.ok(consolidated.includes("production_readiness_verdict"))
  assert.ok(consolidated.includes("foundation"))
  assert.ok(consolidated.includes("e2e"))
  console.log("  ✓ consolidated report structure")

  console.log("\nSR-2B-6 local regression PASS\n")
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

  const { executeGrowthSharePagesE2eDiagnostics } = await import(
    "../lib/growth/share-pages/share-pages-e2e-diagnostics"
  )
  const e2e = await executeGrowthSharePagesE2eDiagnostics(admin)

  const { buildGrowthSharePagesConsolidatedReport } = await import(
    "../lib/growth/share-pages/share-pages-consolidated-report"
  )
  const consolidated = await buildGrowthSharePagesConsolidatedReport(admin, {
    skip_phase_reruns: true,
  })

  return {
    ok: e2e.ok && consolidated.ok,
    e2e,
    consolidated,
    final_verdict: e2e.final_verdict === "PASS" && consolidated.production_readiness_verdict !== "NOT_READY" ? "PASS" : "FAIL",
  }
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
          qa_marker: GROWTH_SHARE_PAGES_E2E_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:e2e:integration for DB-backed e2e cert",
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
