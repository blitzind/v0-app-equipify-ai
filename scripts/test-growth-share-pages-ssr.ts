/**
 * Growth Engine SR-2B-2 — Share Pages SSR certification.
 *
 * Local: pnpm test:growth-share-pages:ssr
 * Integration: pnpm test:growth-share-pages:ssr:integration
 * Production: pnpm test:growth-share-pages:ssr:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { mapSharePageToRenderModel } from "../lib/growth/share-pages/share-page-render-model"
import {
  GROWTH_SHARE_PAGES_SSR_QA_MARKER,
  GROWTH_SHARE_PAGE_PUBLIC_ACCESS_REASONS,
} from "../lib/growth/share-pages/share-page-types"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "../lib/growth/share-pages/share-page-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-2 SSR local regression (${GROWTH_SHARE_PAGES_SSR_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_SSR_QA_MARKER, "share-pages-ssr-sr2b2-v1")
  assert.equal(GROWTH_SHARE_PAGE_PUBLIC_ACCESS_REASONS.length, 7)
  console.log("  ✓ SSR QA marker and access reasons")

  const requiredFiles = [
    "lib/growth/share-pages/share-page-context-service.ts",
    "lib/growth/share-pages/share-page-public-service.ts",
    "lib/growth/share-pages/share-pages-ssr-diagnostics.ts",
    "app/p/[token]/page.tsx",
    "app/p-preview/[token]/page.tsx",
    "components/growth/share-pages/growth-share-page-view.tsx",
    "components/growth/share-pages/growth-share-page-hero.tsx",
    "components/growth/share-pages/growth-share-page-message.tsx",
    "components/growth/share-pages/growth-share-page-observations.tsx",
    "components/growth/share-pages/growth-share-page-cta-section.tsx",
    "components/growth/share-pages/growth-share-page-resources.tsx",
    "components/growth/share-pages/growth-share-page-footer.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-2 module and route files exist")

  const publicRoute = fs.readFileSync(path.join(process.cwd(), "app/p/[token]/page.tsx"), "utf8")
  const previewRoute = fs.readFileSync(path.join(process.cwd(), "app/p-preview/[token]/page.tsx"), "utf8")
  const viewSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-view.tsx"),
    "utf8",
  )

  assert.ok(publicRoute.includes("resolveSharePagePublicRoute"))
  assert.ok(publicRoute.includes("createServiceRoleSupabaseClient"))
  assert.ok(!publicRoute.includes("token_hash"))
  assert.ok(previewRoute.includes("resolveSharePagePreviewRoute"))
  assert.ok(previewRoute.includes('index: false'))
  assert.ok(viewSource.includes("Preview mode"))
  assert.ok(!viewSource.includes("fetch("))
  console.log("  ✓ public/preview routes and read-only view wiring")

  const contextSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-context-service.ts"),
    "utf8",
  )
  assert.ok(contextSource.includes("buildPersonalizationContext"))
  assert.ok(contextSource.includes("computeGrowthLeadNextBestAction"))
  assert.ok(contextSource.includes("runAccountPlaybookEngine"))
  console.log("  ✓ context builder reuses existing intelligence systems")

  const renderModel = mapSharePageToRenderModel(
    {
      id: "page-1",
      organizationId: "org-1",
      leadId: "lead-1",
      companyId: null,
      campaignId: null,
      enrollmentId: null,
      sequenceStepId: null,
      sequenceExecutionJobId: null,
      sourceChannel: "manual",
      status: "draft",
      tokenPrefix: "abcdefgh",
      publishedAt: null,
      expiresAt: null,
      revokedAt: null,
      archivedAt: null,
      firstViewedAt: null,
      lastViewedAt: null,
      maxViews: null,
      engagementSummary: {
        viewCount: 0,
        uniqueSessionCount: 0,
        ctaClickCount: 0,
        bookingStartedCount: 0,
        bookingCompletedCount: 0,
        resourceOpenCount: 0,
        maxScrollDepthPct: 0,
        avgDurationMs: 0,
        lastActivityAt: null,
      },
      personalizationSnapshot: {},
      personalizationContextVersion: 1,
      sourcesUsed: [],
      evidenceCoverageScore: null,
      theme: DEFAULT_GROWTH_SHARE_PAGE_THEME,
      headline: "Test headline",
      subheadline: null,
      heroMessage: "Hello",
      whyReachingOut: "Because",
      companyObservations: ["Signal"],
      ctaConfig: [],
      resources: [],
      bookingPageId: null,
      heroMediaType: "video",
      heroMediaUrl: null,
      heroMediaThumbnailUrl: null,
      voiceAssetId: "voice-1",
      videoAssetId: "video-1",
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
      requiresHumanReview: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { prospectName: "Alex", companyName: "Acme", previewMode: true },
  )

  const serialized = JSON.stringify(renderModel)
  assert.ok(renderModel.previewMode)
  assert.ok(renderModel.heroMediaType === "video")
  assert.ok(!serialized.includes("tokenPrefix"))
  assert.ok(!serialized.includes("token_hash"))
  console.log("  ✓ render model excludes token metadata and preserves media placeholders")

  console.log("\nSR-2B-2 SSR local regression PASS\n")
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
  const { executeGrowthSharePagesSsrDiagnostics } = await import("../lib/growth/share-pages/share-pages-ssr-diagnostics")
  return executeGrowthSharePagesSsrDiagnostics(admin)
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
          qa_marker: GROWTH_SHARE_PAGES_SSR_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:ssr:integration for DB-backed SSR diagnostics",
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
