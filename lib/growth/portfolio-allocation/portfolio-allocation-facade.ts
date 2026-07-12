/**
 * SV1-2 / ARCH-2A — Portfolio Allocation Facade runtime (server-only).
 * Shadow mode: decide + ledger; never changes production selection.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluatePortfolioAllocationFacade } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import {
  buildPortfolioAllocationLedgerEntry,
  recordPortfolioAllocationLedgerEntry,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-ledger"
import {
  AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE,
  type AiOsPortfolioAllocationCycleResult,
  type AiOsPortfolioAllocationRequest,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

/**
 * Evaluate Portfolio Allocation and record the shadow ledger.
 * Always returns a cycle result. Never throws into callers. Never applies enforcement in SV1-2.
 */
export async function evaluateAndRecordPortfolioAllocation(
  admin: SupabaseClient | null,
  request: AiOsPortfolioAllocationRequest,
): Promise<AiOsPortfolioAllocationCycleResult> {
  const result = evaluatePortfolioAllocationFacade({
    ...request,
    mode: request.mode ?? AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE,
  })

  const shadowSafe: AiOsPortfolioAllocationCycleResult = {
    ...result,
    mode: "shadow",
    enforcement_applied: false,
  }

  const entry = buildPortfolioAllocationLedgerEntry(shadowSafe)
  await recordPortfolioAllocationLedgerEntry(admin, entry)
  return shadowSafe
}

/**
 * Shadow-only helper: log facade vs existing selection; callers must ignore selectedLeadIds for branching.
 */
export async function shadowEvaluatePortfolioAllocation(
  admin: SupabaseClient | null,
  request: AiOsPortfolioAllocationRequest,
): Promise<AiOsPortfolioAllocationCycleResult> {
  return evaluateAndRecordPortfolioAllocation(admin, {
    ...request,
    mode: "shadow",
  })
}
