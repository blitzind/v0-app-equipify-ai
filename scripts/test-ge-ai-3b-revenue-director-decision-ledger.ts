/**
 * GE-AI-3B — Revenue Director Decision Ledger certification.
 * Run: pnpm test:ge-ai-3b-revenue-director-decision-ledger
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_EVENT_REGISTRY, isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import {
  buildRevenueDirectorWorkflowRequestIdempotencyKey,
  canTransitionDecisionStatus,
  canTransitionWorkflowRequestStatus,
  computeRevenueDirectorSnapshotHash,
  resolveLedgerWorkflowVisibility,
  synthesizeEmptyDecisionLedgerReadModel,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-helpers"
import { enrichRevenueDirectorWithDecisionLedger } from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-service"
import {
  mapRevenueDirectorDecisionRow,
  mapRevenueDirectorDecisionEventRow,
  mapRevenueDirectorWorkflowRequestRow,
  revenueDirectorDecisionLedgerSchemaCatalog,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import { GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_OBJECTS } from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health"
import {
  GROWTH_AIOS_GE_AI_3B_PHASE,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import { synthesizeGrowthRevenueDirectorReadModel } from "../lib/growth/aios/revenue-director/growth-revenue-director-engine"
import {
  GROWTH_REVENUE_DIRECTOR_QA_MARKER,
  type GrowthRevenueDirectorCommandCenterSnapshot,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_3B_PHASE}] Revenue Director Decision Ledger certification`)

assert.equal(
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION,
  "20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql",
)
assert.ok(GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE.includes("no auto-dispatch"))

const requiredFiles = [
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-types.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-helpers.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-repository.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-service.ts",
  "supabase/migrations/20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql",
  "app/api/platform/growth/ai-os/revenue-director/decisions/route.ts",
  "app/api/platform/growth/ai-os/revenue-director/decisions/[id]/accept/route.ts",
  "app/api/platform/growth/ai-os/revenue-director/decisions/[id]/cancel/route.ts",
  "docs/GE-AI-3B_REVENUE_DIRECTOR_DECISION_LEDGER.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const migration = readSource(`supabase/migrations/${GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.revenue_director_decisions"))
assert.ok(migration.includes("growth.revenue_director_workflow_requests"))
assert.ok(migration.includes("growth.revenue_director_decision_events"))
assert.ok(migration.includes("revenue_director_workflow_requests_idempotency_uidx"))
assert.ok(migration.includes("service_role"))
assert.equal(migration.includes("public.invoices"), false)

const catalog = revenueDirectorDecisionLedgerSchemaCatalog()
assert.equal(catalog.qaMarker, GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER)
assert.deepEqual(catalog.tables, [
  "revenue_director_decisions",
  "revenue_director_workflow_requests",
  "revenue_director_decision_events",
])
assert.equal(GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_OBJECTS.length, 3)

const decisionService = readSource("lib/growth/aios/revenue-director/growth-revenue-director-decision-service.ts")
assert.ok(decisionService.includes('import "server-only"'))
assert.ok(decisionService.includes("syncRevenueDirectorDecisionLedger"))
assert.ok(decisionService.includes("acceptRevenueDirectorDecision"))
assert.ok(decisionService.includes("cancelRevenueDirectorDecision"))
assert.ok(decisionService.includes("publishGrowthAiEvent"))
assert.equal(decisionService.includes("runSequenceExecutionJob"), false)
assert.equal(decisionService.includes("dispatchWorkflow"), false)

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("syncRevenueDirectorDecisionLedger"))
assert.ok(commandCenterService.includes("enrichRevenueDirectorWithDecisionLedger"))
assert.ok(commandCenterService.includes("revenueDirectorDecisionLedger"))

const acceptRoute = readSource("app/api/platform/growth/ai-os/revenue-director/decisions/[id]/accept/route.ts")
assert.ok(acceptRoute.includes("requireGrowthOperatorAccess"))
assert.ok(acceptRoute.includes("dispatched: false"))
assert.equal(acceptRoute.includes("runSequenceExecutionJob"), false)

const cancelRoute = readSource("app/api/platform/growth/ai-os/revenue-director/decisions/[id]/cancel/route.ts")
assert.ok(cancelRoute.includes("requireGrowthOperatorAccess"))
assert.ok(cancelRoute.includes("dispatched: false"))

const decisionsRoute = readSource("app/api/platform/growth/ai-os/revenue-director/decisions/route.ts")
assert.equal(decisionsRoute.includes("POST"), false)

for (const eventType of Object.values(GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES)) {
  assert.equal(isRegisteredAiEventType(eventType), true, `${eventType} must be registered`)
}

const forbiddenCore = ["public.invoices", "public.contacts", "core_memory", "mutateCore"]
for (const file of [
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-service.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-decision-repository.ts",
]) {
  assertNoCoreTouch(file, forbiddenCore)
}

const keyA = buildRevenueDirectorWorkflowRequestIdempotencyKey({
  organizationId: "org-1",
  advisoryRequestId: "rev-dir-abc",
})
const keyB = buildRevenueDirectorWorkflowRequestIdempotencyKey({
  organizationId: "org-1",
  advisoryRequestId: "rev-dir-abc",
})
assert.equal(keyA, keyB)
assert.equal(keyA, "rev-dir-req:org-1:rev-dir-abc")

const snapA = computeRevenueDirectorSnapshotHash({
  organizationId: "org-1",
  generatedAt: "2026-06-25T14:00:00.000Z",
  revenueHealth: "on_pace",
  workflowRequestIds: ["b", "a"],
})
const snapB = computeRevenueDirectorSnapshotHash({
  organizationId: "org-1",
  generatedAt: "2026-06-25T14:00:00.000Z",
  revenueHealth: "on_pace",
  workflowRequestIds: ["a", "b"],
})
assert.equal(snapA, snapB)

assert.equal(canTransitionDecisionStatus("proposed", "accepted"), true)
assert.equal(canTransitionDecisionStatus("completed", "accepted"), false)
assert.equal(canTransitionWorkflowRequestStatus("proposed", "accepted"), true)
assert.equal(canTransitionWorkflowRequestStatus("superseded", "accepted"), false)

const visibility = resolveLedgerWorkflowVisibility({
  idempotencyKey: "rev-dir-req:org-1:rev-dir-abc",
  existingStatusByKey: new Map([["rev-dir-req:org-1:rev-dir-abc", "accepted"]]),
})
assert.equal(visibility, "accepted")

const emptyLedger = synthesizeEmptyDecisionLedgerReadModel({
  generatedAt: "2026-06-25T14:00:00.000Z",
  schemaReady: false,
})
assert.equal(emptyLedger.schemaReady, false)
assert.equal(emptyLedger.summary.pendingDecisions, 0)

const mappedDecision = mapRevenueDirectorDecisionRow({
  id: "dec-1",
  organization_id: "org-1",
  snapshot_hash: "snap-1",
  decision_type: "executive_orchestration_snapshot",
  status: "proposed",
  title: "Test",
  summary: "Summary",
  confidence: 80,
  priority_score: 75,
  evidence: [{ source: "meta", label: "Score", value: 80 }],
  risks: [{ label: "Risk", severity: "low", summary: "ok" }],
  created_at: "2026-06-25T14:00:00.000Z",
  updated_at: "2026-06-25T14:00:00.000Z",
  superseded_at: null,
})
assert.equal(mappedDecision.evidence[0]?.label, "Score")

const mappedRequest = mapRevenueDirectorWorkflowRequestRow({
  id: "req-1",
  organization_id: "org-1",
  decision_id: "dec-1",
  request_type: "run_research",
  target_workflow_agent: "research",
  status: "proposed",
  advisory: true,
  subject_type: "lead",
  subject_id: "lead-1",
  objective_id: null,
  mission_id: null,
  lead_id: "lead-1",
  title: "Research lead",
  summary: "Run research",
  priority_score: 80,
  requires_human_approval: true,
  idempotency_key: "rev-dir-req:org-1:rev-dir-abc",
  correlation_id: "corr-1",
  evidence: [{ source: "priority", label: "Rank", value: 1 }],
  route: "/growth/leads/lead-1",
  created_at: "2026-06-25T14:00:00.000Z",
  updated_at: "2026-06-25T14:00:00.000Z",
  accepted_at: null,
  dispatched_at: null,
  completed_at: null,
  cancelled_at: null,
  superseded_at: null,
})
assert.equal(mappedRequest.route, "/growth/leads/lead-1")
assert.equal(mappedRequest.evidence[0]?.source, "priority")

const mappedEvent = mapRevenueDirectorDecisionEventRow({
  id: "evt-1",
  organization_id: "org-1",
  decision_id: "dec-1",
  workflow_request_id: "req-1",
  event_type: "proposed",
  payload: { advisoryOnly: true },
  created_at: "2026-06-25T14:00:00.000Z",
})
assert.equal(mappedEvent.eventType, "proposed")

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx")
assert.ok(ui.includes("ledgerSummary"))
assert.ok(ui.includes("ledgerStatus"))
assert.equal(ui.includes("dispatchWorkflow"), false)

const registryCount = AI_EVENT_REGISTRY.filter((row) =>
  row.eventType.startsWith("growth.revenue_director."),
).length
assert.ok(registryCount >= 8)

console.log("[GE-AI-3B] Static certification passed — running GE-AI-3A regression")
execSync("pnpm test:ge-ai-3a-revenue-director-foundation", { stdio: "inherit" })

console.log("[GE-AI-3B] Revenue Director Decision Ledger certification PASSED")
