/**
 * GE-AIOS-FIRST-CUSTOMER-PIPELINE-SCALING-1C — Funnel metrics helpers (client-safe).
 */

export const GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER =
  "ge-aios-first-customer-pipeline-scaling-1c-v1" as const

export type PipelineFunnelStage = {
  id: string
  label: string
  count: number
  conversionFromPrevious: number | null
  cumulativeFromProvider: number | null
}

export function buildPipelineFunnelStages(
  counts: Record<string, number>,
  stageOrder: Array<{ id: string; label: string }>,
): PipelineFunnelStage[] {
  const stages: PipelineFunnelStage[] = []
  const providerCount = counts[stageOrder[0]?.id ?? "provider_records"] ?? 0

  for (let index = 0; index < stageOrder.length; index += 1) {
    const stage = stageOrder[index]!
    const count = counts[stage.id] ?? 0
    const previousCount = index > 0 ? (counts[stageOrder[index - 1]!.id] ?? 0) : null
    stages.push({
      id: stage.id,
      label: stage.label,
      count,
      conversionFromPrevious:
        previousCount != null && previousCount > 0 ? count / previousCount : index === 0 ? 1 : null,
      cumulativeFromProvider: providerCount > 0 ? count / providerCount : index === 0 ? 1 : null,
    })
  }

  return stages
}

export function findLargestDropOff(stages: PipelineFunnelStage[]): {
  stageId: string
  label: string
  dropOffPct: number
  fromCount: number
  toCount: number
} | null {
  let worst: {
    stageId: string
    label: string
    dropOffPct: number
    fromCount: number
    toCount: number
  } | null = null

  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1]!
    const current = stages[index]!
    if (previous.count <= 0) continue
    const retained = current.count / previous.count
    const dropOffPct = 1 - retained
    if (!worst || dropOffPct > worst.dropOffPct) {
      worst = {
        stageId: current.id,
        label: current.label,
        dropOffPct,
        fromCount: previous.count,
        toCount: current.count,
      }
    }
  }

  return worst
}

export function projectWeeklyQualifiedOpportunities(input: {
  outreachEligiblePerRun: number
  completedRunsPerWeek: number
  expectedImprovementMultiplier: number
}): {
  currentPerWeek: number
  projectedPerWeek: number
  basis: string
} {
  const currentPerWeek = input.outreachEligiblePerRun * input.completedRunsPerWeek
  const projectedPerWeek = currentPerWeek * input.expectedImprovementMultiplier
  return {
    currentPerWeek,
    projectedPerWeek,
    basis: `${input.completedRunsPerWeek} completed runs/week × ${input.outreachEligiblePerRun} outreach-eligible/run`,
  }
}

export function assessDailySupervisedSalesReadiness(input: {
  outreachEligibleLeads: number
  packagesReady: number
  minWeeklyQualified: number
  currentWeeklyQualified: number
}): {
  ready: boolean
  reason: string
} {
  if (input.outreachEligibleLeads < 2) {
    return {
      ready: false,
      reason: `Only ${input.outreachEligibleLeads} outreach-eligible lead(s) in production — need sustained pipeline before daily supervised workflow`,
    }
  }
  if (input.packagesReady < 1) {
    return {
      ready: false,
      reason: "No approval-ready packages despite eligible leads — package generation bottleneck",
    }
  }
  if (input.currentWeeklyQualified < input.minWeeklyQualified) {
    return {
      ready: false,
      reason: `Projected ${input.currentWeeklyQualified.toFixed(1)} qualified opportunities/week — below ${input.minWeeklyQualified} minimum for daily supervised sales`,
    }
  }
  return {
    ready: true,
    reason: `${input.outreachEligibleLeads} outreach-eligible leads and ${input.packagesReady} approval-ready package(s) on file`,
  }
}
