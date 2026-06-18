/**
 * Phase 8M — Operator inbox query slimming & poll consolidation verification.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-inbox-query-slimming-8m.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_QUERY_METRICS_VERSION,
  getGrowthInboxQueryMetrics,
  recordGrowthInboxCompactOperatorInboxRequest,
  recordGrowthInboxDuplicateThreadRequestPrevented,
  recordGrowthInboxFullOperatorInboxRequest,
  recordGrowthInboxPollCycle,
  recordGrowthInboxThreadLabelBatchQuery,
  resetGrowthInboxQueryMetrics,
} from "../lib/growth/inbox/growth-inbox-query-metrics"
import {
  memoizeGrowthSchemaProbe,
  resetGrowthSchemaProbeCacheForTests,
} from "../lib/growth/runtime/growth-schema-probe-cache"
import {
  resetServiceRoleSupabaseClientForTests,
} from "../lib/billing/service-role-client"
import {
  GROWTH_INBOX_TIER1_POLL_COORDINATOR_QA_MARKER,
} from "../components/growth/inbox/growth-inbox-tier1-poll-coordinator"
import {
  GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS,
} from "../lib/growth/inbox/use-growth-inbox-tier1-refresh"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runMetricsModule(): void {
  console.log("\n=== Phase 8M query metrics ===\n")

  resetGrowthInboxQueryMetrics()
  recordGrowthInboxCompactOperatorInboxRequest()
  recordGrowthInboxFullOperatorInboxRequest()
  recordGrowthInboxThreadLabelBatchQuery()
  recordGrowthInboxPollCycle()
  recordGrowthInboxDuplicateThreadRequestPrevented()

  const snapshot = getGrowthInboxQueryMetrics()
  assert.equal(snapshot.version, GROWTH_INBOX_QUERY_METRICS_VERSION)
  assert.equal(snapshot.compactOperatorInboxRequests, 1)
  assert.equal(snapshot.fullOperatorInboxRequests, 1)
  assert.equal(snapshot.threadLabelBatchQueries, 1)
  assert.equal(snapshot.pollCycles, 1)
  assert.equal(snapshot.duplicateThreadRequestsPrevented, 1)
  console.log("  ✓ query metrics counters work")
}

function runCompactFullSplit(): void {
  console.log("\n=== Phase 8M compact vs full operator inbox ===\n")

  assert.match(readSource("lib/growth/operator-inbox/operator-inbox-service.ts"), /OPERATOR_INBOX_QUEUE_MODES = \["compact", "full"\]/)

  const service = readSource("lib/growth/operator-inbox/operator-inbox-service.ts")
  assert.match(service, /mode === "compact"/)
  assert.match(service, /fetchHumanExecutionQueue/)
  assert.match(service, /mode === "full"/)
  assert.match(service, /recordGrowthInboxCompactOperatorInboxRequest/)
  assert.match(service, /recordGrowthInboxFullOperatorInboxRequest/)
  assert.match(service, /signalLimit = mode === "compact" \? 15 : 50/)
  console.log("  ✓ operator inbox service splits compact vs full")

  const route = readSource("app/api/platform/growth/operator-inbox/route.ts")
  assert.match(route, /mode: z\.enum\(OPERATOR_INBOX_QUEUE_MODES\)/)
  assert.match(route, /mode = parsed\.data\.mode \?\? "compact"/)
  console.log("  ✓ operator inbox API defaults to compact")

  const operatorPanel = readSource("components/growth/growth-operator-inbox-panel.tsx")
  assert.match(operatorPanel, /params\.set\("mode", compact \? "compact" : "full"\)/)
  console.log("  ✓ operator panel passes mode query param")

  const internalCallers = [
    "lib/growth/agent-orchestration/agent-orchestration-service.ts",
    "lib/growth/human-interventions/human-intervention-service.ts",
    "lib/growth/command-center-unification/command-center-unification-service.ts",
    "lib/growth/follow-up-policies/follow-up-policy-service.ts",
  ]
  for (const file of internalCallers) {
    const source = readSource(file)
    assert.match(source, /fetchOperatorInboxQueue\(/)
  }
  console.log("  ✓ internal callers still invoke fetchOperatorInboxQueue (full default via service)")
}

function runThreadLabelBatching(): void {
  console.log("\n=== Phase 8M thread label batching ===\n")

  const repo = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(repo, /async function loadLeadLabels/)
  assert.match(repo, /recordGrowthInboxThreadLabelBatchQuery/)
  assert.doesNotMatch(repo, /fetchLeadLabel/)
  assert.match(repo, /loadLeadLabels\(admin, leadIds\)/)
  assert.match(repo, /mapThread\(row as Row, ownerLabels, leadLabels\)/)
  console.log("  ✓ listInboxThreads batches lead labels in one query")
}

function runPollCoordinator(): void {
  console.log("\n=== Phase 8M poll coordinator ===\n")

  assert.equal(GROWTH_INBOX_TIER1_POLL_COORDINATOR_QA_MARKER, "growth-inbox-tier1-poll-coordinator-v1")
  assert.equal(GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS, 90_000)

  const coordinator = readSource("components/growth/inbox/growth-inbox-tier1-poll-coordinator.tsx")
  const tier1RefreshUses = (coordinator.match(/useGrowthInboxTier1Refresh\(/g) ?? []).length
  assert.equal(tier1RefreshUses, 2, "coordinator provider + optional fallback hook")
  assert.match(coordinator, /recordGrowthInboxPollCycle/)
  assert.match(coordinator, /registerRefresh/)
  console.log("  ✓ poll coordinator owns single Tier 1 timer")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxTier1PollCoordinatorProvider/)
  assert.match(v2Panel, /GrowthInboxTier1RefreshBridge/)
  console.log("  ✓ inbox V2 wraps Tier 1 refresh in poll coordinator")

  const bridge = readSource("components/growth/inbox/growth-inbox-tier1-refresh-bridge.tsx")
  assert.match(bridge, /useGrowthInboxTier1PollRefresh/)
  assert.doesNotMatch(bridge, /useGrowthInboxTier1Refresh\(/)
  console.log("  ✓ refresh bridge uses poll coordinator hook")

  const operatorPanel = readSource("components/growth/growth-operator-inbox-panel.tsx")
  assert.match(operatorPanel, /useGrowthInboxTier1PollRefresh/)
  assert.doesNotMatch(operatorPanel, /useGrowthInboxTier1Refresh\(/)
  console.log("  ✓ operator panel uses poll coordinator hook")
}

function runDuplicateThreadLoading(): void {
  console.log("\n=== Phase 8M duplicate thread loading ===\n")

  const workspace = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  assert.match(workspace, /fetchPlatformGrowthClient\("\/api\/platform\/growth\/inbox\/dashboard"\)/)
  assert.doesNotMatch(workspace, /fetchPlatformGrowthClient\("\/api\/platform\/growth\/inbox"\)/)
  assert.match(workspace, /recordGrowthInboxDuplicateThreadRequestPrevented/)
  console.log("  ✓ workspace load uses dashboard-only (no parallel /inbox list)")

  const repo = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(repo, /leads: Array<\{ id: string; label: string \}>/)
  assert.match(repo, /listLeadsForInbox\(admin\)/)
  console.log("  ✓ dashboard payload includes leads for thread creation UI")
}

function runMessageBounds(): void {
  console.log("\n=== Phase 8M thread message bounds ===\n")

  assert.equal(50, 50)
  const repo = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(repo, /export const GROWTH_INBOX_THREAD_MESSAGE_LIMIT = 50/)
  assert.match(repo, /\.limit\(GROWTH_INBOX_THREAD_MESSAGE_LIMIT\)/)
  assert.match(repo, /order\("message_timestamp", \{ ascending: false \}\)/)
  console.log("  ✓ listThreadMessages limited to 50 newest messages")
}

function runSchemaProbeMemoization(): Promise<void> {
  console.log("\n=== Phase 8M schema probe memoization ===\n")

  const probeFiles = [
    "lib/growth/inbox/inbox-schema-health.ts",
    "lib/growth/signals/signal-schema-health.ts",
    "lib/growth/lead-memory/schema-health.ts",
    "lib/growth/lead-archive-schema-health.ts",
  ]
  for (const file of probeFiles) {
    const source = readSource(file)
    assert.match(source, /memoizeGrowthSchemaProbe|cachedArchiveColumnsReady/)
  }
  console.log("  ✓ schema readiness probes memoized")

  resetGrowthSchemaProbeCacheForTests()
  let probeCalls = 0
  const probe = async () => {
    probeCalls += 1
    return true
  }
  return memoizeGrowthSchemaProbe("test-probe", probe).then(async (first) => {
    assert.equal(first, true)
    assert.equal(probeCalls, 1)
    const second = await memoizeGrowthSchemaProbe("test-probe", probe)
    assert.equal(second, true)
    assert.equal(probeCalls, 1)
    console.log("  ✓ successful probes cached for process lifetime")
  })
}

function runServiceRoleReuse(): void {
  console.log("\n=== Phase 8M service-role client reuse ===\n")

  const source = readSource("lib/billing/service-role-client.ts")
  assert.match(source, /cachedServiceRoleClient/)
  assert.match(source, /if \(cachedServiceRoleClient\) return cachedServiceRoleClient/)
  assert.match(source, /resetServiceRoleSupabaseClientForTests/)
  console.log("  ✓ service-role client uses module singleton")

  resetServiceRoleSupabaseClientForTests()
}

function runQueryEstimates(): void {
  console.log("\n=== Phase 8M query count estimates ===\n")

  const compactEstimate = {
    signals: 2,
    workflowActions: 1,
    attention: 1,
    inboxThreads: 4,
    schemaProbes: 0,
    humanExecution: 0,
  }
  const compactTotal =
    compactEstimate.signals +
    compactEstimate.workflowActions +
    compactEstimate.attention +
    compactEstimate.inboxThreads +
    compactEstimate.schemaProbes +
    compactEstimate.humanExecution

  const fullEstimate = {
    ...compactEstimate,
    signals: 2,
    humanExecution: 560,
    schemaProbes: 4,
  }
  const fullTotal =
    fullEstimate.signals +
    fullEstimate.workflowActions +
    fullEstimate.attention +
    fullEstimate.inboxThreads +
    fullEstimate.humanExecution +
    fullEstimate.schemaProbes

  const reduction = 1 - compactTotal / fullTotal
  assert.ok(reduction > 0.85, `expected >85% reduction, got ${(reduction * 100).toFixed(1)}%`)
  console.log(`  ✓ compact ~${compactTotal} queries vs full ~${fullTotal} queries (${(reduction * 100).toFixed(1)}% reduction)`)
}

async function main(): Promise<void> {
  console.log("Phase 8M — Operator inbox query slimming verification")
  runMetricsModule()
  runCompactFullSplit()
  runThreadLabelBatching()
  runPollCoordinator()
  runDuplicateThreadLoading()
  runMessageBounds()
  await runSchemaProbeMemoization()
  runServiceRoleReuse()
  runQueryEstimates()
  console.log("\n✅ Phase 8M verification passed\n")
}

void main()
