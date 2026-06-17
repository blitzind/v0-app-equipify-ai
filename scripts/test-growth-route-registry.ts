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

  assert.equal(GROWTH_ROUTE_CATALOG_INPUTS.length, 147, "catalog must define 147 routes")
  assert.equal(GROWTH_ROUTE_METADATA.length, 147, "metadata must define 147 routes")
  console.log("  ✓ 147 routes registered")

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
  assert.equal(discoveredPaths.length, 147, "expected 147 Growth page.tsx routes on disk")
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

  assert.equal(GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length, 52)
  assert.equal(getMigratedRoutes().length, 52)
  console.log("  ✓ migrated workspace route count (52 routes)")

  assert.equal(getPlaceholderRoutes().length, 0, "Phase 7C settings shell removed placeholder-only workspace routes")
  console.log("  ✓ no placeholder-only workspace routes remain")

  const workspaceLeads = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "workspace-leads")
  assert.ok(workspaceLeads)
  assert.equal(workspaceLeads.path, `${GROWTH_WORKSPACE_BASE_PATH}/leads`)
  assert.equal(workspaceLeads.adminPath, `${GROWTH_ADMIN_BASE_PATH}/queue`)
  assert.equal(workspaceLeads.migrationStatus, "dual-route")

  const workspaceCampaigns = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "workspace-campaigns")
  assert.ok(workspaceCampaigns)
  assert.equal(workspaceCampaigns.path, `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`)
  assert.equal(workspaceCampaigns.adminPath, `${GROWTH_ADMIN_BASE_PATH}/multichannel`)
  assert.equal(workspaceCampaigns.migrationStatus, "dual-route")
  console.log("  ✓ Phase 3B leads/campaigns dual-route with admin fallbacks")

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

  const phase3CWorkspaceRoutes = [
    "workspace-calls-live",
    "workspace-calls-coaching",
    "workspace-calls-voice-drops",
    "workspace-leads-crm",
    "workspace-leads-queue",
    "workspace-leads-captured",
    "workspace-leads-lead-engine",
    "workspace-leads-detail",
  ] as const
  for (const routeId of phase3CWorkspaceRoutes) {
    const entry = GROWTH_ROUTE_METADATA.find((row) => row.id === routeId)
    assert.ok(entry, `Phase 3C workspace route missing: ${routeId}`)
    assert.equal(entry.migrationStatus, "dual-route", `${routeId} must be dual-route`)
    assert.equal(entry.migrated, true, `${routeId} must be migrated`)
    assert.ok(entry.adminPath, `${routeId} must retain adminPath fallback`)
  }
  assert.equal(findGrowthRouteMetadataByPathname("/growth/leads/crm")?.id, "workspace-leads-crm")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/leads/sample-lead")?.id, "workspace-leads-detail")
  console.log("  ✓ Phase 3C operator sub-routes dual-route; static lead routes beat dynamic detail")

  const searchRoute = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-search")
  assert.ok(searchRoute)
  assert.equal(searchRoute.migrationStatus, "admin-only")
  const sequencesRoute = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-sequences")
  assert.ok(sequencesRoute)
  assert.equal(sequencesRoute.migrationStatus, "admin-only")
  console.log("  ✓ search/imports/acquisition and sequences remain admin-only")

  const workspaceInboxWorkflow = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "workspace-inbox-workflow")
  assert.ok(workspaceInboxWorkflow)
  assert.equal(workspaceInboxWorkflow.path, `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`)
  assert.equal(workspaceInboxWorkflow.adminPath, `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`)
  assert.equal(workspaceInboxWorkflow.migrationStatus, "dual-route")
  assert.equal(workspaceInboxWorkflow.migrated, true)
  assert.equal(workspaceInboxWorkflow.section, "workspace")

  const adminRepliesWorkflow = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-replies-workflow")
  assert.ok(adminRepliesWorkflow)
  assert.equal(adminRepliesWorkflow.migrationStatus, "dual-route")
  assert.equal(adminRepliesWorkflow.workspacePath, `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`)
  assert.equal(findGrowthRouteMetadataByPathname("/growth/inbox/workflow")?.id, "workspace-inbox-workflow")
  console.log("  ✓ Phase 4A reply workflow dual-route; admin replies intelligence dashboard remains admin-only")

  const adminReplies = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-replies")
  assert.ok(adminReplies)
  assert.equal(adminReplies.migrationStatus, "admin-only")

  const phase4BWorkspaceRoutes = [
    "workspace-opportunities",
    "workspace-opportunities-pipeline",
    "workspace-opportunities-workspace",
  ] as const
  for (const routeId of phase4BWorkspaceRoutes) {
    const entry = GROWTH_ROUTE_METADATA.find((row) => row.id === routeId)
    assert.ok(entry, `Phase 4B workspace route missing: ${routeId}`)
    assert.equal(entry.migrationStatus, "dual-route", `${routeId} must be dual-route`)
    assert.equal(entry.migrated, true, `${routeId} must be migrated`)
    assert.ok(entry.adminPath, `${routeId} must retain adminPath fallback`)
  }
  assert.equal(findGrowthRouteMetadataByPathname("/growth/opportunities/pipeline")?.id, "workspace-opportunities-pipeline")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/opportunities/workspace")?.id, "workspace-opportunities-workspace")

  const adminOpportunityIntelligence = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-opportunity-intelligence")
  assert.ok(adminOpportunityIntelligence)
  assert.equal(adminOpportunityIntelligence.migrationStatus, "admin-only")
  console.log("  ✓ Phase 4B opportunities dual-route; opportunity-intelligence remains admin-only")

  const phase4CWorkspaceRoutes = ["workspace-conversations", "workspace-relationships"] as const
  for (const routeId of phase4CWorkspaceRoutes) {
    const entry = GROWTH_ROUTE_METADATA.find((row) => row.id === routeId)
    assert.ok(entry, `Phase 4C workspace route missing: ${routeId}`)
    assert.equal(entry.migrationStatus, "dual-route", `${routeId} must be dual-route`)
    assert.equal(entry.migrated, true, `${routeId} must be migrated`)
    assert.equal(entry.section, "intelligence", `${routeId} must be intelligence section`)
    assert.ok(entry.adminPath, `${routeId} must retain adminPath fallback`)
  }
  assert.equal(findGrowthRouteMetadataByPathname("/growth/conversations")?.id, "workspace-conversations")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/relationships")?.id, "workspace-relationships")

  const adminRevenueExecution = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-revenue-execution")
  assert.ok(adminRevenueExecution)
  assert.equal(adminRevenueExecution.migrationStatus, "admin-only")
  console.log("  ✓ Phase 4C conversations/relationships dual-route; replies/revenue execution remain admin-only")

  const report = buildGrowthRouteRegistryReport()
  assert.equal(report.totalRoutes, 147)
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
