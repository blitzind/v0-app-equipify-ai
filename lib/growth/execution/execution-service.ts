import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthExecutionDashboard,
  fetchGrowthExecutionQueue,
  fetchGrowthExecutionSprints,
  startGrowthExecutionSprint,
} from "@/lib/growth/execution/execution-dashboard-repository"
import type {
  ExecutionSprintDuration,
  ExecutionSprintType,
  GrowthExecutionDashboard,
  GrowthExecutionQueue,
  GrowthExecutionSprintsResponse,
} from "@/lib/growth/execution/execution-priority-types"
import { GROWTH_REVENUE_EXECUTION_QA_MARKER } from "@/lib/growth/execution/execution-priority-types"

export async function fetchGrowthExecutionDashboardView(
  admin: SupabaseClient,
): Promise<GrowthExecutionDashboard> {
  return fetchGrowthExecutionDashboard(admin)
}

export async function fetchGrowthExecutionQueueView(admin: SupabaseClient): Promise<GrowthExecutionQueue> {
  return fetchGrowthExecutionQueue(admin)
}

export async function fetchGrowthExecutionSprintsView(
  admin: SupabaseClient,
): Promise<GrowthExecutionSprintsResponse> {
  return fetchGrowthExecutionSprints(admin)
}

export async function startGrowthExecutionSprintSession(
  admin: SupabaseClient,
  input: {
    startedByUserId: string | null
    sprintType: ExecutionSprintType
    durationMinutes: ExecutionSprintDuration
  },
) {
  const sprint = await startGrowthExecutionSprint(admin, input)
  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    sprint,
  }
}
