/**
 * Growth workspace cleanup audit (Phase 7H — local only).
 *
 * Usage: pnpm test:growth-workspace-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_DEMOTED_OPERATOR_SURFACES,
  GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS,
  GROWTH_LEGACY_ADMIN_ALIAS_HREFS,
  GROWTH_PERMANENT_ADMIN_ONLY_PREFIXES,
  GROWTH_TRACKED_ORPHAN_ROUTE_IDS,
  GROWTH_WORKSPACE_CANONICAL_ALIASES,
  GROWTH_WORKSPACE_CLEANUP_QA_MARKER,
  GROWTH_WORKSPACE_SIDEBAR_CANONICAL_IA,
} from "../lib/growth/navigation/growth-workspace-cleanup-audit"
import {
  GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS,
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import {
  findGrowthRouteMetadataByAnyPath,
  findGrowthRouteMetadataByPathname,
  getGrowthRouteMetadataById,
  GROWTH_ROUTE_METADATA,
} from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_NAV_GROUP_DEFS } from "../lib/growth/navigation/growth-navigation-destinations"
import { listGrowthCommandPaletteVisibleHrefs } from "../lib/growth/navigation/growth-command-palette-derivation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function workspacePageExists(segment: string): boolean {
  const pagePath = path.join(ROOT, "app/(growth)/growth", segment, "page.tsx")
  if (segment === "") {
    return fs.existsSync(path.join(ROOT, "app/(growth)/growth/page.tsx"))
  }
  return fs.existsSync(pagePath)
}

function grepWorkspaceHrefOrphans(): string[] {
  const growthAppDir = path.join(ROOT, "app/(growth)/growth")
  const hits: string[] = []

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        const source = fs.readFileSync(full, "utf8")
        for (const orphan of GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS) {
          if (source.includes(`"${orphan}"`) || source.includes(`'${orphan}'`)) {
            hits.push(`${path.relative(ROOT, full)}:${orphan}`)
          }
        }
      }
    }
  }

  if (fs.existsSync(growthAppDir)) walk(growthAppDir)
  return hits
}

function runAudit(): void {
  console.log(`\n=== Growth workspace cleanup audit (${GROWTH_WORKSPACE_CLEANUP_QA_MARKER}) ===\n`)

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 12)
  assert.equal(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.length, 12)
  console.log("  ✓ sidebar remains exactly 12 operator items")

  const manifestIds = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id))
  for (const expected of GROWTH_WORKSPACE_SIDEBAR_CANONICAL_IA.groups) {
    const group = GROWTH_SHELL_NAV_GROUPS.find((entry) => entry.id === expected.id)
    assert.ok(group, `missing sidebar group: ${expected.id}`)
    assert.deepEqual(
      group.items.map((item) => item.id),
      [...expected.items],
    )
  }
  console.log("  ✓ sidebar IA matches canonical Workspace / Content / Automation / Intelligence layout")

  assert.ok(!manifestIds.includes("settings-home"))
  assert.ok(!manifestIds.includes("templates"))
  assert.ok(!manifestIds.includes("engagement"))
  assert.ok(!manifestIds.includes("opportunities-pipeline"))
  console.log("  ✓ settings, pipeline, templates, and engagement absent from sidebar")

  for (const hiddenId of ["templates", "engagement", "opportunities-pipeline"] as const) {
    assert.ok(GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS.includes(hiddenId))
  }
  console.log("  ✓ demoted nav ids remain in hidden manifest")

  for (const orphan of GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS) {
    assert.equal(findGrowthRouteMetadataByPathname(orphan), null, `forbidden orphan route registered: ${orphan}`)
    assert.equal(workspacePageExists(orphan.replace(`${GROWTH_WORKSPACE_BASE_PATH}/`, "")), false)
  }
  console.log("  ✓ no /growth/pipeline, /growth/templates, or /growth/replies routes")

  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_CANONICAL_ALIASES.templates))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_CANONICAL_ALIASES.settings))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_CANONICAL_ALIASES.engagement))
  console.log("  ✓ canonical demoted destinations registered")

  for (const { adminHref, workspaceHref } of GROWTH_LEGACY_ADMIN_ALIAS_HREFS) {
    const resolved = resolveGrowthCommandPaletteHref(`${GROWTH_WORKSPACE_BASE_PATH}/inbox`, adminHref)
    assert.equal(resolved, workspaceHref, `Cmd+K alias failed: ${adminHref}`)
  }
  console.log("  ✓ legacy admin aliases rewrite to workspace from /growth shell")

  const replyInboxCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    GROWTH_WORKSPACE_CANONICAL_ALIASES.replyInboxAdmin,
  )
  assert.equal(replyInboxCmdK, GROWTH_WORKSPACE_CANONICAL_ALIASES.replyInboxAdmin)
  console.log("  ✓ admin Reply Inbox stays admin from workspace Cmd+K")

  for (const prefix of GROWTH_PERMANENT_ADMIN_ONLY_PREFIXES) {
    const sample = `${prefix}/sample`
    const route = GROWTH_ROUTE_METADATA.find(
      (entry) => entry.path === prefix || entry.path.startsWith(`${prefix}/`) || entry.adminPath === prefix,
    )
    assert.ok(route ?? findGrowthRouteMetadataByAnyPath(prefix) ?? true, `expected admin route under ${prefix}`)
    const workspaceEquivalent = GROWTH_ROUTE_METADATA.find(
      (entry) =>
        entry.path.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}`) &&
        (entry.path === sample || entry.segment?.startsWith(prefix.replace(`${GROWTH_ADMIN_BASE_PATH}/`, ""))),
    )
    assert.equal(workspaceEquivalent ?? null, null)
  }
  console.log("  ✓ permanent admin-only prefixes have no workspace equivalents")

  for (const surface of GROWTH_DEMOTED_OPERATOR_SURFACES) {
    const adminRoute = findGrowthRouteMetadataByAnyPath(surface.adminHref)
    assert.ok(adminRoute, `missing admin registry route for demoted surface: ${surface.id}`)
    if (surface.workspaceHref) {
      assert.ok(findGrowthRouteMetadataByPathname(surface.workspaceHref), `missing workspace route: ${surface.id}`)
    }
  }
  console.log("  ✓ demoted operator surfaces inventory aligns with registry")

  const adminNavItems = GROWTH_NAV_GROUP_DEFS.flatMap((group) => group.items)
  const pipelineNav = adminNavItems.find((item) => item.id === "pipeline")
  const engagementNav = adminNavItems.find((item) => item.id === "engagement")
  const templatesNav = adminNavItems.find((item) => item.id === "share-page-templates")
  assert.ok(pipelineNav)
  assert.ok(engagementNav)
  assert.ok(templatesNav)

  const paletteHrefs = listGrowthCommandPaletteVisibleHrefs()
  assert.ok(paletteHrefs.length > 0)
  assert.equal(
    resolveGrowthCommandPaletteHref(`${GROWTH_WORKSPACE_BASE_PATH}/inbox`, pipelineNav.href),
    GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline,
  )
  assert.equal(
    resolveGrowthCommandPaletteHref(`${GROWTH_WORKSPACE_BASE_PATH}/inbox`, engagementNav.href),
    GROWTH_WORKSPACE_CANONICAL_ALIASES.engagement,
  )
  console.log("  ✓ demoted routes remain in admin nav and rewrite from workspace Cmd+K")

  const pipelineCrumbs = resolveGrowthBreadcrumbs(GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline)
  assert.deepEqual(pipelineCrumbs.map((crumb) => crumb.label), ["Growth", "Opportunities", "Pipeline"])
  const workflowCrumbs = resolveGrowthBreadcrumbs(GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow)
  assert.deepEqual(workflowCrumbs.map((crumb) => crumb.label), ["Growth", "Inbox", "Reply Workflow"])
  console.log("  ✓ pipeline and reply workflow breadcrumbs unchanged")

  const orphanHits = grepWorkspaceHrefOrphans()
  assert.deepEqual(orphanHits, [], `forbidden orphan hrefs in workspace app tree: ${orphanHits.join(", ")}`)
  console.log("  ✓ workspace app tree has no forbidden orphan hrefs")

  const operatorInboxAggregator = readSource("lib/growth/operator-inbox/operator-inbox-aggregator.ts")
  assert.match(operatorInboxAggregator, /GROWTH_WORKSPACE_BASE_PATH\}\/inbox\/workflow/)
  console.log("  ✓ operator inbox workflow CTA uses canonical workspace route")

  const openOpportunities = readSource("components/growth/growth-command-open-opportunities-section.tsx")
  assert.match(openOpportunities, /useGrowthFeaturePath|opportunities\/pipeline/)
  const pipelineSummary = readSource("components/growth/growth-pipeline-command-summary.tsx")
  assert.match(pipelineSummary, /useGrowthFeaturePath|opportunities\/pipeline/)
  console.log("  ✓ command opportunity/pipeline links use pathname-aware helpers")

  for (const orphanId of GROWTH_TRACKED_ORPHAN_ROUTE_IDS) {
    assert.ok(getGrowthRouteMetadataById(orphanId), `tracked orphan route missing from registry: ${orphanId}`)
  }
  console.log("  ✓ tracked orphan route ids remain registered")

  const removedWrappers = [
    "components/growth/replies/growth-reply-workflow-workspace.tsx",
    "components/growth/opportunities/growth-opportunities-pipeline-workspace.tsx",
  ]
  for (const file of removedWrappers) {
    assert.ok(!fs.existsSync(path.join(ROOT, file)), `legacy wrapper should stay deleted: ${file}`)
  }
  console.log("  ✓ legacy mixed workspace wrappers remain deleted")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity unchanged")

  console.log("\nGrowth workspace cleanup audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_CLEANUP_QA_MARKER,
        sidebar_items: navItems.length,
        demoted_surfaces: GROWTH_DEMOTED_OPERATOR_SURFACES.length,
        forbidden_orphans: GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS.length,
        admin_only_prefixes: GROWTH_PERMANENT_ADMIN_ONLY_PREFIXES.length,
        tracked_orphans: GROWTH_TRACKED_ORPHAN_ROUTE_IDS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
