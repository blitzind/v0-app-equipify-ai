/**
 * SV1-2 — Portfolio Allocation Ledger (server-only).
 * Lightweight shadow ledger via runtime_guardrail_audit_log + in-memory buffer.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import { buildPortfolioDisplacementNotes } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import {
  AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
  type AiOsPortfolioAllocationCycleResult,
  type AiOsPortfolioLedgerEntry,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

const MAX_MEMORY_ENTRIES = 100
const memoryLedger: AiOsPortfolioLedgerEntry[] = []

function nextEntryId(): string {
  return `pal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildPortfolioAllocationLedgerEntry(
  result: AiOsPortfolioAllocationCycleResult,
): AiOsPortfolioLedgerEntry {
  return {
    qaMarker: AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
    entryId: nextEntryId(),
    organizationId: result.organizationId,
    capacityClass: result.capacityClass,
    capacityAvailable: result.capacitySlotsAvailable,
    capacityFilled: result.capacitySlotsFilled,
    evaluatedAccountIds: result.decisions.map((d) => d.lead_id),
    selectedAccountIds: result.selectedLeadIds,
    deferredAccountIds: result.deferredLeadIds,
    decisions: result.decisions.map((d) => ({
      leadId: d.lead_id,
      rank: d.rank,
      portfolioState: d.portfolio_state,
      investmentState: d.investment_state,
      selected: d.selected,
      priorityScore: d.priority_score,
      missionId: d.mission_id,
      reason: d.reason,
      selectedBecause: d.selected_because,
      deferredBecause: d.deferred_because,
    })),
    displacementNotes: buildPortfolioDisplacementNotes(result),
    existingSelectedLeadIds: result.existingSelectedLeadIds,
    overlapLeadIds: result.overlapLeadIds,
    mismatchReasons: result.mismatch.reasons,
    mode: result.mode,
    enforcementApplied: false,
    timestamp: result.decided_at,
  }
}

export function peekPortfolioAllocationMemoryLedger(): readonly AiOsPortfolioLedgerEntry[] {
  return memoryLedger
}

export function clearPortfolioAllocationMemoryLedger(): void {
  memoryLedger.length = 0
}

export async function recordPortfolioAllocationLedgerEntry(
  admin: SupabaseClient | null,
  entry: AiOsPortfolioLedgerEntry,
): Promise<void> {
  memoryLedger.unshift(entry)
  if (memoryLedger.length > MAX_MEMORY_ENTRIES) {
    memoryLedger.length = MAX_MEMORY_ENTRIES
  }

  logGrowthEngine("portfolio_allocation_ledger", {
    qa_marker: entry.qaMarker,
    entry_id: entry.entryId,
    organization_id: entry.organizationId,
    capacity_class: entry.capacityClass,
    capacity_available: entry.capacityAvailable,
    capacity_filled: entry.capacityFilled,
    selected: entry.selectedAccountIds,
    deferred_count: entry.deferredAccountIds.length,
    overlap: entry.overlapLeadIds,
    mismatches: entry.mismatchReasons.slice(0, 10),
    displacement_notes: entry.displacementNotes.slice(0, 10),
    mode: entry.mode,
    enforcement_applied: entry.enforcementApplied,
    timestamp: entry.timestamp,
  })

  if (!admin) return

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: entry.organizationId,
      resourceType: `portfolio_allocation:${entry.capacityClass}`,
      severity: entry.mismatchReasons.length > 0 ? "warning" : "info",
      message: `Portfolio Allocation shadow cycle — ${entry.selectedAccountIds.length}/${entry.capacityAvailable} slots for ${entry.capacityClass}`,
      context: {
        qa_marker: entry.qaMarker,
        ledger: {
          entryId: entry.entryId,
          capacityClass: entry.capacityClass,
          capacityAvailable: entry.capacityAvailable,
          capacityFilled: entry.capacityFilled,
          selectedAccountIds: entry.selectedAccountIds,
          deferredAccountIds: entry.deferredAccountIds.slice(0, 50),
          displacementNotes: entry.displacementNotes.slice(0, 20),
          existingSelectedLeadIds: entry.existingSelectedLeadIds,
          overlapLeadIds: entry.overlapLeadIds,
          mismatchReasons: entry.mismatchReasons.slice(0, 20),
          decisions: entry.decisions.slice(0, 40),
          mode: entry.mode,
          enforcementApplied: entry.enforcementApplied,
          timestamp: entry.timestamp,
        },
      },
    })
  } catch {
    // Ledger must never fail callers.
  }
}
