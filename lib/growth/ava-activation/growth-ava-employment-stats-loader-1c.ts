/** GE-AIOS-LAUNCH-1C — Employment history stats from existing production read models. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
  type GrowthAvaEmploymentStats,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { loadGrowthOrganizationalEffectivenessBaselineFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-production-loader-next-3a"

function formatActivationLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function countOutcomesSince(
  outcomes: GrowthHomeSalesOutcomesPayload["outcomes"],
  types: string[],
  sinceAt: string | null,
): number {
  const sinceMs = sinceAt ? Date.parse(sinceAt) : 0
  return outcomes.filter((row) => {
    if (!types.includes(row.outcome_type)) return false
    if (!sinceAt) return true
    return Date.parse(row.completed_at) >= sinceMs
  }).length
}

export async function buildGrowthAvaEmploymentStats(input: {
  admin: SupabaseClient
  organizationId: string
  activatedAt: string | null
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  generatedAt: string
}): Promise<GrowthAvaEmploymentStats> {
  const sinceAt = input.activatedAt
  const outcomes = input.salesOutcomes.outcomes

  const companiesResearched = countOutcomesSince(outcomes, ["research_completed"], sinceAt)
  const opportunitiesPrepared = countOutcomesSince(outcomes, ["outreach_prepared", "approval_pending"], sinceAt)

  let approvalsCompleted: number | null = null
  let companiesRejected: number | null = null

  try {
    const baseline = await loadGrowthOrganizationalEffectivenessBaselineFromProduction({
      admin: input.admin,
      organizationId: input.organizationId,
    })
    approvalsCompleted = baseline.rawEvidence.packages.packagesApproved
    companiesRejected = baseline.rawEvidence.qualification.rejectedCount
  } catch {
    approvalsCompleted = null
    companiesRejected = null
  }

  const discoveryCyclesToday =
    input.missionDiscovery?.newCompaniesFound != null && input.missionDiscovery.newCompaniesFound > 0
      ? 1
      : input.salesOutcomes.dailySummary.researched > 0
        ? 1
        : null

  let autonomousMinutesToday: number | null = null
  try {
    const budget = await getAutonomyBudgetSnapshot(input.admin, {
      organizationId: input.organizationId,
      capability: "research",
    })
    if (budget && budget.consumed > 0) {
      autonomousMinutesToday = budget.consumed
    }
  } catch {
    autonomousMinutesToday = null
  }

  const daysActive =
    input.activatedAt != null
      ? Math.max(1, Math.ceil((Date.parse(input.generatedAt) - Date.parse(input.activatedAt)) / 86400000))
      : null

  return {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activatedAt: input.activatedAt,
    activatedLabel: input.activatedAt ? formatActivationLabel(input.activatedAt) : null,
    daysActive,
    companiesResearched,
    opportunitiesPrepared,
    approvalsCompleted,
    companiesRejected,
    discoveryCyclesToday,
    autonomousMinutesToday,
  }
}
