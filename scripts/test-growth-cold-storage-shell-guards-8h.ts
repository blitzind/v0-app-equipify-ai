/**
 * Phase 8H — cold storage shell guard verification (production-safe assumptions).
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-cold-storage-shell-guards-8h.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_TIER2_REGISTRY_KEYS,
  GROWTH_TIER2_SHELL_SURFACES,
  listGrowthTier2ShellRoutes,
} from "../lib/growth/runtime/growth-feature-shell-map"
import { listGrowthFeaturesByTier } from "../lib/growth/runtime/growth-feature-registry"
import {
  isGrowthFeatureShellMounted,
  isGrowthTier2ShellVisible,
  shouldDisableGrowthFeatureRoutePrefetch,
} from "../lib/growth/runtime/growth-feature-shell-guards"
import { resolveGrowthInboxWorkspaceTabs } from "../lib/growth/navigation/growth-inbox-workspace-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function withProfile(profile: "operator_minimal" | "full_admin" | "development_all") {
  const previous = process.env.GROWTH_RUNTIME_PROFILE
  process.env.GROWTH_RUNTIME_PROFILE = profile
  return () => {
    if (previous === undefined) delete process.env.GROWTH_RUNTIME_PROFILE
    else process.env.GROWTH_RUNTIME_PROFILE = previous
  }
}

function runProfileGuards(): void {
  console.log("\n=== Phase 8H profile guards ===\n")

  const restoreMinimal = withProfile("operator_minimal")
  assert.equal(isGrowthTier2ShellVisible(), false)
  for (const key of GROWTH_TIER2_REGISTRY_KEYS) {
    assert.equal(isGrowthFeatureShellMounted(key), false, `${key} should be cold in operator_minimal`)
  }
  assert.equal(resolveGrowthInboxWorkspaceTabs({ tier2ShellVisible: false }).length, 2)
  assert.ok(shouldDisableGrowthFeatureRoutePrefetch("/growth/inbox/operations"))
  restoreMinimal()
  console.log("  ✓ operator_minimal hides Tier 2 shell surfaces")

  const restoreAdmin = withProfile("full_admin")
  assert.equal(isGrowthTier2ShellVisible(), true)
  for (const key of GROWTH_TIER2_REGISTRY_KEYS) {
    assert.equal(isGrowthFeatureShellMounted(key), true, `${key} should mount in full_admin`)
  }
  assert.equal(resolveGrowthInboxWorkspaceTabs({ tier2ShellVisible: true }).length, 3)
  restoreAdmin()
  console.log("  ✓ full_admin restores Tier 2 shell visibility")

  const restorePlatformAdmin = withProfile("operator_minimal")
  assert.equal(isGrowthFeatureShellMounted("campaignBuilder", { isPlatformAdmin: true }), true)
  restorePlatformAdmin()
  console.log("  ✓ platform admin bypass under operator_minimal")

  const tier1 = listGrowthFeaturesByTier(1)
  const restoreDev = withProfile("development_all")
  for (const key of tier1.slice(0, 5)) {
    assert.equal(isGrowthFeatureShellMounted(key), true, `${key} tier1 remains mounted`)
  }
  restoreDev()
  console.log("  ✓ Tier 1 operator workflow keys remain mounted")

  const tier3 = listGrowthFeaturesByTier(3)
  const restoreMinimalTier3 = withProfile("operator_minimal")
  for (const key of tier3) {
    assert.equal(isGrowthFeatureShellMounted(key), true, `${key} tier3 not accidentally hidden`)
  }
  restoreMinimalTier3()
  console.log("  ✓ Tier 3 keys remain accessible in operator_minimal")
}

function runSourceCoverage(): void {
  console.log("\n=== Phase 8H shell source coverage ===\n")

  assert.equal(GROWTH_TIER2_SHELL_SURFACES.length, 8)
  assert.equal(new Set(GROWTH_TIER2_REGISTRY_KEYS).size, 8)

  const gatedPanels = [
    "growth-campaign-builder-wizard-panel.tsx",
    "growth-sequence-preview-studio-panel.tsx",
    "growth-agent-orchestration-panel.tsx",
    "growth-human-interventions-panel.tsx",
    "growth-realtime-event-bus-panel.tsx",
    "inbox/growth-inbox-diagnostics-panel.tsx",
    "inbox/growth-inbox-workflow-intelligence-summary.tsx",
    "growth-operator-diagnostics-disclosure.tsx",
  ]

  for (const file of gatedPanels) {
    const source = readSource(`components/growth/${file}`)
    assert.match(source, /withGrowthFeatureShellGate/, `${file} uses shell gate`)
  }
  console.log("  ✓ Tier 2 panel components wrapped with shell gates")

  const shellSource = readSource("components/growth/inbox/growth-inbox-shell.tsx")
  assert.match(shellSource, /resolveGrowthInboxWorkspaceTabs/)
  assert.match(shellSource, /GrowthFeatureLink/)
  assert.match(shellSource, /useGrowthTier2ShellVisible/)
  console.log("  ✓ inbox shell filters Operations tab and disables cold prefetch")

  const operationsSource = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")
  assert.match(operationsSource, /GrowthInboxOperationsColdStorageNotice/)
  assert.match(operationsSource, /useGrowthTier2ShellVisible/)
  console.log("  ✓ operations panel cold-storage notice when Tier 2 hidden")

  const workflowSource = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowSource, /feature="humanInterventionDashboard"/)
  assert.match(workflowSource, /feature="sequencePreviewStudio"/)
  assert.match(workflowSource, /GrowthOnDemandFeature/)
  assert.match(workflowSource, /feature="conversationalPlaybooks"/)
  assert.match(workflowSource, /feature="smartFollowUpPolicies"/)
  console.log("  ✓ workflow panel gates Tier 2 expandables; Tier 3 uses on-demand wrapper")

  for (const route of listGrowthTier2ShellRoutes()) {
    assert.ok(route.length > 0, "tier2 route registered")
  }
  console.log("  ✓ Tier 2 route inventory registered")
}

function main(): void {
  runProfileGuards()
  runSourceCoverage()
  console.log("\nPhase 8H cold storage shell guard verification passed.\n")
}

main()
