/**
 * Growth Engine SR-2B-5 — Share page admin UI + operator API certification.
 *
 * Local: pnpm test:growth-share-pages:admin
 * Integration: pnpm test:growth-share-pages:admin:integration
 * Production: pnpm test:growth-share-pages:admin:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SHARE_PAGES_OPERATOR_CONFIRM,
  GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
} from "../lib/growth/share-pages/share-page-operator-types"
import { buildSharePagePreviewUrl, buildSharePagePublicUrl } from "../lib/growth/share-pages/share-page-token"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-2B-5 local regression (${GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER, "share-pages-operator-sr2b5-v1")
  assert.equal(GROWTH_SHARE_PAGES_OPERATOR_CONFIRM, "RUN_GROWTH_SHARE_PAGES_OPERATOR_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "app/api/platform/growth/share-pages/route.ts",
    "app/api/platform/growth/share-pages/[id]/route.ts",
    "app/api/platform/growth/share-pages/[id]/preview/route.ts",
    "app/api/platform/growth/share-pages/[id]/approve/route.ts",
    "app/api/platform/growth/share-pages/[id]/revoke/route.ts",
    "app/api/platform/growth/share-pages/[id]/archive/route.ts",
    "lib/growth/share-pages/share-page-api-schema.ts",
    "lib/growth/share-pages/share-page-operator-service.ts",
    "lib/growth/share-pages/share-page-operator-types.ts",
    "lib/growth/share-pages/share-page-operator-diagnostics.ts",
    "lib/growth/share-pages/share-page-platform-access.ts",
    "components/growth/share-pages/growth-share-pages-admin-panel.tsx",
    "app/(admin)/admin/growth/share-pages/page.tsx",
    "app/(admin)/admin/growth/share-pages/[id]/page.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SR-2B-5 module files exist")

  const nav = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.ok(nav.includes('href: "/admin/growth/share-pages"'))
  assert.ok(nav.includes('id: "share-pages"'))
  console.log("  ✓ Growth nav entry for share pages")

  const commandRegistry = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-command-registry.ts"),
    "utf8",
  )
  assert.ok(commandRegistry.includes('href: "/admin/growth/share-pages"'))
  console.log("  ✓ Command registry entry")

  const listPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/share-pages/page.tsx"),
    "utf8",
  )
  assert.ok(listPage.includes("GrowthSharePagesDashboard"))
  assert.ok(listPage.includes("Share Pages"))
  console.log("  ✓ Admin list route smoke")

  const detailPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/share-pages/[id]/page.tsx"),
    "utf8",
  )
  assert.ok(detailPage.includes("GrowthSharePageDetailPanel"))
  console.log("  ✓ Admin detail route smoke")

  const panel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-pages-admin-panel.tsx"),
    "utf8",
  )
  assert.ok(panel.includes("/api/platform/growth/share-pages"))
  assert.ok(panel.includes("pending review"))
  assert.ok(panel.includes("buildGrowthSharePageContext"))
  assert.ok(panel.includes("Approve / publish"))
  console.log("  ✓ Admin panel API wiring and safety copy")

  const listRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/share-pages/route.ts"),
    "utf8",
  )
  assert.ok(listRoute.includes("requireSharePagePlatformAccess"))
  assert.ok(listRoute.includes("createSharePageForOperator"))
  console.log("  ✓ Platform list/create route auth")

  const previewUrl = buildSharePagePreviewUrl("pv_testtoken1234567890")
  assert.ok(previewUrl.includes("/p-preview/"))
  const publicUrl = buildSharePagePublicUrl("testtoken1234567890")
  assert.ok(publicUrl.includes("/p/"))
  console.log("  ✓ Preview/public URL builders")

  const operatorService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-operator-service.ts"),
    "utf8",
  )
  assert.ok(operatorService.includes("assertNoTokenHashes"))
  assert.ok(operatorService.includes('status: "pending_review"'))
  assert.ok(operatorService.includes("buildGrowthSharePageContext"))
  console.log("  ✓ Operator service safety + create defaults")

  console.log("\nSR-2B-5 local regression PASS\n")
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
  const { executeGrowthSharePageOperatorDiagnostics } = await import(
    "../lib/growth/share-pages/share-page-operator-diagnostics"
  )
  return executeGrowthSharePageOperatorDiagnostics(admin)
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
          qa_marker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
          hint: "Run pnpm test:growth-share-pages:admin:integration for DB-backed cert",
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
