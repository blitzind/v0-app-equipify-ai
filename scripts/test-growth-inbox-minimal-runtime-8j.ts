/**
 * Phase 8J — Inbox minimal runtime verification.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-inbox-minimal-runtime-8j.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES,
  GROWTH_INBOX_MINIMAL_RUNTIME_INVENTORY,
  GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER,
  GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES,
  GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES,
  isGrowthInboxMinimalRuntimeActive,
  isGrowthInboxTier3Feature,
  shouldDeferGrowthInboxTier3Hydration,
  shouldSkipGrowthInboxSecondaryHydration,
} from "../lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import {
  GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS,
  GROWTH_INBOX_TIER1_REFRESH_QA_MARKER,
} from "../lib/growth/inbox/use-growth-inbox-tier1-refresh"
import { isGrowthFeatureApiEnabled } from "../lib/growth/runtime/growth-feature-helpers"
import { listGrowthFeaturesByTier } from "../lib/growth/runtime/growth-feature-registry"

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

function runContractGuards(): void {
  console.log("\n=== Phase 8J contract guards ===\n")

  assert.equal(GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER, "growth-inbox-minimal-runtime-v1")
  assert.equal(GROWTH_INBOX_TIER1_REFRESH_QA_MARKER, "growth-inbox-tier1-refresh-v1")
  assert.equal(GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES.length, 4)
  assert.ok(GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES.length >= 5)
  assert.ok(GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES.length >= 8)
  assert.ok(GROWTH_INBOX_MINIMAL_RUNTIME_INVENTORY.length >= 20)
  console.log("  ✓ contract markers and allowlists present")

  const restoreMinimal = withProfile("operator_minimal")
  assert.equal(isGrowthInboxMinimalRuntimeActive(), true)
  assert.equal(shouldSkipGrowthInboxSecondaryHydration(), true)
  assert.equal(shouldDeferGrowthInboxTier3Hydration(), true)
  assert.equal(isGrowthFeatureApiEnabled("realtimeEventBus"), false)
  restoreMinimal()
  console.log("  ✓ operator_minimal defers secondary + Tier 3 hydration")

  const restoreAdmin = withProfile("full_admin")
  assert.equal(isGrowthInboxMinimalRuntimeActive(), false)
  assert.equal(shouldSkipGrowthInboxSecondaryHydration(), false)
  assert.equal(shouldDeferGrowthInboxTier3Hydration(), false)
  assert.equal(isGrowthFeatureApiEnabled("realtimeEventBus"), true)
  restoreAdmin()
  console.log("  ✓ full_admin allows secondary hydration and event bus")
}

function runTier3FeatureKeys(): void {
  console.log("\n=== Phase 8J Tier 3 feature keys ===\n")

  const tier3Keys = [
    "conversationalPlaybooks",
    "smartFollowUpPolicies",
    "sequenceExitCandidates",
    "revenueCommandCenter",
    "forecastEvidence",
    "executionPlans",
    "bookingIntelligence",
    "opportunityRecommendations",
  ] as const

  for (const key of tier3Keys) {
    assert.equal(isGrowthInboxTier3Feature(key), true, `${key} is Tier 3 inbox feature`)
    assert.equal(listGrowthFeaturesByTier(3).includes(key), true, `${key} in registry tier 3`)
  }
  console.log("  ✓ Tier 3 inbox feature keys aligned with registry")
}

function runSourceWiring(): void {
  console.log("\n=== Phase 8J source wiring ===\n")

  const workspaceProvider = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  assert.match(workspaceProvider, /shouldSkipGrowthInboxSecondaryHydration/)
  assert.match(workspaceProvider, /loadSecondaryInboxData/)
  console.log("  ✓ workspace provider skips secondary hydration in minimal")

  const operatorPanel = readSource("components/growth/growth-operator-inbox-panel.tsx")
  assert.match(operatorPanel, /useGrowthInboxTier1PollRefresh|useGrowthInboxTier1Refresh/)
  assert.match(operatorPanel, /useGrowthRealtimeRefresh/)
  assert.match(operatorPanel, /eventBusActive/)
  console.log("  ✓ operator inbox uses Tier 1 poll refresh when event bus cold")

  const tier1Refresh = readSource("lib/growth/inbox/use-growth-inbox-tier1-refresh.ts")
  assert.match(tier1Refresh, /isGrowthFeatureApiEnabled\("realtimeEventBus"\)/)
  assert.doesNotMatch(tier1Refresh, /subscribeToGrowthRealtimeEvents/)
  assert.doesNotMatch(tier1Refresh, /realtime-events/)
  assert.doesNotMatch(tier1Refresh, /sync\/dashboard/)
  assert.equal(GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS, 90_000)
  console.log("  ✓ Tier 1 refresh is bounded polling without event bus")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxTier1RefreshBridge/)
  assert.match(v2Panel, /GrowthInboxTier1PollCoordinatorProvider/)
  console.log("  ✓ inbox V2 panel mounts Tier 1 refresh bridge and poll coordinator")

  const leadContext = readSource("components/growth/inbox/growth-inbox-lead-context-provider.tsx")
  assert.match(leadContext, /shouldDeferGrowthInboxTier3Hydration/)
  assert.match(leadContext, /refreshLeadEssentials/)
  assert.match(leadContext, /refreshLeadTier3Enrichment/)
  assert.match(leadContext, /refreshSequenceExitCandidates/)
  console.log("  ✓ lead context splits Tier 1 vs Tier 3 selected-thread hydration")

  const sharedData = readSource("components/growth/inbox/growth-inbox-shared-data-provider.tsx")
  assert.match(sharedData, /shouldDeferGrowthInboxTier3Hydration/)
  console.log("  ✓ command center deferred in minimal runtime")

  const replyDashboard = readSource("components/growth/inbox/use-growth-reply-intelligence-dashboard.ts")
  const callComms = readSource("components/growth/inbox/use-growth-inbox-call-communications.ts")
  assert.match(replyDashboard, /shouldSkipGrowthInboxSecondaryHydration/)
  assert.match(callComms, /shouldSkipGrowthInboxSecondaryHydration/)
  console.log("  ✓ overview idle hydration skipped in minimal")

  const workflowEmbeds = readSource("components/growth/inbox/growth-inbox-action-center-workflow-embeds.tsx")
  assert.match(workflowEmbeds, /GrowthOnDemandFeature/)
  assert.match(workflowEmbeds, /sequenceExitCandidates/)
  console.log("  ✓ action center Tier 3 embeds use on-demand wrapper")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /loadOnMount=\{false\}/)
  console.log("  ✓ conversational playbooks do not load on mount")

  const realtimeRefresh = readSource("lib/growth/realtime-events/use-growth-realtime-refresh.ts")
  assert.match(realtimeRefresh, /isGrowthRealtimeEventBusRuntimeActive/)
  console.log("  ✓ realtime refresh bails when event bus cold")

  const subscriber = readSource("lib/growth/realtime-events/realtime-events-subscriber.ts")
  assert.match(subscriber, /isGrowthRealtimeEventBusRuntimeActive|isGrowthFeatureApiEnabled/)
  console.log("  ✓ realtime subscriber no-ops when event bus cold")
}

function runInventoryDisposition(): void {
  console.log("\n=== Phase 8J inventory disposition ===\n")

  const initialKeep = GROWTH_INBOX_MINIMAL_RUNTIME_INVENTORY.filter(
    (row) => row.phase === "initial" && row.disposition === "keep",
  )
  const initialRoutes = initialKeep.map((row) => row.route)
  for (const allowed of GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES) {
    assert.ok(
      initialRoutes.some((route) => route === allowed || route.startsWith(allowed)),
      `initial keep inventory includes ${allowed}`,
    )
  }

  const tier2InitialDisabled = GROWTH_INBOX_MINIMAL_RUNTIME_INVENTORY.filter(
    (row) => row.tier === 2 && row.phase === "initial" && row.disposition === "disable",
  )
  assert.ok(tier2InitialDisabled.length >= 2, "Tier 2 initial routes marked disable")
  console.log("  ✓ inventory initial-load disposition matches allowlist")
}

function main(): void {
  console.log("Phase 8J — Inbox minimal runtime verification")
  runContractGuards()
  runTier3FeatureKeys()
  runSourceWiring()
  runInventoryDisposition()
  console.log("\n✅ Phase 8J verification passed\n")
}

main()
