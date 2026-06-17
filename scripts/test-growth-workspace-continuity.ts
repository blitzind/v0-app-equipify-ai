/**
 * Growth workspace operator continuity audit (Phase 3D — local only).
 *
 * Usage: pnpm test:growth-workspace-continuity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA_QA_MARKER,
} from "../lib/growth/navigation/growth-route-metadata"
import {
  assertGrowthCommandPaletteRegistryParity,
  buildGrowthCommandPaletteRegistryMappings,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import {
  isGrowthShellNavItemActive,
  GROWTH_SHELL_NAV_GROUPS,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { growthFeaturePath } from "../lib/growth/navigation/growth-workspace-base-path"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"

export const GROWTH_WORKSPACE_CONTINUITY_QA_MARKER = "growth-workspace-continuity-v3" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

/** Operator continuity surfaces patched in Phase 3D — must not hardcode migrated admin paths. */
const OPERATOR_CONTINUITY_SOURCES: Array<{ file: string; forbidden: RegExp[] }> = [
  {
    file: "app/(growth)/growth/inbox/page.tsx",
    forbidden: [/\/admin\/growth\/queue/],
  },
  {
    file: "components/growth/lead-operator/growth-lead-operator-workspace.tsx",
    forbidden: [/\/admin\/growth\/queue/],
  },
  {
    file: "components/growth/growth-lead-engine-workspace.tsx",
    forbidden: [/\/admin\/growth\/queue/],
  },
  {
    file: "components/growth/lead-intelligence-inspector/lead-intelligence-operator-summary-card.tsx",
    forbidden: [
      /href="\/admin\/growth\/leads"/,
      /href="\/admin\/growth\/leads\/queue"/,
      /href="\/admin\/growth\/calls\/workspace"/,
    ],
  },
  {
    file: "components/growth/lead-intelligence-inspector/lead-intelligence-stage-panel.tsx",
    forbidden: [/href="\/admin\/growth\/leads"/],
  },
  {
    file: "components/growth/growth-manual-contact-form-dialog.tsx",
    forbidden: [/\/admin\/growth\/leads\//],
  },
  {
    file: "components/growth/outbound-launch/lead-inbox-outbound-launch-bar.tsx",
    forbidden: [/\/admin\/growth\/leads\//],
  },
  {
    file: "components/growth/use-call-workspace-lead-search.ts",
    forbidden: [/\/admin\/growth\/leads\?/],
  },
  {
    file: "components/growth/inbox/growth-inbox-quick-actions.tsx",
    forbidden: [/\/admin\/growth\/calls\/workspace/],
  },
  {
    file: "components/growth/inbox/growth-inbox-workspace-keyboard-bridge.tsx",
    forbidden: [/\/admin\/growth\/calls\/workspace/],
  },
  {
    file: "components/growth/growth-live-coaching-dashboard.tsx",
    forbidden: [/\/admin\/growth\/leads\?open=/],
  },
  {
    file: "components/growth/growth-realtime-live-dashboard.tsx",
    forbidden: [/\/admin\/growth\/leads\?open=/],
  },
  {
    file: "components/growth/inbox/growth-inbox-v2-supporting-panels.tsx",
    forbidden: [/\/admin\/growth\/replies\/workflow/],
  },
  {
    file: "components/growth/growth-reply-workflow-actions-panel.tsx",
    forbidden: [/href="\/admin\/growth\/replies\/workflow"/],
  },
  {
    file: "components/growth/growth-lead-meeting-intelligence.tsx",
    forbidden: [/href=\{`\/admin\/growth\/opportunities\/pipeline/],
  },
  {
    file: "components/growth/growth-opportunity-draft-panel.tsx",
    forbidden: [/href=\{`\/admin\/growth\/opportunities\/pipeline/],
  },
  {
    file: "components/growth/growth-opportunity-pipeline-dashboard.tsx",
    forbidden: [/href=\{`\/admin\/growth\/leads\?leadId=/],
  },
]

const SIDEBAR_SUBTREE_CASES: Array<{ pathname: string; activeNavId: string }> = [
  { pathname: "/growth/leads/crm", activeNavId: "leads" },
  { pathname: "/growth/leads/queue", activeNavId: "leads" },
  { pathname: "/growth/leads/sample-lead", activeNavId: "leads" },
  { pathname: "/growth/calls/live", activeNavId: "calls" },
  { pathname: "/growth/calls/coaching", activeNavId: "calls" },
  { pathname: "/growth/inbox/workflow", activeNavId: "inbox" },
  { pathname: "/growth/share-pages/templates/new", activeNavId: "templates" },
  { pathname: "/growth/automation/flow-1", activeNavId: "automation-flows" },
]

const CMD_K_MIGRATED_RESOLUTIONS: Array<{ adminHref: string; workspaceSegment: string }> = [
  { adminHref: "/admin/growth/inbox", workspaceSegment: "inbox" },
  { adminHref: "/admin/growth/queue", workspaceSegment: "leads" },
  { adminHref: "/admin/growth/leads/crm", workspaceSegment: "leads/crm" },
  { adminHref: "/admin/growth/calls/live", workspaceSegment: "calls/live" },
  { adminHref: "/admin/growth/calls/workspace", workspaceSegment: "calls" },
  { adminHref: "/admin/growth/replies/workflow", workspaceSegment: "inbox/workflow" },
  { adminHref: "/admin/growth/opportunities", workspaceSegment: "opportunities" },
  { adminHref: "/admin/growth/opportunities/pipeline", workspaceSegment: "opportunities/pipeline" },
  { adminHref: "/admin/growth/opportunities/workspace", workspaceSegment: "opportunities/workspace" },
  { adminHref: "/admin/growth/multichannel", workspaceSegment: "campaigns" },
]

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace continuity audit (${GROWTH_WORKSPACE_CONTINUITY_QA_MARKER}) ===\n`)
  console.log(`  registry qa marker: ${GROWTH_ROUTE_METADATA_QA_MARKER}`)

  for (const { file, forbidden } of OPERATOR_CONTINUITY_SOURCES) {
    const source = readSource(file)
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} still contains forbidden admin jump: ${pattern}`)
    }
    assert.match(
      source,
      /growthFeaturePath|useGrowthFeaturePath|growthCallsOperatingHref/,
      `${file} should use pathname-aware growth path helpers`,
    )
  }
  console.log("  ✓ operator continuity surfaces avoid migrated admin hardcodes")

  for (const { pathname, activeNavId } of SIDEBAR_SUBTREE_CASES) {
    const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
    const activeItems = navItems.filter((item) => isGrowthShellNavItemActive(pathname, item))
    assert.ok(
      activeItems.some((item) => item.id === activeNavId),
      `expected ${activeNavId} active for ${pathname}, got ${activeItems.map((item) => item.id).join(", ") || "(none)"}`,
    )
  }
  console.log("  ✓ sidebar active states cover leads/calls/share-pages/automation subtrees")

  for (const entry of GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.filter((row) => !row.placeholder)) {
    const crumbs = resolveGrowthBreadcrumbs(entry.path)
    assert.ok(crumbs.length >= 1, `breadcrumb missing for ${entry.path}`)
    assert.equal(crumbs[0]?.label, "Growth")

    if (entry.segment?.startsWith("leads/") || entry.segment?.startsWith("calls/") || entry.segment?.startsWith("inbox/") || entry.segment?.startsWith("opportunities/")) {
      assert.ok(crumbs.length >= 2, `hierarchical breadcrumb expected for ${entry.path}`)
    }
  }
  console.log("  ✓ breadcrumbs cover all migrated workspace pages")

  const inboxWorkflowCrumbs = resolveGrowthBreadcrumbs("/growth/inbox/workflow")
  assert.deepEqual(
    inboxWorkflowCrumbs.map((crumb) => crumb.label),
    ["Growth", "Inbox", "Reply Workflow"],
  )
  console.log("  ✓ inbox/workflow breadcrumbs: Growth → Inbox → Reply Workflow")

  const pipelineCrumbs = resolveGrowthBreadcrumbs("/growth/opportunities/pipeline")
  assert.deepEqual(
    pipelineCrumbs.map((crumb) => crumb.label),
    ["Growth", "Opportunities", "Pipeline"],
  )
  console.log("  ✓ opportunities/pipeline breadcrumbs: Growth → Opportunities → Pipeline")

  for (const { adminHref, workspaceSegment } of CMD_K_MIGRATED_RESOLUTIONS) {
    const resolved = resolveGrowthCommandPaletteHref("/growth/inbox", adminHref)
    assert.ok(resolved.startsWith(GROWTH_WORKSPACE_BASE_PATH), `${adminHref} should rewrite from workspace shell`)
    assert.equal(
      resolved.split("?")[0],
      growthFeaturePath("/growth/inbox", workspaceSegment),
      `Cmd+K rewrite mismatch for ${adminHref}`,
    )
  }

  const adminOnlyFromWorkspace = resolveGrowthCommandPaletteHref("/growth/inbox", "/admin/growth/providers")
  assert.equal(adminOnlyFromWorkspace, `${GROWTH_ADMIN_BASE_PATH}/providers`)
  console.log("  ✓ Cmd+K rewrites migrated routes to /growth; admin-only routes stay admin")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity (hidden routes gated; migrated hrefs rewrite from workspace shell)")

  const callsProviders = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-calls-providers")
  assert.equal(callsProviders?.migrationStatus, "admin-only")
  const inboxDiagnostics = GROWTH_ROUTE_METADATA.find((entry) => entry.id === "admin-inbox-diagnostics")
  assert.ok(inboxDiagnostics?.hidden)
  console.log("  ✓ admin-only safety rails unchanged (providers, inbox diagnostics)")

  console.log("\nGrowth workspace continuity audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_CONTINUITY_QA_MARKER,
        registry_qa_marker: GROWTH_ROUTE_METADATA_QA_MARKER,
        continuity_sources_checked: OPERATOR_CONTINUITY_SOURCES.length,
        migrated_routes: GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
