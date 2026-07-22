/** GE-AIOS-HOTFIX-LIVE-8B-4 — Canonical ASL ↔ research outcome reconciliation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE } from "@/lib/growth/memory/storage/organization-memory-types"
import { isOrganizationMemorySchemaReady } from "@/lib/growth/memory/storage/organization-memory-schema-health"
import { upsertOrganizationMemoryEvents } from "@/lib/growth/memory/storage/organization-memory-repository"
import type { GrowthLeadResearchTrigger } from "@/lib/growth/research/growth-lead-research-execution-service"
import { fetchProspectResearchRunById } from "@/lib/growth/research/research-repository"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import { logAutonomousSalesLoopEvent } from "@/lib/growth/specialists/execution/autonomous-sales-loop-observability"
import { AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS } from "@/lib/growth/specialists/execution/autonomous-sales-loop-observability"
import { buildSalesOutcomeMemoryEvent } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import { finalizeSalesSpecialistOutcomes } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { mapCompletedProspectResearchRunToSalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-mappers"
import { isGoodEnoughForEarlyOutreachFromRun } from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

export const GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER =
  "ge-aios-hotfix-live-8b-4-outcome-reconciliation-v1" as const

export const ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX = "asl-research-outcome:" as const

export type ReconcileAslProspectResearchOutcomeInput = {
  organizationId: string
  leadId: string
  run: GrowthResearchRunPublicView
  trigger: GrowthLeadResearchTrigger
  workItemId?: string | null
  qualificationRan?: boolean
  generatedAt?: string
}

export type ReconcileAslProspectResearchOutcomeResult = {
  qaMarker: typeof GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER
  reconciled: boolean
  skipped: boolean
  skipReason:
    | "not_sales_loop"
    | "run_not_completed"
    | "already_reconciled"
    | "invalid_outcome"
    | "memory_schema_unavailable"
    | null
  runId: string
  workItemId: string | null
  memoryEventId: string | null
}

export function buildAslResearchOutcomeMemoryEventId(runId: string): string {
  return `${ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX}${runId}`
}

export function resolveAslResearchWorkItemId(input: {
  workItemId?: string | null
  leadId: string
}): string {
  const explicit = input.workItemId?.trim()
  if (explicit) return explicit
  return `work:research:queue:${input.leadId}`
}

export async function hasAslProspectResearchOutcomeBeenReconciled(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<boolean> {
  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady) return false

  const memoryEventId = buildAslResearchOutcomeMemoryEventId(input.runId)
  const { data, error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE)
    .select("memory_event_id")
    .eq("organization_id", input.organizationId)
    .eq("memory_event_id", memoryEventId)
    .maybeSingle()

  if (error) return false
  return Boolean(data?.memory_event_id)
}

export async function reconcileAslProspectResearchOutcome(
  admin: SupabaseClient,
  input: ReconcileAslProspectResearchOutcomeInput,
): Promise<ReconcileAslProspectResearchOutcomeResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const memoryEventId = buildAslResearchOutcomeMemoryEventId(input.run.id)
  const workItemId = resolveAslResearchWorkItemId({
    workItemId: input.workItemId,
    leadId: input.leadId,
  })

  const baseResult = {
    qaMarker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
    reconciled: false,
    skipped: true,
    skipReason: null as ReconcileAslProspectResearchOutcomeResult["skipReason"],
    runId: input.run.id,
    workItemId,
    memoryEventId,
  }

  if (input.trigger !== "sales_loop") {
    return { ...baseResult, skipReason: "not_sales_loop" }
  }

  if (input.run.status !== "completed") {
    return { ...baseResult, skipReason: "run_not_completed" }
  }

  if (
    await hasAslProspectResearchOutcomeBeenReconciled(admin, {
      organizationId: input.organizationId,
      runId: input.run.id,
    })
  ) {
    return { ...baseResult, skipReason: "already_reconciled" }
  }

  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady) {
    return { ...baseResult, skipReason: "memory_schema_unavailable" }
  }

  const mapped = mapCompletedProspectResearchRunToSalesOutcome({
    run: input.run,
    workItemId,
    leadId: input.leadId,
    qualificationRan: input.qualificationRan ?? false,
  })
  if (!mapped) {
    return { ...baseResult, skipReason: "invalid_outcome" }
  }

  const [validated] = finalizeSalesSpecialistOutcomes({
    organizationId: input.organizationId,
    generatedAt,
    outcomes: [mapped],
  })
  if (!validated) {
    return { ...baseResult, skipReason: "invalid_outcome" }
  }

  const memoryEvent = buildSalesOutcomeMemoryEvent({
    organizationId: input.organizationId,
    generatedAt,
    outcome: validated,
  })

  memoryEvent.id = memoryEventId
  memoryEvent.metadata = {
    ...memoryEvent.metadata,
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
    research_run_id: input.run.id,
    work_item_id: workItemId,
    trigger: input.trigger,
    reconciliation_authority: "reconcileAslProspectResearchOutcome",
  }

  const persist = await upsertOrganizationMemoryEvents(admin, {
    organizationId: input.organizationId,
    events: [memoryEvent],
  })

  logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.OUTCOME_RECONCILED, {
    organization_id: input.organizationId,
    lead_id: input.leadId,
    run_id: input.run.id,
    work_item_id: workItemId,
    outcome_type: validated.outcome_type,
    memory_event_id: memoryEventId,
    reconciliation_qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
    memory_inserted: persist.inserted,
  })

  logGrowthEngine("autonomous_sales_loop_outcome_reconciled", {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    run_id: input.run.id,
    work_item_id: workItemId,
    outcome_type: validated.outcome_type,
    memory_event_id: memoryEventId,
  })

  if (isGoodEnoughForEarlyOutreachFromRun(input.run)) {
    void import("@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service")
      .then(({ runAutonomousOutreachPreparationManualRequest }) =>
        runAutonomousOutreachPreparationManualRequest(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          generatedAt,
        }),
      )
      .catch(() => undefined)
  }

  return {
    ...baseResult,
    reconciled: persist.inserted > 0 || persist.skipped > 0,
    skipped: false,
    skipReason: null,
  }
}

export function scheduleAslProspectResearchOutcomeReconciliation(
  admin: SupabaseClient,
  input: ReconcileAslProspectResearchOutcomeInput,
): void {
  void reconcileAslProspectResearchOutcome(admin, input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("autonomous_sales_loop_outcome_reconciliation_failed", {
      qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      run_id: input.run.id,
      message: message.slice(0, 240),
    })
  })
}

const ACTIVE_RUN_RECONCILIATION_POLL_MS = 5_000
const ACTIVE_RUN_RECONCILIATION_MAX_WAIT_MS = 20 * 60 * 1000

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function scheduleAslProspectResearchOutcomeReconciliationForActiveRun(
  admin: SupabaseClient,
  input: Omit<ReconcileAslProspectResearchOutcomeInput, "run"> & { runId: string },
): void {
  void (async () => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < ACTIVE_RUN_RECONCILIATION_MAX_WAIT_MS) {
      const run = await fetchProspectResearchRunById(admin, input.runId)
      if (!run) return
      if (run.status === "completed") {
        await reconcileAslProspectResearchOutcome(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          run,
          trigger: input.trigger,
          workItemId: input.workItemId,
          qualificationRan: input.qualificationRan,
          generatedAt: input.generatedAt,
        })
        return
      }
      if (run.status === "failed") return
      await sleepMs(ACTIVE_RUN_RECONCILIATION_POLL_MS)
    }
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("autonomous_sales_loop_active_run_reconciliation_failed", {
      qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      run_id: input.runId,
      message: message.slice(0, 240),
    })
  })
}

export async function countReconciledAslResearchOutcomesSince(
  admin: SupabaseClient,
  input: { organizationId: string; sinceIso: string },
): Promise<{ count: number; runIds: string[] }> {
  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady) return { count: 0, runIds: [] }

  const { data, error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE)
    .select("memory_event_id, metadata")
    .eq("organization_id", input.organizationId)
    .like("memory_event_id", `${ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX}%`)
    .gte("occurred_at", input.sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(50)

  if (error) return { count: 0, runIds: [] }

  const runIds = (data ?? [])
    .map((row) => {
      const metadata = row.metadata as Record<string, unknown> | null
      return typeof metadata?.research_run_id === "string" ? metadata.research_run_id : null
    })
    .filter((runId): runId is string => Boolean(runId))

  return { count: runIds.length, runIds }
}
