/**
 * Growth workspace shell readiness audit (local only).
 *
 * Usage: pnpm test:growth-workspace-shell
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_SHELL_NAV_GROUPS } from "../components/growth/shell/growth-shell-navigation"
import {
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA_QA_MARKER,
  findGrowthRouteMetadataByPathname,
  getGrowthRouteMetadataById,
} from "../lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_MIGRATED_ROUTE_REGISTRY,
  GROWTH_MIGRATED_WORKSPACE_ROUTES,
  isGrowthWorkspaceMigratedSegment,
  resolveGrowthBreadcrumbs,
} from "../lib/growth/navigation/growth-route-registry"
import { growthFeaturePath } from "../lib/growth/navigation/growth-workspace-base-path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const PHASE_3A_OPERATOR_ROUTES = [
  "workspace-inbox",
  "workspace-meetings",
  "workspace-calls",
  "workspace-media",
] as const

const PHASE_3B_OPERATOR_ROUTES = ["workspace-leads", "workspace-campaigns"] as const

const PHASE_3C_OPERATOR_SUB_ROUTES = [
  "workspace-calls-live",
  "workspace-calls-coaching",
  "workspace-calls-voice-drops",
  "workspace-leads-crm",
  "workspace-leads-queue",
  "workspace-leads-captured",
  "workspace-leads-lead-engine",
  "workspace-leads-detail",
] as const

const PHASE_4A_OPERATOR_ROUTES = ["workspace-inbox-workflow"] as const

const PHASE_4B_OPERATOR_ROUTES = [
  "workspace-opportunities",
  "workspace-opportunities-pipeline",
  "workspace-opportunities-workspace",
] as const

const PHASE_4C_OPERATOR_ROUTES = ["workspace-conversations", "workspace-relationships"] as const

const PHASE_4_OPERATOR_ROUTES = [
  ...PHASE_3A_OPERATOR_ROUTES,
  ...PHASE_3B_OPERATOR_ROUTES,
  ...PHASE_3C_OPERATOR_SUB_ROUTES,
  ...PHASE_4A_OPERATOR_ROUTES,
  ...PHASE_4B_OPERATOR_ROUTES,
  ...PHASE_4C_OPERATOR_ROUTES,
] as const

function workspacePagePathFromMetadata(entryPath: string): string | null {
  if (entryPath === "/growth") {
    return path.join(ROOT, "app/(growth)/growth/page.tsx")
  }
  if (!entryPath.startsWith("/growth/")) return null
  const relative = entryPath.slice("/growth/".length)
  return path.join(ROOT, "app/(growth)/growth", relative, "page.tsx")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace shell audit (${GROWTH_ROUTE_METADATA_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MIGRATED_ROUTE_REGISTRY.length, GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length)
  assert.equal(GROWTH_MIGRATED_ROUTE_REGISTRY.length, 65)
  assert.deepEqual(GROWTH_MIGRATED_WORKSPACE_ROUTES, GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.path))
  console.log("  ✓ migrated workspace registry subset (65 routes)")

  const paths = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.path)
  const ids = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.id)
  assert.equal(new Set(paths).size, paths.length, "duplicate migrated workspace paths detected")
  assert.equal(new Set(ids).size, ids.length, "duplicate migrated workspace ids detected")
  console.log("  ✓ no duplicate migrated workspace paths or ids")

  for (const routeId of PHASE_4_OPERATOR_ROUTES) {
    const entry = getGrowthRouteMetadataById(routeId)
    assert.ok(entry, `Phase 3 operator route missing: ${routeId}`)
    assert.equal(entry.migrationStatus, "dual-route", `${routeId} must be dual-route`)
    assert.equal(entry.placeholder, false, `${routeId} must not be placeholder`)
    assert.equal(entry.migrated, true, `${routeId} must be migrated`)
    assert.ok(entry.adminPath, `${routeId} must retain adminPath fallback`)
    const pageFile = workspacePagePathFromMetadata(entry.path)
    assert.ok(pageFile && fs.existsSync(pageFile), `missing workspace page for ${entry.path}`)
  }
  console.log("  ✓ Phase 3 operator routes are dual-route with real workspace pages")

  for (const entry of GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA) {
    const segmentCheck = entry.segment ?? ""
    assert.equal(
      isGrowthWorkspaceMigratedSegment(segmentCheck),
      true,
      `segment not migrated: ${entry.segment || "(dashboard)"}`,
    )

    const crumbs = resolveGrowthBreadcrumbs(entry.path)
    assert.ok(crumbs.length >= 1, `breadcrumb missing for ${entry.path}`)
    assert.equal(crumbs[0]?.label, "Growth")

    if (entry.dynamicMatch) {
      const sample = entry.path
        .replace("/growth/", "")
        .replace("[id]", "sample-id")
      assert.ok(entry.dynamicMatch.test(sample), `dynamic sample failed for ${entry.path}`)
      assert.equal(findGrowthRouteMetadataByPathname(`/growth/${sample}`)?.id, entry.id)
    }

    if (!entry.placeholder) {
      const pageFile = workspacePagePathFromMetadata(entry.path)
      assert.ok(pageFile && fs.existsSync(pageFile), `missing workspace page file for ${entry.path}`)
    }
  }
  console.log("  ✓ migrated segments, breadcrumbs, and page files")

  for (const segment of [
    "share-pages/page-1",
    "share-pages/templates/new",
    "share-pages/templates/template-1",
    "share-pages/templates/template-1/preview",
    "automation/flow-1",
    "inbox",
    "meetings",
    "calls",
    "media",
    "leads",
    "campaigns",
    "calls/live",
    "calls/coaching",
    "calls/voice-drops",
    "leads/crm",
    "leads/queue",
    "leads/captured",
    "leads/lead-engine",
  ]) {
    const resolved = growthFeaturePath("/growth/share-pages", segment)
    assert.ok(resolved.startsWith("/growth/"), `workspace segment fell back to admin: ${segment} -> ${resolved}`)
  }
  console.log("  ✓ migrated feature paths remain under /growth")

  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/templates/new")?.id, "workspace-share-pages-templates-new")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/templates/tpl-1")?.id, "workspace-share-pages-templates-edit")
  assert.equal(
    findGrowthRouteMetadataByPathname("/growth/share-pages/templates/tpl-1/preview")?.id,
    "workspace-share-pages-templates-preview",
  )
  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/templates")?.id, "workspace-share-pages-templates")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/share-pages/workspace")?.id, "workspace-share-pages-workspace")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/automation/new")?.id, "workspace-automation-new")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/automation/flow-1")?.id, "workspace-automation-edit")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/media")?.id, "workspace-media")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/leads")?.id, "workspace-leads")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/leads/crm")?.id, "workspace-leads-crm")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/leads/sample-lead")?.id, "workspace-leads-detail")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/calls/live")?.id, "workspace-calls-live")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/campaigns")?.id, "workspace-campaigns")
  console.log("  ✓ static routes beat dynamic routes")

  const placeholders = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.filter((row) => row.placeholder)
  assert.equal(placeholders.length, 0)
  console.log("  ✓ no placeholder-only workspace routes remain after Phase 7C settings shell")

  const workspaceNavHrefs = GROWTH_SHELL_NAV_GROUPS.flatMap((group) =>
    group.items.filter((item) => item.workspaceRoute).map((item) => item.href),
  )
  for (const href of workspaceNavHrefs) {
    assert.ok(
      GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.some(
        (entry) => entry.path === href || href.startsWith(`${entry.path}/`),
      ),
      `workspace nav href missing migrated metadata: ${href}`,
    )
  }

  const mediaNav = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === "media-assets")
  assert.ok(mediaNav)
  assert.equal(mediaNav.href, "/growth/media")

  const intelligenceNav = GROWTH_SHELL_NAV_GROUPS.find((group) => group.id === "intelligence")
  assert.ok(intelligenceNav)
  const intelligenceIds = intelligenceNav.items.map((item) => item.id)
  assert.deepEqual(intelligenceIds, ["opportunities", "conversations", "relationships"])
  assert.ok(!GROWTH_SHELL_NAV_GROUPS.some((group) => group.id === "settings"), "settings group must not appear in workspace sidebar")
  assert.equal(
    intelligenceNav.items.find((item) => item.id === "opportunities")?.href,
    "/growth/opportunities",
  )
  assert.equal(
    intelligenceNav.items.find((item) => item.id === "conversations")?.href,
    "/growth/conversations",
  )
  console.log("  ✓ sidebar workspace nav coverage; operator-only IA (Phase 5A)")

  const inboxDiagnostics = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-inbox-diagnostics")
  assert.ok(inboxDiagnostics?.hidden)
  const callsProviders = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-calls-providers")
  assert.equal(callsProviders?.migrationStatus, "admin-only")
  console.log("  ✓ inbox diagnostics and call providers remain admin-only")

  console.log("\nGrowth workspace shell audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_ROUTE_METADATA_QA_MARKER,
        migrated_routes: GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length,
        placeholder_routes: placeholders.length,
        total_registry_routes: 147,
        workspace_nav_items: workspaceNavHrefs.length,
        phase_4a_operator_routes: PHASE_4A_OPERATOR_ROUTES,
        phase_4b_operator_routes: PHASE_4B_OPERATOR_ROUTES,
        phase_4c_operator_routes: PHASE_4C_OPERATOR_ROUTES,
        phase_4_operator_routes: PHASE_4_OPERATOR_ROUTES,
        phase_3c_sub_routes: PHASE_3C_OPERATOR_SUB_ROUTES,
      },
      null,
      2,
    ),
  )
}

runAudit()
