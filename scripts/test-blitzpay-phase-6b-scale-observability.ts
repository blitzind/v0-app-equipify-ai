/**
 * BlitzPay Phase 6B — enterprise scale & observability foundations (deterministic helpers + route presence).
 * Run: pnpm test:blitzpay-phase-6b-scale-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hashBlitzpayFinancialEvent, orderBlitzpayFinancialEventIdsForReplay } from "../lib/blitzpay/blitzpay-event-sourcing"
import {
  evaluateBlitzpayIdempotencyRecord,
  normalizeBlitzpayObservabilityIdempotencyKey,
  validateBlitzpayObservabilityIdempotencyKey,
} from "../lib/blitzpay/blitzpay-idempotency"
import {
  buildPhase6bObservabilityReportingSlice,
  deriveMultiRegionReadinessScore,
  deriveObservabilityCoverageRate,
  deriveQueueHealthScoreFromSnapshot,
  deriveReplayIntegrityScore,
  deriveWorkerHealthScoreFromRates,
  detectBlitzpayQueueBackpressure,
} from "../lib/blitzpay/blitzpay-observability"
import {
  hashBlitzpayObservabilityAuditEntry,
  nextBlitzpayWorkflowStatus,
  validateBlitzpayManualReplayRequest,
  validateBlitzpayWorkflowReplayAuthorization,
} from "../lib/blitzpay/blitzpay-workflow-orchestration"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const ORG = "11111111-1111-4111-8111-111111111111"

function mockAdmin(rows: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const data = rows[table] ?? []
      const chain = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        not() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle() {
          return Promise.resolve({ data: data[0] ?? null, error: null })
        },
      }
      return chain
    },
  } as unknown as SupabaseClient
}

async function main(): Promise<void> {
  assert.deepEqual(orderBlitzpayFinancialEventIdsForReplay(["b", "a", "c"]), ["a", "b", "c"])

  const h1 = hashBlitzpayFinancialEvent({
    organizationId: ORG,
    eventType: "payment",
    aggregateType: "invoice",
    aggregateId: null,
    eventVersion: 1,
    eventPayload: { b: 2, a: 1 },
  })
  const h2 = hashBlitzpayFinancialEvent({
    organizationId: ORG,
    eventType: "payment",
    aggregateType: "invoice",
    aggregateId: null,
    eventVersion: 1,
    eventPayload: { a: 1, b: 2 },
  })
  assert.equal(h1, h2)
  assert.equal(h1.length, 64)

  assert.equal(validateBlitzpayObservabilityIdempotencyKey("short").ok, false)
  assert.equal(validateBlitzpayObservabilityIdempotencyKey("long-enough-key").ok, true)
  assert.equal(normalizeBlitzpayObservabilityIdempotencyKey("  abc  "), "abc")

  assert.equal(evaluateBlitzpayIdempotencyRecord({ existingRequestHash: "a", incomingRequestHash: "b" }), "conflict")
  assert.equal(evaluateBlitzpayIdempotencyRecord({ existingRequestHash: "x", incomingRequestHash: "x" }), "replay_same")

  assert.equal(nextBlitzpayWorkflowStatus("queued", "start"), "processing")
  assert.equal(nextBlitzpayWorkflowStatus("processing", "fail"), "failed")
  assert.equal(nextBlitzpayWorkflowStatus("failed", "mark_replayed"), "replayed")
  assert.equal(nextBlitzpayWorkflowStatus("completed", "mark_replayed"), null)

  assert.equal(validateBlitzpayManualReplayRequest({ currentStatus: "failed" }).ok, true)
  assert.equal(validateBlitzpayManualReplayRequest({ currentStatus: "completed" }).ok, false)

  assert.equal(validateBlitzpayWorkflowReplayAuthorization({ orgMemberRole: "owner", userEmail: null }).ok, true)
  assert.equal(validateBlitzpayWorkflowReplayAuthorization({ orgMemberRole: "manager", userEmail: "a@b.com" }).ok, false)

  const ah1 = hashBlitzpayObservabilityAuditEntry({
    organizationId: ORG,
    auditType: "manual_replay",
    auditSummary: "x",
    workflowExecutionId: null,
    financialEventId: null,
    actorType: "admin",
    actorId: null,
    metadata: {},
    pepper: "p",
  })
  assert.equal(ah1.length, 64)

  assert.ok(deriveQueueHealthScoreFromSnapshot({ queueDepth: 0, failedExecutionCount: 0, replayPendingCount: 0, avgProcessingLatencyMs: 0, idempotencyConflictCount: 0, workerHealthScore: 90 }) >= 80)
  assert.ok(deriveWorkerHealthScoreFromRates({ workflowFailureRatePct: 50, idempotencyConflictRatePct: 10 }) < 80)
  assert.equal(deriveMultiRegionReadinessScore([{ sync_status: "active", region_health_score: 80 }]), 80)
  assert.equal(deriveObservabilityCoverageRate(4, 8), 50)
  assert.equal(deriveReplayIntegrityScore(1, 9), 10)
  assert.equal(detectBlitzpayQueueBackpressure({ queueDepth: 30, avgProcessingLatencyMs: 0 }), true)
  assert.equal(detectBlitzpayQueueBackpressure({ queueDepth: 0, avgProcessingLatencyMs: 100 }), false)

  const admin = mockAdmin({
    blitzpay_workflow_executions: [{ execution_status: "failed" }, { execution_status: "completed" }],
    blitzpay_idempotency_records: [{ request_status: "rejected" }, { request_status: "completed" }],
    blitzpay_financial_events: [
      { event_status: "replayed", event_hash: "a" },
      { event_status: "completed", event_hash: null },
    ],
    blitzpay_queue_health_snapshots: [
      {
        queue_depth: 0,
        failed_execution_count: 0,
        replay_pending_count: 0,
        avg_processing_latency_ms: 0,
        idempotency_conflict_count: 0,
        worker_health_score: 95,
      },
    ],
    blitzpay_multi_region_sync_state: [{ sync_status: "active", region_health_score: 100 }],
  })
  const slice = await buildPhase6bObservabilityReportingSlice(admin, ORG)
  assert.ok(slice.queueHealthScore >= 0 && slice.queueHealthScore <= 100)

  const routePaths = [
    "organizations/[organizationId]/blitzpay/observability/events/route.ts",
    "organizations/[organizationId]/blitzpay/observability/workflows/route.ts",
    "organizations/[organizationId]/blitzpay/observability/queue-health/route.ts",
    "organizations/[organizationId]/blitzpay/observability/idempotency/route.ts",
    "organizations/[organizationId]/blitzpay/observability/regions/route.ts",
    "organizations/[organizationId]/blitzpay/observability/workflows/[workflowId]/replay/route.ts",
  ]
  for (const p of routePaths) {
    const src = read(path.join("app/api", p))
    assert.ok(src.includes("requireAnyOrgPermission") || src.includes("requireOrgPermission"), p)
    assert.ok(src.includes("blitzpaySchemaGuardNextResponse"), p)
    assert.ok(src.includes(".limit("), p)
  }

  const healthRoute = read(path.join("app/api", "organizations/[organizationId]/blitzpay/observability/health/route.ts"))
  assert.ok(healthRoute.includes("requireAnyOrgPermission"), "health auth")
  assert.ok(healthRoute.includes("blitzpaySchemaGuardNextResponse"), "health schema guard")
  assert.ok(healthRoute.includes("buildPhase6bObservabilityReportingSlice"), "health uses bounded slice")
  assert.ok(healthRoute.includes("replayAuthorized"), "health exposes replay flag")

  const mobileHealth = read(path.join("app/api", "organizations/[organizationId]/blitzpay/mobile/health/route.ts"))
  assert.ok(mobileHealth.includes("skipObservabilityPhase6b: true"), "nested snapshot skip observability")

  const schema = read("lib/blitzpay/blitzpay-schema-health.ts")
  for (const t of [
    "blitzpay_financial_events",
    "blitzpay_workflow_executions",
    "blitzpay_queue_health_snapshots",
    "blitzpay_idempotency_records",
    "blitzpay_observability_audit_log",
    "blitzpay_multi_region_sync_state",
  ]) {
    assert.ok(schema.includes(t), t)
  }

  const snapSrc = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.ok(snapSrc.includes("skipObservabilityPhase6b"), "reporting skip flag")
  assert.ok(snapSrc.includes("queueHealthScore:"), "reporting field")

  console.log("blitzpay phase 6b tests passed")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
