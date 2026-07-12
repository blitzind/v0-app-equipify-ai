/**
 * SV1-1 / ARCH-1A — Resource Allocation Facade runtime (server-only).
 * Shadow mode: decide + ledger; never changes production allow/deny.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import {
  buildResourceAllocationLedgerEntry,
  recordResourceAllocationLedgerEntry,
} from "@/lib/growth/resource-allocation/resource-allocation-ledger"
import {
  AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE,
  type AiOsResourceAllocationDecision,
  type AiOsResourceAllocationRequest,
} from "@/lib/growth/resource-allocation/resource-allocation-types"

/**
 * Evaluate Resource Allocation and record the ledger.
 * Always returns a decision. Never throws. Never blocks callers in shadow mode.
 */
export async function evaluateAndRecordResourceAllocation(
  admin: SupabaseClient | null,
  request: AiOsResourceAllocationRequest,
): Promise<AiOsResourceAllocationDecision> {
  const decision = evaluateResourceAllocationFacade({
    ...request,
    mode: request.mode ?? AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE,
  })

  // Hard invariant: SV1-1 shadow never applies enforcement.
  const shadowSafe: AiOsResourceAllocationDecision = {
    ...decision,
    mode: decision.mode === "enforce" ? "shadow" : decision.mode,
    enforcement_applied: false,
  }

  const entry = buildResourceAllocationLedgerEntry({ request, decision: shadowSafe })
  await recordResourceAllocationLedgerEntry(admin, entry)
  return shadowSafe
}

/**
 * Shadow-only helper for call sites: log what would authorize/deny, then return decision
 * without affecting execution. Callers must ignore spend_authorized for branching in SV1-1.
 */
export async function shadowEvaluateResourceAllocation(
  admin: SupabaseClient | null,
  request: AiOsResourceAllocationRequest,
): Promise<AiOsResourceAllocationDecision> {
  return evaluateAndRecordResourceAllocation(admin, {
    ...request,
    mode: "shadow",
  })
}
