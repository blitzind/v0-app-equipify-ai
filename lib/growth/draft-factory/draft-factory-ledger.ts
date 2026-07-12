/**
 * SV1-3 — Draft Factory ledger (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import {
  AI_OS_DRAFT_FACTORY_QA_MARKER,
  type AiOsDraftFactoryAdvanceResult,
  type AiOsDraftFactoryBatchResult,
} from "@/lib/growth/draft-factory/draft-factory-types"

export async function recordDraftFactoryAdvanceLedger(
  admin: SupabaseClient | null,
  input: {
    organizationId: string
    advance: AiOsDraftFactoryAdvanceResult
  },
): Promise<void> {
  const payload = {
    qa_marker: AI_OS_DRAFT_FACTORY_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.advance.leadId,
    previous_state: input.advance.previousState,
    next_state: input.advance.nextState,
    stages_skipped: input.advance.stagesSkipped,
    stage_executed: input.advance.stageExecuted,
    resumed_from: input.advance.resumedFrom,
    duplicate_prevented: input.advance.duplicatePrevented,
    blocked_reason: input.advance.blockedReason,
    transport_blocked: true,
    package_id: input.advance.package?.factoryPackageId ?? null,
  }

  logGrowthEngine("draft_factory_advance", payload)

  if (!admin) return
  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: "draft_factory:advance",
      severity: input.advance.blockedReason ? "warning" : "info",
      message: `Draft Factory ${input.advance.previousState} → ${input.advance.nextState}`,
      context: payload,
    })
  } catch {
    // Observability must never fail callers.
  }
}

export async function recordDraftFactoryBatchLedger(
  admin: SupabaseClient | null,
  batch: AiOsDraftFactoryBatchResult,
): Promise<void> {
  const payload = {
    qa_marker: batch.qaMarker,
    organization_id: batch.organizationId,
    evaluated: batch.evaluated,
    advanced: batch.advanced,
    packages_ready: batch.packagesReady,
    skipped_budget: batch.skippedBudget,
    skipped_ineligible: batch.skippedIneligible,
    failed: batch.failed,
    duplicates_prevented: batch.duplicatesPrevented,
    capacity: batch.capacity,
  }

  logGrowthEngine("draft_factory_batch", payload)

  if (!admin) return
  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: batch.organizationId,
      resourceType: "draft_factory:batch",
      severity: "info",
      message: `Draft Factory batch — ${batch.packagesReady} approval-ready / ${batch.evaluated} evaluated`,
      context: payload,
    })
  } catch {
    // ignore
  }
}
