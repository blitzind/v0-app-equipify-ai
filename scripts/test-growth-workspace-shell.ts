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
  GROWTH_ROUTE_METADATA_QA_MARKER,
  findGrowthRouteMetadataByPathname,
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
  assert.equal(GROWTH_MIGRATED_ROUTE_REGISTRY.length, 17)
  assert.deepEqual(GROWTH_MIGRATED_WORKSPACE_ROUTES, GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.path))
  console.log("  ✓ migrated workspace registry subset (17 routes)")

  const paths = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.path)
  const ids = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map((entry) => entry.id)
  assert.equal(new Set(paths).size, paths.length, "duplicate migrated workspace paths detected")
  assert.equal(new Set(ids).size, ids.length, "duplicate migrated workspace ids detected")
  console.log("  ✓ no duplicate migrated workspace paths or ids")

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
  assert.equal(findGrowthRouteMetadataByPathname("/growth/automation/new")?.id, "workspace-automation-new")
  assert.equal(findGrowthRouteMetadataByPathname("/growth/automation/flow-1")?.id, "workspace-automation-edit")
  console.log("  ✓ static routes beat dynamic routes")

  for (const entry of GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.filter((row) => row.placeholder)) {
    assert.equal(entry.placeholder, true, `placeholder flag missing for ${entry.path}`)
    assert.equal(entry.migrationStatus, "placeholder")
  }
  console.log("  ✓ placeholder routes marked")

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
  console.log("  ✓ sidebar workspace nav coverage")

  console.log("\nGrowth workspace shell audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_ROUTE_METADATA_QA_MARKER,
        migrated_routes: GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length,
        total_registry_routes: 112,
        workspace_nav_items: workspaceNavHrefs.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
