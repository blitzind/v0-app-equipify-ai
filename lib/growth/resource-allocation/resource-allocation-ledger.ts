/**
 * SV1-1 — Resource Allocation Ledger (server-only).
 * Lightweight internal ledger via runtime_guardrail_audit_log + in-memory buffer for certs.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import {
  AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
  type AiOsResourceAllocationDecision,
  type AiOsResourceAllocationLedgerEntry,
  type AiOsResourceAllocationRequest,
} from "@/lib/growth/resource-allocation/resource-allocation-types"

const MAX_MEMORY_ENTRIES = 200

const memoryLedger: AiOsResourceAllocationLedgerEntry[] = []

function nextEntryId(): string {
  return `ral_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildResourceAllocationLedgerEntry(input: {
  request: AiOsResourceAllocationRequest
  decision: AiOsResourceAllocationDecision
}): AiOsResourceAllocationLedgerEntry {
  return {
    qaMarker: AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
    entryId: nextEntryId(),
    organizationId: input.request.organizationId,
    accountId: input.request.accountId,
    accountKind: input.request.accountKind ?? "lead",
    resourceRequested: input.request.resourceClass,
    resourceClass: input.decision.resource_class,
    estimatedResourceClass: input.decision.cost_tier,
    investmentState: input.decision.investment_state,
    decision: input.decision.spend_authorized ? "authorize" : "deny",
    spendAuthorized: input.decision.spend_authorized,
    reason: input.decision.reason,
    mode: input.decision.mode,
    enforcementApplied: input.decision.enforcement_applied,
    requestedBy: input.request.requestedBy ?? null,
    timestamp: input.decision.decided_at,
    blockingConditions: input.decision.blocking_conditions,
    confidence: input.decision.confidence,
  }
}

export function peekResourceAllocationMemoryLedger(): readonly AiOsResourceAllocationLedgerEntry[] {
  return memoryLedger
}

export function clearResourceAllocationMemoryLedger(): void {
  memoryLedger.length = 0
}

export async function recordResourceAllocationLedgerEntry(
  admin: SupabaseClient | null,
  entry: AiOsResourceAllocationLedgerEntry,
): Promise<void> {
  memoryLedger.unshift(entry)
  if (memoryLedger.length > MAX_MEMORY_ENTRIES) {
    memoryLedger.length = MAX_MEMORY_ENTRIES
  }

  logGrowthEngine("resource_allocation_ledger", {
    qa_marker: entry.qaMarker,
    entry_id: entry.entryId,
    organization_id: entry.organizationId,
    account_id: entry.accountId,
    resource_requested: entry.resourceRequested,
    investment_state: entry.investmentState,
    decision: entry.decision,
    spend_authorized: entry.spendAuthorized,
    reason: entry.reason,
    mode: entry.mode,
    enforcement_applied: entry.enforcementApplied,
    estimated_resource_class: entry.estimatedResourceClass,
    timestamp: entry.timestamp,
  })

  if (!admin) return

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: entry.organizationId,
      resourceType: `resource_allocation:${entry.resourceRequested}`,
      severity: entry.spendAuthorized ? "info" : "warning",
      message: `Resource Allocation ${entry.decision} (${entry.mode}) — ${entry.investmentState}`,
      context: {
        qa_marker: entry.qaMarker,
        ledger: entry,
      },
    })
  } catch {
    // Ledger must never fail callers.
  }
}
