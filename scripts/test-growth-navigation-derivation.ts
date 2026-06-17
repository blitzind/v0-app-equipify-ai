/**
 * Growth navigation derivation audit (local only).
 *
 * Compares existing visible navigation against canonical route registry candidates.
 * Usage: pnpm test:growth-navigation-derivation
 */
import assert from "node:assert/strict"
import { assertGrowthAdminNavRegistryParity, buildGrowthAdminNavParityReport } from "../lib/growth/navigation/growth-admin-navigation-derivation"
import {
  assertGrowthCommandPaletteRegistryParity,
  buildGrowthCommandPaletteRegistryMappings,
  GROWTH_COMMAND_PALETTE_DERIVATION_QA_MARKER,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import { GROWTH_COMMAND_REGISTRY } from "../lib/growth/navigation/growth-command-registry"
import {
  GROWTH_COMMAND_PALETTE_ENTRIES,
  GROWTH_NAV_GROUP_DEFS,
} from "../lib/growth/navigation/growth-navigation-destinations"
import {
  assertNoDuplicateGeneratedHrefsWithinSection,
  assertNoDuplicateGeneratedNavIds,
  buildGrowthNavigationDerivationComparison,
  findGrowthRouteMetadataForHref,
  getGrowthAutomationNavigationCandidates,
  getGrowthContentNavigationCandidates,
  getGrowthIntelligenceNavigationCandidates,
  getGrowthNavigationCandidates,
  getGrowthOrphanRouteReport,
  getGrowthRoutesForSection,
  getGrowthSettingsNavigationCandidates,
  getGrowthSystemHiddenRoutes,
  getGrowthWorkspaceNavigationCandidates,
  isGrowthHiddenOrSystemRoute,
  listExistingAdminNavHrefs,
  listExistingCommandPaletteHrefs,
  listExistingWorkspaceNavHrefs,
} from "../lib/growth/navigation/growth-navigation-derivation"
import { GROWTH_NAVIGATION_DERIVATION_QA_MARKER } from "../lib/growth/navigation/growth-navigation-types"
import { GROWTH_ORPHAN_ROUTE_IDS } from "../lib/growth/navigation/growth-route-catalog-data"
import {
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA,
} from "../lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_SHELL_NAV_SECONDARY_IDS,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
  validateGrowthWorkspaceShellNavRegistryParity,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

const CANONICAL_WORKSPACE_SHELL_GROUP_ORDER = ["workspace", "content", "automation", "intelligence"] as const

const CANONICAL_WORKSPACE_SHELL_GROUP_LABELS: Record<(typeof CANONICAL_WORKSPACE_SHELL_GROUP_ORDER)[number], string> = {
  workspace: "Workspace",
  content: "Content",
  automation: "Automation",
  intelligence: "Intelligence",
}

const CANONICAL_WORKSPACE_SHELL_NAV_IDS = [
  "dashboard",
  "leads",
  "campaigns",
  "inbox",
  "calls",
  "meetings",
  "share-pages",
  "media-assets",
  "templates",
  "automation-flows",
  "engagement",
  "opportunities",
  "opportunities-pipeline",
  "conversations",
  "relationships",
] as const

/** Orphan IA audit routes that must stay out of workspace shell primary nav. */
const INTENTIONALLY_UNSURFACED_ORPHAN_IDS = [
  "admin-knowledge",
  "admin-customer-lifecycle",
  "admin-sequences-builder",
  "admin-opportunities-workspace",
] as const

function assertWorkspaceShellNavParity(): void {
  assert.equal(GROWTH_SHELL_NAV_GROUPS.length, CANONICAL_WORKSPACE_SHELL_GROUP_ORDER.length)
  assert.deepEqual(
    GROWTH_SHELL_NAV_GROUPS.map((group) => group.id),
    [...CANONICAL_WORKSPACE_SHELL_GROUP_ORDER],
  )

  for (const group of GROWTH_SHELL_NAV_GROUPS) {
    assert.equal(
      group.label,
      CANONICAL_WORKSPACE_SHELL_GROUP_LABELS[group.id as (typeof CANONICAL_WORKSPACE_SHELL_GROUP_ORDER)[number]],
      `unexpected workspace shell group label: ${group.id}`,
    )
  }

  const visibleNavIds = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))
  assert.deepEqual(visibleNavIds, [...CANONICAL_WORKSPACE_SHELL_NAV_IDS])

  const navIds = new Set<string>()
  for (const group of GROWTH_SHELL_NAV_GROUPS) {
    const hrefs = new Set<string>()
    for (const item of group.items) {
      assert.ok(!navIds.has(item.id), `duplicate workspace nav id: ${item.id}`)
      navIds.add(item.id)

      if (GROWTH_SHELL_NAV_SECONDARY_IDS.has(item.id)) continue

      const normalizedHref = item.href.split("?")[0] ?? item.href
      assert.ok(!hrefs.has(normalizedHref), `duplicate visible href in ${group.id}: ${normalizedHref}`)
      hrefs.add(normalizedHref)
    }
  }

  const manifestRegistryIds = new Set(
    GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.registryRouteId)),
  )
  for (const orphanId of INTENTIONALLY_UNSURFACED_ORPHAN_IDS) {
    assert.ok(!manifestRegistryIds.has(orphanId), `orphan route surfaced in workspace shell manifest: ${orphanId}`)
  }

  const parityIssues = validateGrowthWorkspaceShellNavRegistryParity()
  assert.equal(parityIssues.length, 0, parityIssues.map((issue) => `${issue.navId}: ${issue.message}`).join("; "))
}

function runAudit(): void {
  console.log(`\n=== Growth navigation derivation audit (${GROWTH_NAVIGATION_DERIVATION_QA_MARKER}) ===\n`)

  assertWorkspaceShellNavParity()
  console.log("  ✓ workspace shell nav matches canonical snapshot (groups, labels, ids, registry parity)")

  assertGrowthAdminNavRegistryParity()
  const adminReport = buildGrowthAdminNavParityReport()
  assert.equal(adminReport.unmappedHrefs.length, 0)
  console.log("  ✓ admin sidebar nav maps 100% to registry entries")

  assertGrowthCommandPaletteRegistryParity()
  const paletteMappings = buildGrowthCommandPaletteRegistryMappings()
  assert.ok(paletteMappings.length > 0)
  console.log("  ✓ Cmd+K destinations map 100% to registry entries (no hidden/system exposure)")

  const candidates = getGrowthNavigationCandidates()
  assertNoDuplicateGeneratedNavIds(candidates)
  assertNoDuplicateGeneratedHrefsWithinSection(candidates)
  console.log("  ✓ generated candidates have unique ids and section hrefs")

  for (const hidden of getGrowthSystemHiddenRoutes()) {
    assert.ok(isGrowthHiddenOrSystemRoute(hidden), `expected hidden/system route: ${hidden.id}`)
    assert.ok(!candidates.some((item) => item.id === hidden.id), `hidden/system route leaked into candidates: ${hidden.id}`)
  }
  console.log("  ✓ hidden/system routes excluded from visible generated candidates")

  for (const href of listExistingAdminNavHrefs()) {
    assert.ok(findGrowthRouteMetadataForHref(href), `admin nav item missing registry mapping: ${href}`)
  }
  console.log("  ✓ every visible admin sidebar item maps to registry")

  for (const href of listExistingWorkspaceNavHrefs()) {
    assert.ok(findGrowthRouteMetadataForHref(href), `workspace nav item missing registry mapping: ${href}`)
  }
  console.log("  ✓ every visible workspace sidebar item maps to registry")

  for (const href of listExistingCommandPaletteHrefs()) {
    assert.ok(findGrowthRouteMetadataForHref(href), `Cmd+K destination missing registry mapping: ${href}`)
  }
  console.log("  ✓ every Cmd+K destination maps to registry")

  for (const placeholder of GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.filter((entry) => entry.placeholder)) {
    assert.ok(
      GROWTH_ROUTE_METADATA.some((entry) => entry.id === placeholder.id),
      `placeholder workspace route missing metadata: ${placeholder.path}`,
    )
  }
  console.log("  ✓ placeholder workspace routes represented in metadata")

  for (const item of getGrowthSettingsNavigationCandidates()) {
    if (item.href.startsWith("/admin/growth")) {
      assert.ok(item.futurePath?.startsWith("/growth/settings"), `settings candidate missing futurePath: ${item.id}`)
    }
  }
  console.log("  ✓ settings navigation candidates include future workspace target paths")

  assert.ok(getGrowthRoutesForSection("workspace").length > 0)
  assert.ok(getGrowthWorkspaceNavigationCandidates().length > 0)
  assert.ok(getGrowthContentNavigationCandidates().length > 0)
  assert.ok(getGrowthAutomationNavigationCandidates().length > 0)
  assert.ok(getGrowthIntelligenceNavigationCandidates().length > 0)
  assert.ok(getGrowthSettingsNavigationCandidates().length > 0)
  console.log("  ✓ section navigation candidate helpers return data")

  const orphanReport = getGrowthOrphanRouteReport()
  assert.ok(orphanReport.auditOrphansCoveredByGenerated, "IA audit orphan routes must appear in generated candidates")
  for (const orphanId of GROWTH_ORPHAN_ROUTE_IDS) {
    assert.ok(
      candidates.some((item) => item.id === orphanId),
      `IA audit orphan route missing from generated candidates: ${orphanId}`,
    )
  }
  console.log("  ✓ IA audit orphan routes covered by generated navigation candidates")

  const comparison = buildGrowthNavigationDerivationComparison()
  assert.equal(comparison.hiddenInGeneratedCandidates.length, 0)
  assert.equal(comparison.unmappedAdminNav.length, 0)
  assert.equal(comparison.unmappedWorkspaceNav.length, 0)
  assert.equal(comparison.unmappedCommandPalette.length, 0)
  console.log("  ✓ nav comparison report has zero unmapped visible destinations")

  console.log("\nGrowth navigation derivation audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_NAVIGATION_DERIVATION_QA_MARKER,
        workspace_shell_nav_qa_marker: GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
        command_palette_derivation_qa_marker: GROWTH_COMMAND_PALETTE_DERIVATION_QA_MARKER,
        comparison,
        adminNavParity: {
          totalVisibleItems: adminReport.totalVisibleItems,
          mappedItems: adminReport.mappedItems,
          futurePlaceholderItems: adminReport.futurePlaceholderItems,
        },
        commandPaletteMappings: paletteMappings.length,
        orphanReport: {
          totalOrphans: orphanReport.totalOrphans,
          totalNavGapRoutes: orphanReport.totalNavGapRoutes,
          auditOrphansCoveredByGenerated: orphanReport.auditOrphansCoveredByGenerated,
          sampleNavGapIds: orphanReport.navGapRoutes.slice(0, 8).map((entry) => entry.id),
        },
        sources: {
          adminNavGroups: GROWTH_NAV_GROUP_DEFS.length,
          workspaceNavGroups: GROWTH_SHELL_NAV_GROUPS.length,
          commandPaletteEntries: GROWTH_COMMAND_PALETTE_ENTRIES.length,
          commandRegistryEntries: GROWTH_COMMAND_REGISTRY.length,
          registryRoutes: GROWTH_ROUTE_METADATA.length,
          generatedCandidates: candidates.length,
        },
      },
      null,
      2,
    ),
  )
}

runAudit()
