/** GE-AIOS-17A — Server loader: existing workflow agent read models → Sales Specialist outcomes. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-service"
import { buildGrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { buildGrowthAutonomousQualificationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import { buildGrowthAutonomousResearchPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-service"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  buildSalesOutcomeDailySummary,
  mapMeetingRunToSalesOutcome,
  mapOutreachRunToSalesOutcome,
  mapQualificationRunToSalesOutcome,
  mapResearchLoopLeadToSalesOutcomes,
  mapResearchRunToSalesOutcome,
} from "@/lib/growth/specialists/execution/sales-outcome-mappers"
import { finalizeSalesSpecialistOutcomes } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"

export async function buildGrowthHomeSalesOutcomes(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt: string
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  pendingApprovals: number
}): Promise<GrowthHomeSalesOutcomesPayload> {
  const [researchPilot, qualificationPilot, outreachPilot, meetingPilot] = await Promise.all([
    buildGrowthAutonomousResearchPilotReadModel(input.admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    buildGrowthAutonomousQualificationPilotReadModel(input.admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    buildGrowthAutonomousOutreachPreparationPilotReadModel(input.admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    buildGrowthAutonomousMeetingPilotReadModel(input.admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
  ])

  const rawOutcomes = [
    ...(researchPilot?.recentRuns ?? [])
      .map(mapResearchRunToSalesOutcome)
      .filter((row): row is NonNullable<typeof row> => row != null),
    ...(qualificationPilot?.recentRuns ?? [])
      .map(mapQualificationRunToSalesOutcome)
      .filter((row): row is NonNullable<typeof row> => row != null),
    ...(outreachPilot?.recentRuns ?? [])
      .map(mapOutreachRunToSalesOutcome)
      .filter((row): row is NonNullable<typeof row> => row != null),
    ...(meetingPilot?.recentRuns ?? [])
      .map(mapMeetingRunToSalesOutcome)
      .filter((row): row is NonNullable<typeof row> => row != null),
    ...(input.researchLoopSummary?.leadResults ?? []).flatMap((lead) =>
      mapResearchLoopLeadToSalesOutcomes(lead, input.researchLoopSummary?.completedAt ?? input.generatedAt),
    ),
  ]

  const outcomes = finalizeSalesSpecialistOutcomes({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    outcomes: rawOutcomes,
  })

  const dailySummary = buildSalesOutcomeDailySummary({
    outcomes,
    generatedAt: input.generatedAt,
    approvalsPendingOverride: input.pendingApprovals > 0 ? input.pendingApprovals : undefined,
  })

  return {
    qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    outcomes,
    dailySummary,
  }
}
