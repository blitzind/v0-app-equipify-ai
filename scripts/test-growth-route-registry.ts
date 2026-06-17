/**
 * Canonical Growth route registry audit (local only).
 *
 * Usage: pnpm test:growth-route-registry
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_ORPHAN_ROUTE_IDS,
  GROWTH_ROUTE_CATALOG_INPUTS,
} from "../lib/growth/navigation/growth-route-catalog-data"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA_QA_MARKER,
  GROWTH_ROUTE_MIGRATION_STATUSES,
  GROWTH_ROUTE_SECTIONS,
  GROWTH_WORKSPACE_BASE_PATH,
  findGrowthRouteMetadataByAnyPath,
  findGrowthRouteMetadataByPathname,
} from "../lib/growth/navigation/growth-route-metadata"
import {
  buildGrowthRouteRegistryReport,
  getAdminOnlyRoutes,
  getAutomationRoutes,
  getContentRoutes,
  getDeprecatedRoutes,
  getDualRouteEntries,
  getHiddenRoutes,
  getIntelligenceRoutes,
  getMigratedRoutes,
  getPlaceholderRoutes,
  getSettingsRoutes,
  getSystemRoutes,
  getWorkspaceRoutes,
} from "../lib/growth/navigation/growth-route-registry-reports"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function collectPageFiles(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return []
  const results: string[] = []

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") results.push(full)
    }
  }

  walk(baseDir)
  return results
}

function routePathFromPageFile(pageFile: string): string {
  const normalized = pageFile.split(path.sep).join("/")
  if (normalized.includes("app/(admin)/admin/growth/")) {
    const relative = normalized.split("app/(admin)/admin/growth/")[1] ?? ""
    if (!relative || relative === "page.tsx") return GROWTH_ADMIN_BASE_PATH
    return `${GROWTH_ADMIN_BASE_PATH}/${relative.replace(/\/page\.tsx$/, "")}`
  }
  if (normalized.includes("app/(growth)/growth/")) {
    const relative = normalized.split("app/(growth)/growth/")[1] ?? ""
    if (!relative || relative === "page.tsx") return GROWTH_WORKSPACE_BASE_PATH
    return `${GROWTH_WORKSPACE_BASE_PATH}/${relative.replace(/\/page\.tsx$/, "")}`
  }
  throw new Error(`unexpected page file location: ${pageFile}`)
}

function discoverGrowthPageRoutePaths(): string[] {
  const adminPages = collectPageFiles(path.join(ROOT, "app/(admin)/admin/growth"))
  const workspacePages = collectPageFiles(path.join(ROOT, "app/(growth)/growth"))
  return [...adminPages, ...workspacePages].map(routePathFromPageFile).sort()
}

function runAudit(): void {
  console.log(`\n=== Growth route registry audit (${GROWTH_ROUTE_METADATA_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ROUTE_CATALOG_INPUTS.length, 113, "catalog must define 113 routes")
  assert.equal(GROWTH_ROUTE_METADATA.length, 113, "metadata must define 113 routes")
  console.log("  ✓ 113 routes registered")

  const ids = GROWTH_ROUTE_METADATA.map((entry) => entry.id)
  const paths = GROWTH_ROUTE_METADATA.map((entry) => entry.path)
  assert.equal(new Set(ids).size, ids.length, "duplicate route ids detected")
  assert.equal(new Set(paths).size, paths.length, "duplicate route paths detected")
  console.log("  ✓ unique ids and paths")

  const adminPaths = GROWTH_ROUTE_METADATA.map((entry) => entry.adminPath).filter(Boolean) as string[]
  assert.equal(new Set(adminPaths).size, adminPaths.length, "duplicate adminPath values detected")
  console.log("  ✓ unique adminPath values")

  for (const section of GROWTH_ROUTE_SECTIONS) {
    assert.ok(
      GROWTH_ROUTE_METADATA.some((entry) => entry.section === section),
      `missing section coverage: ${section}`,
    )
  }
  console.log("  ✓ all IA sections represented")

  for (const status of GROWTH_ROUTE_MIGRATION_STATUSES) {
    assert.ok(
      GROWTH_ROUTE_METADATA.some((entry) => entry.migrationStatus === status),
      `missing migration status coverage: ${status}`,
    )
  }
  console.log("  ✓ all migration statuses represented")

  for (const orphanId of GROWTH_ORPHAN_ROUTE_IDS) {
    assert.ok(
      GROWTH_ROUTE_METADATA.some((entry) => entry.id === orphanId),
      `orphan route missing from registry: ${orphanId}`,
    )
  }
  console.log("  ✓ orphan routes explicitly registered")

  const discoveredPaths = discoverGrowthPageRoutePaths()
  assert.equal(discoveredPaths.length, 113, "expected 113 Growth page.tsx routes on disk")
  for (const discovered of discoveredPaths) {
    assert.ok(findGrowthRouteMetadataByAnyPath(discovered), `undocumented page route: ${discovered}`)
  }
  for (const entry of GROWTH_ROUTE_METADATA) {
    assert.ok(discoveredPaths.includes(entry.path), `registry route missing page file: ${entry.path}`)
  }
  console.log("  ✓ registry matches all discovered page files (no undocumented routes)")

  for (const entry of GROWTH_ROUTE_METADATA.filter((row) => row.dynamicMatch)) {
    const sample = entry.path
      .replace(`${GROWTH_WORKSPACE_BASE_PATH}/`, "")
      .replace("[id]", "sample-id")
      .replace("[leadId]", "sample-lead")
      .replace("[batchId]", "sample-batch")
      .replace("[runId]", "sample-run")
      .replace("[enrollmentId]", "sample-enrollment")
    assert.ok(entry.dynamicMatch?.test(sample), `dynamicMatch sample failed for ${entry.path}`)
  }
  console.log("  ✓ dynamicMatch patterns valid")

  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/templates/new")?.id, "workspace-share-pages-templates-new")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/templates/tpl-1")?.id, "workspace-share-pages-templates-edit")
  assert.equal(
    findGrowthRouteMetadataByPathname("/growth/share-pages/templates/tpl-1/preview")?.id,
    "workspace-share-pages-templates-preview",
  )
  assert.equal(findGrowthRouteMetadataByPathname("/growth/automation/new")?.id, "workspace-automation-new")
  console.log("  ✓ static workspace routes beat dynamic routes")

  for (const entry of GROWTH_ROUTE_METADATA) {
    if (entry.placeholder) assert.equal(entry.migrationStatus, "placeholder")
    if (entry.hidden) assert.equal(entry.migrationStatus, "hidden")
    if (entry.migrationStatus === "dual-route" && entry.path.startsWith("/growth")) {
      assert.ok(entry.adminPath, `dual-route workspace entry missing adminPath: ${entry.id}`)
      assert.equal(entry.migrated, true)
    }
    if (entry.migrationStatus === "dual-route" && entry.path.startsWith("/admin/growth")) {
      assert.ok(entry.workspacePath, `dual-route admin entry missing workspacePath: ${entry.id}`)
    }
  }
  console.log("  ✓ migration flags consistent")

  assert.equal(GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length, 18)
  assert.equal(getMigratedRoutes().length, 18)
  console.log("  ✓ migrated workspace route count (18 routes)")

  assert.equal(getPlaceholderRoutes().length, 3, "expected 3 placeholder workspace routes (leads, campaigns, settings)")
  console.log("  ✓ placeholder workspace routes reduced to leads/campaigns/settings")

  const inboxDiagnostics = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-inbox-diagnostics")
  assert.ok(inboxDiagnostics)
  assert.equal(inboxDiagnostics.migrationStatus, "hidden")
  assert.equal(inboxDiagnostics.path, `${GROWTH_ADMIN_BASE_PATH}/inbox/diagnostics`)

  const callsProviders = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-calls-providers")
  assert.ok(callsProviders)
  assert.equal(callsProviders.migrationStatus, "admin-only")

  const workspaceMedia = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "workspace-media")
  assert.ok(workspaceMedia)
  assert.equal(workspaceMedia.path, `${GROWTH_WORKSPACE_BASE_PATH}/media`)
  assert.equal(workspaceMedia.adminPath, `${GROWTH_ADMIN_BASE_PATH}/copilot/content-library`)
  assert.equal(workspaceMedia.migrationStatus, "dual-route")
  console.log("  ✓ Phase 3A operator routes dual-route; diagnostics/providers remain admin-only")

  const report = buildGrowthRouteRegistryReport()
  assert.equal(report.totalRoutes, 113)
  assert.equal(getWorkspaceRoutes().length, report.bySection.workspace)
  assert.equal(getContentRoutes().length, report.bySection.content)
  assert.equal(getAutomationRoutes().length, report.bySection.automation)
  assert.equal(getIntelligenceRoutes().length, report.bySection.intelligence)
  assert.equal(getSettingsRoutes().length, report.bySection.settings)
  assert.equal(getSystemRoutes().length, report.bySection.system)
  assert.equal(getAdminOnlyRoutes().length, report.adminOnlyRoutes)
  assert.equal(getDualRouteEntries().length, report.byMigrationStatus["dual-route"])
  assert.equal(getPlaceholderRoutes().length, report.placeholderRoutes)
  assert.equal(getHiddenRoutes().length, report.hiddenRoutes)
  assert.equal(getDeprecatedRoutes().length, report.deprecatedRoutes)
  console.log("  ✓ report helpers align with registry")

  console.log("\nGrowth route registry audit PASS\n")
  console.log(JSON.stringify({ ok: true, qa_marker: GROWTH_ROUTE_METADATA_QA_MARKER, report }, null, 2))
}

runAudit()
