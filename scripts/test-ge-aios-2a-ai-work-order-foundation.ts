/**
 * GE-AIOS-2A — AI Work Order foundation certification.
 * Run: pnpm test:ge-aios-2a-ai-work-order-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_WORK_ORDER_AGENTS,
  AI_WORK_ORDER_STATUSES,
  AI_WORK_ORDER_TYPES,
  GROWTH_AIOS_2A_PHASE,
  GROWTH_AI_WORK_ORDER_QA_MARKER,
  GROWTH_AI_WORK_ORDER_SCHEMA_MIGRATION,
  clampAiWorkOrderPriority,
} from "../lib/growth/aios/ai-work-order-types"
import {
  canCancelAiWorkOrderStatus,
  canRetryAiWorkOrder,
  canTransitionAiWorkOrderStatus,
} from "../lib/growth/aios/ai-work-order-status-machine"
import { aiWorkOrderSchemaCatalog } from "../lib/growth/aios/ai-work-order-repository"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(
      source.includes(token),
      false,
      `${relativePath} must not reference ${token}`,
    )
  }
}

console.log(`[${GROWTH_AIOS_2A_PHASE}] AI Work Order foundation certification`)

// --- Constitutional types ---
assert.equal(GROWTH_AI_WORK_ORDER_QA_MARKER, "growth-aios-2a-ai-work-order-v1")
assert.equal(GROWTH_AI_WORK_ORDER_SCHEMA_MIGRATION, "20271001120000_growth_aios_2a_ai_work_orders.sql")
assert.equal(AI_WORK_ORDER_STATUSES.length, 11)
assert.ok(AI_WORK_ORDER_AGENTS.includes("research"))
assert.ok(AI_WORK_ORDER_AGENTS.includes("executive_brain"))
assert.ok(AI_WORK_ORDER_TYPES.includes("research_company"))
assert.ok(AI_WORK_ORDER_TYPES.includes("verify_email"))
assert.equal(clampAiWorkOrderPriority(1500), 1000)
assert.equal(clampAiWorkOrderPriority(-10), 0)

// --- Status machine ---
assert.equal(canTransitionAiWorkOrderStatus("issued", "planning"), true)
assert.equal(canTransitionAiWorkOrderStatus("completed", "executing"), false)
assert.equal(canCancelAiWorkOrderStatus("executing"), true)
assert.equal(canCancelAiWorkOrderStatus("completed"), false)
assert.equal(
  canRetryAiWorkOrder({ status: "failed", retryCount: 1, maxRetries: 3 }),
  true,
)
assert.equal(
  canRetryAiWorkOrder({ status: "failed", retryCount: 3, maxRetries: 3 }),
  false,
)

// --- Migration exists and uses growth schema only ---
const migration = readSource(`supabase/migrations/${GROWTH_AI_WORK_ORDER_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.ai_work_orders"))
assert.ok(migration.includes("growth.ai_work_order_events"))
assert.ok(migration.includes("organization_growth_objectives"))
assert.ok(migration.includes("decision_record_ids"))
assert.ok(migration.includes("memory_refs"))
assert.ok(migration.includes("depends_on"))
assert.equal(migration.includes("public.work_orders"), false)
assert.equal(migration.includes("references public.work_orders"), false)

// --- Service layer is infrastructure-only (no provider/LLM imports) ---
const serviceSource = readSource("lib/growth/aios/ai-work-order-service.ts")
const forbiddenServicePatterns = [
  "openai",
  "anthropic",
  "apollo",
  "pdl",
  "sendEmail",
  "transport",
  "llm",
  "executive-brain",
  "decision-engine",
]
for (const pattern of forbiddenServicePatterns) {
  assert.equal(
    serviceSource.toLowerCase().includes(pattern),
    false,
    `service must not import ${pattern}`,
  )
}

// --- Scope boundary: aios modules must not touch core domains ---
const aiosFiles = [
  "lib/growth/aios/ai-work-order-types.ts",
  "lib/growth/aios/ai-work-order-status-machine.ts",
  "lib/growth/aios/ai-work-order-repository.ts",
  "lib/growth/aios/ai-work-order-service.ts",
  "lib/growth/aios/ai-work-order-schema-health.ts",
]
const coreForbidden = [
  "from \"@/app/(portal)",
  "from '@/app/(portal)",
  "public.invoices",
  "public.quotes",
  "public.customers",
  "blitzpay",
]
for (const file of aiosFiles) {
  assertNoCoreTouch(file, coreForbidden)
}

// --- Schema catalog ---
const catalog = aiWorkOrderSchemaCatalog()
assert.deepEqual(catalog.qaMarker, GROWTH_AI_WORK_ORDER_QA_MARKER)
assert.equal(catalog.statuses.length, 11)
assert.equal(catalog.types.length, 13)

console.log(`[${GROWTH_AIOS_2A_PHASE}] PASS — AI Work Order foundation certified (local)`)
