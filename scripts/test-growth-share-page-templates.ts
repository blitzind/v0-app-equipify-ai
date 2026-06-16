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
  GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER,
} from "../lib/growth/share-pages/share-page-template-editor-utils"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER,
  summarizeSharePageTemplateVersionDiff,
} from "../lib/growth/share-pages/share-page-template-version-diff"
import {
  canArchiveSharePageTemplate,
  canEditSharePageTemplateVersion,
  canPublishSharePageTemplate,
  canUnpublishSharePageTemplate,
  GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM,
  GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
  GROWTH_SHARE_PAGE_TEMPLATE_STATUSES,
  hasUnpublishedSharePageTemplateDraft,
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

const S1D_MODULE_PATHS = [
  "lib/growth/share-pages/share-page-template-version-diff.ts",
  "app/api/platform/growth/share-pages/templates/[id]/unpublish/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/duplicate/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/[versionId]/restore/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/[versionId]/duplicate/route.ts",
  "components/growth/share-pages/templates/growth-share-page-template-version-timeline.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-version-card.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-publish-dialog.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-version-diff.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-version-actions.tsx",
] as const

const S1C_MODULE_PATHS = [
  "app/(admin)/admin/growth/share-pages/templates/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/new/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/[id]/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/[id]/preview/page.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-library.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-card.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-editor.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-section-palette.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-canvas.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-section-editor.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-settings-panel.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-preview-renderer.tsx",
  "lib/growth/share-pages/share-page-template-editor-utils.ts",
  "lib/growth/share-pages/share-page-template-render-model.ts",
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
    "unpublishTemplate",
    "restoreVersion",
    "duplicateVersion",
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

  assert.equal(GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER, "growth-share-page-template-editor-s1c-v1")
  for (const relativePath of S1C_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  const nav = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.ok(nav.includes('href: "/admin/growth/share-pages/templates"'))
  assert.ok(nav.includes('id: "share-page-templates"'))
  console.log("  ✓ S1-C editor UI modules and navigation")

  const librarySource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-library.tsx"),
    "utf8",
  )
  assert.ok(librarySource.includes("sortTemplates"))
  assert.ok(librarySource.includes('params.set("search"'))
  assert.ok(librarySource.includes("duplicateTemplate"))
  console.log("  ✓ library list/search/filter/sort/duplicate/archive wiring")

  const editorSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-editor.tsx"),
    "utf8",
  )
  assert.ok(editorSource.includes("Unsaved changes"))
  assert.ok(editorSource.includes("GrowthSharePageTemplateCanvas"))
  assert.ok(editorSource.includes("GrowthSharePageTemplateSettingsPanel"))
  assert.ok(editorSource.includes("No live share page was published"))
  console.log("  ✓ editor shell, canvas, settings, publish guard copy")

  const canvasSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-canvas.tsx"),
    "utf8",
  )
  assert.ok(canvasSource.includes("onMove"))
  assert.ok(canvasSource.includes("onRemove"))
  assert.ok(canvasSource.includes("enabled"))
  console.log("  ✓ canvas add/remove/reorder/enable wiring")

  const sectionEditorSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-section-editor.tsx"),
    "utf8",
  )
  assert.ok(sectionEditorSource.includes("MergeFieldHints"))
  assert.ok(sectionEditorSource.includes("video_placeholder"))
  assert.ok(sectionEditorSource.includes("voice_placeholder"))
  assert.ok(sectionEditorSource.includes("media_cta_placeholder"))
  console.log("  ✓ section editors + merge-field hints + placeholder blocks")

  const previewSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-preview-renderer.tsx"),
    "utf8",
  )
  assert.ok(previewSource.includes("GrowthSharePageView"))
  assert.ok(previewSource.includes("VIEWPORT_WIDTH"))
  assert.ok(previewSource.includes("extraBlocks"))
  console.log("  ✓ preview renderer viewports + placeholder panels")

  assert.equal(GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER, "growth-share-page-template-versioning-s1d-v1")
  for (const relativePath of S1D_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  assert.equal(canUnpublishSharePageTemplate("published"), true)
  assert.equal(canUnpublishSharePageTemplate("draft"), false)
  assert.equal(
    hasUnpublishedSharePageTemplateDraft({
      id: "t1",
      organizationId: "o1",
      createdBy: null,
      name: "Test",
      description: "",
      category: "general",
      tags: [],
      previewImageUrl: null,
      status: "published",
      publishedAt: null,
      archivedAt: null,
      currentVersionId: "v2",
      publishedVersionId: "v1",
      requiresHumanReview: true,
      qaMarker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
      currentVersion: {
        id: "v2",
        templateId: "t1",
        versionNumber: 2,
        status: "draft",
        blocks: [],
        theme: {
          brandColor: "#000",
          accentColor: "#111",
          logoUrl: null,
          heroImageUrl: null,
          publicThemeMode: "system",
          footerNote: null,
        },
        defaultBookingPageId: null,
        mergeFieldsUsed: [],
        changeSummary: "",
        isImmutable: false,
        createdBy: null,
        publishedBy: null,
        publishedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      publishedVersion: {
        id: "v1",
        templateId: "t1",
        versionNumber: 1,
        status: "published",
        blocks: [],
        theme: {
          brandColor: "#000",
          accentColor: "#111",
          logoUrl: null,
          heroImageUrl: null,
          publicThemeMode: "system",
          footerNote: null,
        },
        defaultBookingPageId: null,
        mergeFieldsUsed: [],
        changeSummary: "",
        isImmutable: true,
        createdBy: null,
        publishedBy: null,
        publishedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      versionCount: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    true,
  )
  const diff = summarizeSharePageTemplateVersionDiff({
    before: {
      id: "v1",
      templateId: "t1",
      versionNumber: 1,
      status: "published",
      blocks: [{ id: "b1", type: "hero", order: 0, headline: "Hi", subheadline: null, heroMessage: "", heroMediaType: "none", heroMediaUrl: null, heroMediaThumbnailUrl: null }],
      theme: {
        brandColor: "#000",
        accentColor: "#111",
        logoUrl: null,
        heroImageUrl: null,
        publicThemeMode: "system",
        footerNote: null,
      },
      defaultBookingPageId: null,
      mergeFieldsUsed: ["lead.contact_name"],
      changeSummary: "Initial",
      isImmutable: true,
      createdBy: null,
      publishedBy: null,
      publishedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    after: {
      id: "v2",
      templateId: "t1",
      versionNumber: 2,
      status: "draft",
      blocks: [
        { id: "b1", type: "hero", order: 0, headline: "Hi", subheadline: null, heroMessage: "", heroMediaType: "none", heroMediaUrl: null, heroMediaThumbnailUrl: null },
        { id: "b2", type: "text", order: 1, heading: "Why", body: "Body" },
      ],
      theme: {
        brandColor: "#222",
        accentColor: "#111",
        logoUrl: null,
        heroImageUrl: null,
        publicThemeMode: "system",
        footerNote: null,
      },
      defaultBookingPageId: null,
      mergeFieldsUsed: ["lead.contact_name", "company.name"],
      changeSummary: "Updated",
      isImmutable: false,
      createdBy: null,
      publishedBy: null,
      publishedAt: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  })
  assert.equal(diff.blockCountDelta, 1)
  assert.equal(diff.themeChanged, true)
  assert.deepEqual(diff.mergeFieldsAdded, ["company.name"])
  console.log("  ✓ S1-D versioning helpers, diff summaries, and module files")

  const editorVersionSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-editor.tsx"),
    "utf8",
  )
  assert.ok(editorVersionSource.includes("GrowthSharePageTemplateVersionTimeline"))
  assert.ok(editorVersionSource.includes("GrowthSharePageTemplatePublishDialog"))
  assert.ok(editorVersionSource.includes("Save as new version"))
  assert.ok(editorVersionSource.includes("/unpublish"))
  console.log("  ✓ editor version panel + publish dialog + workflow actions")

  const cardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-card.tsx"),
    "utf8",
  )
  assert.ok(cardSource.includes("versionCount"))
  assert.ok(cardSource.includes("Last published"))
  console.log("  ✓ library card version metadata badges")

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
