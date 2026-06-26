/** GE-AIOS-GROWTH-3C — Execution runtime read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import {
  buildExecutionRuntimeSystemSummary,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  isActiveExecutionState,
  summarizeExecutionRuntimeRecord,
  type GrowthLeadResearchExecutionRecord,
  type GrowthLeadResearchExecutionRuntimeReadModel,
  type GrowthLeadResearchExecutionRuntimeSummaryItem,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import {
  buildDryRunEligiblePlans,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import { GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import {
  buildExecutionRuntimePilotPlanQueues,
  resolveExecutionRuntimeEffectiveEnabled,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import { GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  createGrowthLeadResearchExecutionRuntimeStore,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"

function nowIso(): string {
  return new Date().toISOString()
}

function mapSummary(record: GrowthLeadResearchExecutionRecord): GrowthLeadResearchExecutionRuntimeSummaryItem {
  return summarizeExecutionRuntimeRecord(record, buildAiOsPilotLeadResearchHref(record.leadId))
}

export async function buildGrowthLeadResearchExecutionRuntimeReadModel(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runtimeEnabledOverride?: boolean
    pilotEnabledOverride?: boolean
    generatedAt?: string
  },
): Promise<GrowthLeadResearchExecutionRuntimeReadModel> {
  const flags = await resolveExecutionRuntimeEffectiveEnabled(admin, {
    organizationId: input.organizationId,
    runtimeOverride: input.runtimeEnabledOverride,
    pilotOverride: input.pilotEnabledOverride,
  })
  const store = createGrowthLeadResearchExecutionRuntimeStore(admin, input.organizationId)
  const records = await store.list(input.organizationId)
  const summaries = records.map(mapSummary)
  const dryRunEligiblePlans = await buildDryRunEligiblePlans(admin, {
    organizationId: input.organizationId,
  })
  const { pilotSummary, pilotEligiblePlans, pilotBlockedPlans } =
    await buildExecutionRuntimePilotPlanQueues(admin, {
      organizationId: input.organizationId,
      runtimeOverride: flags.runtimeEnabled,
      pilotOverride: flags.pilotEnabled,
    })

  const executionAuditSummaries = await Promise.all(
    records
      .filter((record) => !["queued"].includes(record.state))
      .slice(0, 12)
      .map(async (record) => ({
        executionId: record.executionId,
        entries: await store.listAudit(record.executionId),
      })),
  )

  return {
    qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
    generatedAt: input.generatedAt ?? nowIso(),
    runtimeEnabled: flags.runtimeEnabled,
    runtimeRule: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE,
    dryRunRule: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
    pilotSummary,
    pilotRule: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE,
    pilotEligiblePlans,
    pilotBlockedPlans,
    dryRunEligiblePlans,
    executionAuditSummaries,
    systemSummary: buildExecutionRuntimeSystemSummary({
      runtimeEnabled: flags.effectiveRuntimeEnabled,
      records,
    }),
    queuedExecutions: summaries.filter((row) => row.state === "queued"),
    activeExecutions: summaries.filter((row) => isActiveExecutionState(row.state)),
    pausedExecutions: summaries.filter((row) => row.state === "paused"),
    completedExecutions: summaries.filter((row) => row.state === "completed"),
    failedExecutions: summaries.filter((row) => row.state === "failed"),
    cancelledExecutions: summaries.filter((row) => row.state === "cancelled"),
  }
}

export async function findExecutionRuntimeRecordForPlan(
  admin: SupabaseClient,
  input: { organizationId: string; planId: string },
): Promise<GrowthLeadResearchExecutionRecord | null> {
  const store = createGrowthLeadResearchExecutionRuntimeStore(admin, input.organizationId)
  const executionId = `glr-exec:${input.planId}`
  return store.get(executionId)
}

export async function listExecutionRuntimeAuditHistory(
  admin: SupabaseClient,
  input: { organizationId: string; executionId: string },
) {
  const store = createGrowthLeadResearchExecutionRuntimeStore(admin, input.organizationId)
  return store.listAudit(input.executionId)
}
