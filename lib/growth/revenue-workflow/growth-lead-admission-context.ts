/** GE-AIOS-21C — Load admission context from approved profile + active mission (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

function resolveActiveMissionTitle(
  objectives: Awaited<ReturnType<typeof listGrowthObjectives>>,
): string | null {
  const active = objectives.find(
    (objective) =>
      objective.status === "active" &&
      objective.runtime?.running &&
      !objective.emergencyStopActive,
  )
  return active?.title?.trim() || null
}

export async function loadGrowthLeadAdmissionContext(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthLeadAdmissionContext> {
  const [approvedProfileRecord, objectives] = await Promise.all([
    getActiveApprovedBusinessProfile(admin, organizationId),
    listGrowthObjectives(admin, organizationId),
  ])

  const approvedProfile: BusinessProfileDraftContent | null =
    approvedProfileRecord?.profile ?? null

  return {
    approvedProfile,
    activeMissionTitle: resolveActiveMissionTitle(objectives),
  }
}
