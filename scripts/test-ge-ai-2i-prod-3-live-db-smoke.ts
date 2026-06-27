/**
 * GE-AI-2I-PROD-3 — Live DB smoke harness (dry-run by default).
 * Run: pnpm test:ge-ai-2i-prod-3-live-db-smoke
 *
 * Live writes require:
 *   GROWTH_AUTONOMOUS_OUTBOUND_LIVE_DB_SMOKE=1
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/growth-engine-session"
import {
  fetchAutonomousOutboundActionByIdempotencyKey,
  insertAutonomousOutboundScope,
  insertAutonomousOutboundScopeAction,
  updateAutonomousOutboundScope,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import {
  isGrowthAutonomousOutboundScopeSchemaReady,
  probeGrowthAutonomousOutboundScopeSchema,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health"
import { submitOperatorAutonomousOutboundScopeActivation } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service"
import { buildDefaultAutonomousOutboundScope } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-service"
import { GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

const LIVE_FLAG = process.env.GROWTH_AUTONOMOUS_OUTBOUND_LIVE_DB_SMOKE === "1"

async function main(): Promise<void> {
  console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE}] Live DB smoke harness`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const organizationId = getGrowthEngineAiOrgId()

  console.log("Mode:", LIVE_FLAG ? "LIVE_WRITES" : "DRY_RUN")
  console.log("Supabase URL configured:", Boolean(url))
  console.log("Service role configured:", Boolean(serviceKey))
  console.log("Organization ID:", organizationId ?? "(missing)")

  if (!LIVE_FLAG) {
    console.log("[DRY_RUN] Skipping live mutations. Set GROWTH_AUTONOMOUS_OUTBOUND_LIVE_DB_SMOKE=1 to execute writes after migration apply.")
    console.log("[DRY_RUN] Expected steps when live:")
    console.log("  1. probeGrowthAutonomousOutboundScopeSchema → ready")
    console.log("  2. insert draft scope")
    console.log("  3. mark approved")
    console.log("  4. operator activation")
    console.log("  5. insert blocked action + idempotency duplicate")
    console.log("  6. mark scope expired (cleanup)")
    console.log("  7. verify sendOccurred=false throughout")
    return
  }

  if (!url || !serviceKey) {
    throw new Error("Live smoke requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }
  if (!organizationId) {
    throw new Error("Live smoke requires GROWTH_ENGINE_AI_ORG_ID.")
  }

  const { createServiceRoleSupabaseClient } = await import("@/lib/billing/service-role-client")
  const admin = createServiceRoleSupabaseClient() as SupabaseClient
  const health = await probeGrowthAutonomousOutboundScopeSchema(admin)
  assert.equal(health.ready, true, `schema not ready: ${JSON.stringify(health.missing_objects ?? [])}`)
  assert.equal(await isGrowthAutonomousOutboundScopeSchemaReady(admin), true)

  const operatorUserId = randomUUID()
  const draft = buildDefaultAutonomousOutboundScope({
    organizationId,
    source: "human_approval_center",
    sourceId: `live-smoke-${Date.now()}`,
    approvedByUserId: operatorUserId,
    title: "Live DB smoke scope",
    summary: "GE-AI-2I-PROD-3 smoke — delete or expire after run",
    audience: { leadIds: [randomUUID()] },
    limits: { maxActionsTotal: 2, maxActionsPerDay: 2, maxActionsPerLead: 1 },
    expiresInDays: 1,
  })

  const inserted = await insertAutonomousOutboundScope(admin, { ...draft, status: "draft" })
  const approved = await updateAutonomousOutboundScope(admin, {
    ...inserted,
    status: "approved",
    approvedByUserId: operatorUserId,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const activation = await submitOperatorAutonomousOutboundScopeActivation(admin, {
    organizationId,
    scopeId: approved.id,
    operatorUserId,
  })
  assert.equal(activation.sendOccurred, false)
  if (!activation.ok) {
    console.warn("[LIVE] Activation blocked (expected if Growth Autonomy kill switch off):", activation.message)
  } else {
    assert.equal(activation.scope?.status, "active")
  }

  const idempotencyKey = `${approved.id}:lead-smoke:send_email:none`
  const action = await insertAutonomousOutboundScopeAction(admin, {
    id: randomUUID(),
    scopeId: approved.id,
    organizationId,
    actionType: "send_email",
    channel: "email",
    status: "blocked",
    leadId: randomUUID(),
    transportPath: "sequence_execution.runSequenceExecutionJob",
    blockedReason: "live_smoke_blocked_action",
    correlationId: randomUUID(),
    idempotencyKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  const duplicate = await insertAutonomousOutboundScopeAction(admin, { ...action, id: randomUUID() })
  assert.equal(duplicate.id, action.id)

  const fetched = await fetchAutonomousOutboundActionByIdempotencyKey(admin, {
    organizationId,
    idempotencyKey,
  })
  assert.ok(fetched)

  await updateAutonomousOutboundScope(admin, {
    ...(activation.scope ?? approved),
    status: "expired",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
  })

  console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE}] PASS — Live DB smoke completed (scope ${approved.id})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
