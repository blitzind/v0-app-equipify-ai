/**
 * S1-B — Share Page Template foundation certification.
 *
 * Local: pnpm test:growth-share-page-templates
 * Integration: pnpm test:growth-share-page-templates:integration
 * Production: pnpm test:growth-share-page-templates:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  bootstrapGrowthSharePageTemplatesCertEnv,
  describeSharePageTemplatesCertBootstrapFailure,
} from "../lib/growth/share-pages/share-page-template-cert-bootstrap"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES,
} from "../lib/growth/share-pages/share-page-template-block-types"
import {
  canArchiveSharePageTemplate,
  canEditSharePageTemplateVersion,
  canPublishSharePageTemplate,
  GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM,
  GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
  GROWTH_SHARE_PAGE_TEMPLATE_STATUSES,
} from "../lib/growth/share-pages/share-page-template-types"

const MODULE_PATHS = [
  "supabase/migrations/20270827120500_growth_share_page_templates_s1b.sql",
  "lib/growth/share-pages/share-page-template-types.ts",
  "lib/growth/share-pages/share-page-template-block-types.ts",
  "lib/growth/share-pages/share-page-template-repository.ts",
  "lib/growth/share-pages/share-page-template-schema-health.ts",
  "lib/growth/share-pages/share-page-template-platform-access.ts",
  "lib/growth/share-pages/share-page-template-diagnostics.ts",
  "lib/growth/share-pages/share-page-template-production-diagnostics.ts",
  "lib/growth/share-pages/share-page-template-cert-bootstrap.ts",
  "app/api/platform/growth/share-pages/templates/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/publish/route.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== S1-B local regression (${GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER, "growth-share-page-templates-s1-v1")
  assert.equal(GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM, "RUN_GROWTH_SHARE_PAGE_TEMPLATES_CERTIFICATION")
  assert.equal(GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION, "20270827120500_growth_share_page_templates_s1b.sql")
  assert.deepEqual([...GROWTH_SHARE_PAGE_TEMPLATE_STATUSES], ["draft", "published", "archived"])
  assert.equal(GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES.length, 10)
  console.log("  ✓ QA marker, statuses, and block types")

  for (const relativePath of MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S1-B module files exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827120500_growth_share_page_templates_s1b.sql"),
    "utf8",
  )
  for (const indexName of [
    "idx_growth_share_page_templates_organization",
    "idx_growth_share_page_templates_status",
    "idx_growth_share_page_templates_category",
    "idx_growth_share_page_templates_tags",
    "idx_growth_share_page_template_versions_template",
  ]) {
    assert.ok(migration.includes(indexName), `Missing index in migration: ${indexName}`)
  }
  assert.ok(migration.includes("requires_human_review boolean not null default true"))
  assert.ok(migration.includes("blocks_json jsonb"))
  assert.ok(migration.includes("theme_json jsonb"))
  console.log("  ✓ migration indexes and JSON columns")

  assert.equal(canEditSharePageTemplateVersion(false), true)
  assert.equal(canEditSharePageTemplateVersion(true), false)
  assert.equal(canPublishSharePageTemplate("draft"), true)
  assert.equal(canPublishSharePageTemplate("archived"), false)
  assert.equal(canArchiveSharePageTemplate("published"), true)
  assert.equal(canArchiveSharePageTemplate("archived"), false)
  console.log("  ✓ lifecycle helpers")

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-repository.ts"),
    "utf8",
  )
  for (const fn of [
    "createTemplate",
    "updateTemplate",
    "archiveTemplate",
    "duplicateTemplate",
    "getTemplate",
    "listTemplates",
    "createVersion",
    "getCurrentVersion",
    "publishVersion",
  ]) {
    assert.ok(repositorySource.includes(`export async function ${fn}`), `Missing repository fn: ${fn}`)
  }
  console.log("  ✓ repository surface area")

  const listRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/share-pages/templates/route.ts"),
    "utf8",
  )
  assert.ok(listRoute.includes("requireSharePageTemplatePlatformAccess"))
  assert.ok(listRoute.includes("createTemplate"))
  console.log("  ✓ Platform list/create route auth")

  const publishRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/share-pages/templates/[id]/publish/route.ts"),
    "utf8",
  )
  assert.ok(publishRoute.includes("no_live_page_publish: true"))
  console.log("  ✓ Publish route preserves no-live-page guard")

  console.log("\nS1-B local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_SHARE_PAGE_TEMPLATES_CERT_ALLOW_LOCAL =
    process.env.GROWTH_SHARE_PAGE_TEMPLATES_CERT_ALLOW_LOCAL ?? "1"

  const boot = bootstrapGrowthSharePageTemplatesCertEnv()
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthSharePageTemplatesDiagnostics } = await import(
    "../lib/growth/share-pages/share-page-template-diagnostics"
  )
  return executeGrowthSharePageTemplatesDiagnostics(admin)
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthSharePageTemplatesCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return describeSharePageTemplatesCertBootstrapFailure({ requireVercelProductionEnvRun: true })
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthSharePageTemplatesProductionDiagnostics } = await import(
    "../lib/growth/share-pages/share-page-template-production-diagnostics"
  )
  return executeGrowthSharePageTemplatesProductionDiagnostics(admin)
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")
  const integration = process.argv.includes("--integration") || production
  runLocalRegression()

  if (!integration) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
          hint: "Run pnpm test:growth-share-page-templates:integration after applying migration",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = production ? await runProductionDiagnostics() : await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
