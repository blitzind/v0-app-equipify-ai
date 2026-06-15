/**
 * Growth Engine SR-2B-1 — Share Pages foundation certification.
 *
 * Local: pnpm test:growth-share-pages
 * Production: pnpm test:growth-share-pages:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildSharePagesReadinessPayload,
  validateSharePageOrganizationScope,
  validateSharePageRouteToken,
} from "../lib/growth/share-pages/share-pages-route-gates"
import {
  GROWTH_SHARE_PAGE_EVENT_TYPES,
  GROWTH_SHARE_PAGE_STATUSES,
  GROWTH_SHARE_PAGES_CONFIRM,
  GROWTH_SHARE_PAGES_MIGRATION,
  GROWTH_SHARE_PAGES_QA_MARKER,
} from "../lib/growth/share-pages/share-page-types"
import {
  buildDefaultSharePageExpirationIso,
  generateSharePagePreviewTokenBundle,
  generateSharePageTokenBundle,
  hashSharePageToken,
  isSharePageTokenFormatValid,
  resolveSharePageExpirationIso,
  verifySharePageToken,
} from "../lib/growth/share-pages/share-page-token"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-1 local regression (${GROWTH_SHARE_PAGES_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_QA_MARKER, "share-pages-sr2-v1")
  assert.equal(GROWTH_SHARE_PAGES_CONFIRM, "RUN_GROWTH_SHARE_PAGES_CERTIFICATION")
  assert.equal(GROWTH_SHARE_PAGE_STATUSES.length, 6)
  assert.equal(GROWTH_SHARE_PAGE_EVENT_TYPES.length, 10)
  console.log("  ✓ QA marker, statuses, and event types")

  const requiredFiles = [
    "supabase/migrations/20270826120000_growth_engine_share_pages_foundation.sql",
    "lib/growth/share-pages/share-page-types.ts",
    "lib/growth/share-pages/share-page-token.ts",
    "lib/growth/share-pages/share-page-repository.ts",
    "lib/growth/share-pages/share-pages-route-gates.ts",
    "lib/growth/share-pages/share-pages-schema-health.ts",
    "lib/growth/share-pages/share-pages-diagnostics.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-1 module files exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270826120000_growth_engine_share_pages_foundation.sql"),
    "utf8",
  )
  for (const indexName of [
    "idx_growth_share_pages_token_hash",
    "idx_growth_share_pages_token_prefix",
    "idx_growth_share_pages_lead_id",
    "idx_growth_share_pages_campaign_id",
    "idx_growth_share_pages_enrollment_id",
    "idx_growth_share_pages_sequence_execution_job_id",
    "idx_growth_share_pages_status",
    "idx_growth_share_pages_source_channel",
  ]) {
    assert.ok(migration.includes(indexName), `Missing index in migration: ${indexName}`)
  }
  assert.ok(migration.includes("requires_human_review boolean not null default true"))
  console.log("  ✓ migration indexes and human review default")

  const publicBundle = generateSharePageTokenBundle()
  const previewBundle = generateSharePagePreviewTokenBundle()
  assert.ok(isSharePageTokenFormatValid(publicBundle.rawToken))
  assert.ok(previewBundle.rawToken.startsWith("pv_"))
  assert.ok(verifySharePageToken(publicBundle.rawToken, hashSharePageToken(publicBundle.rawToken)))
  assert.equal(publicBundle.tokenPrefix, publicBundle.rawToken.slice(0, 8))
  console.log("  ✓ token generation, hash-at-rest, and verification")

  const futureExpiry = buildDefaultSharePageExpirationIso(30)
  assert.ok(!resolveSharePageExpirationIso(futureExpiry))
  assert.ok(resolveSharePageExpirationIso("2020-01-01T00:00:00.000Z"))
  console.log("  ✓ expiration helpers")

  const readiness = buildSharePagesReadinessPayload()
  assert.equal(readiness.requires_human_review, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  assert.equal(readiness.no_outreach_execution, true)
  assert.equal(readiness.no_enrollment_execution, true)
  assert.equal(readiness.migration, GROWTH_SHARE_PAGES_MIGRATION)
  console.log("  ✓ readiness payload preserves approval gates")

  const tokenValidation = validateSharePageRouteToken(publicBundle.rawToken)
  assert.equal(tokenValidation.ok, true)
  assert.equal(validateSharePageRouteToken("bad token!").ok, false)
  console.log("  ✓ route token validation helper")

  const orgScope = validateSharePageOrganizationScope({
    organizationId: "org-a",
    expectedOrganizationId: "org-a",
  })
  assert.equal(orgScope.ok, true)
  assert.equal(
    validateSharePageOrganizationScope({
      organizationId: "org-a",
      expectedOrganizationId: "org-b",
    }).ok,
    false,
  )
  console.log("  ✓ organization scope validation helper")

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-repository.ts"),
    "utf8",
  )
  for (const fn of [
    "createSharePage",
    "updateSharePage",
    "approveSharePage",
    "revokeSharePage",
    "archiveSharePage",
    "resolveSharePageByToken",
    "resolveSharePageByPreviewToken",
    "createSharePageViewSession",
    "updateSharePageViewSession",
    "appendSharePageEvent",
    "getSharePageAnalyticsSummary",
  ]) {
    assert.ok(repositorySource.includes(`export async function ${fn}`), `Missing repository fn: ${fn}`)
  }
  console.log("  ✓ repository surface area")

  console.log("\nSR-2B-1 local regression PASS\n")
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
  const { executeGrowthSharePagesDiagnostics } = await import("../lib/growth/share-pages/share-pages-diagnostics")
  return executeGrowthSharePagesDiagnostics(admin, {})
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
          qa_marker: GROWTH_SHARE_PAGES_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:integration after applying migration",
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
