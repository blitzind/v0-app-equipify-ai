/** GE-AVA-MISSION-RUNTIME-1B — Bind Find Leads search to mission (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { normalizeDatamoonImportRequestAudience } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  parseIntentLevelsFromDatamoonRequest,
  parseLookbackDaysFromDatamoonRequest,
  requestHasOnlyNewSinceLastRefresh,
  GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER,
} from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import {
  missionLifecycleActivityLabel,
  type GrowthMissionRuntimeDatamoonBinding,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { bindMissionDatamoonImportRequest } from "@/lib/growth/mission-center/growth-mission-runtime-orchestrator"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

export type BindFindLeadsToMissionInput = {
  organizationId: string
  missionId: string
  datamoonRequest: DatamoonAudienceImportRequest
  searchSummary: string
  source: "find_leads"
  approvedByUser: boolean
  keepMonitoring?: boolean
  lastRunId?: string | null
  refreshCadence?: "daily" | "weekly"
}

export type MissionFindLeadsBindingSummary = {
  qa_marker: typeof GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER
  missionId: string
  searchAttached: boolean
  audienceName: string | null
  searchSummary: string
  provider: "datamoon_audience"
  keepMonitoring: boolean
  refreshCadence: "daily" | "weekly"
  lastRunId: string | null
  onlyNewSinceLastRefresh: boolean
  monitoringStatus: string
  activityLabel: string
}

function finalizeDatamoonRequestForBinding(
  request: DatamoonAudienceImportRequest,
  keepMonitoring: boolean,
): DatamoonAudienceImportRequest {
  const normalized = normalizeDatamoonImportRequestAudience(request)
  if (!keepMonitoring || requestHasOnlyNewSinceLastRefresh(normalized)) {
    return normalized
  }
  return normalizeDatamoonImportRequestAudience({
    ...normalized,
    workbench_context: {
      ...normalized.workbench_context,
      onlyNewSinceLastRefresh: true,
    },
  })
}

function buildDatamoonBindingMetadata(
  input: BindFindLeadsToMissionInput,
  request: DatamoonAudienceImportRequest,
): Omit<GrowthMissionRuntimeDatamoonBinding, "lastRunId" | "importRequestJson" | "lastPollAt" | "lastImportedCount"> {
  return {
    provider: "datamoon_audience",
    source: input.source,
    searchSummary: input.searchSummary.trim() || null,
    audienceName: request.name?.trim() || request.run_name.trim() || null,
    lookbackDays: parseLookbackDaysFromDatamoonRequest(request),
    intentLevels: parseIntentLevelsFromDatamoonRequest(request),
    onlyNewSinceLastRefresh: requestHasOnlyNewSinceLastRefresh(request),
    refreshCadence: input.refreshCadence ?? "daily",
    boundAt: new Date().toISOString(),
    keepMonitoring: input.keepMonitoring ?? true,
  }
}

export async function bindFindLeadsSearchToMission(
  admin: SupabaseClient,
  input: BindFindLeadsToMissionInput,
): Promise<
  | { ok: true; binding: MissionFindLeadsBindingSummary }
  | { ok: false; error: string; status: number }
> {
  if (!input.approvedByUser) {
    return { ok: false, error: "approved_by_user_required", status: 400 }
  }

  if (input.source !== "find_leads") {
    return { ok: false, error: "invalid_source", status: 400 }
  }

  const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
  if (!objective) {
    return { ok: false, error: "mission_not_found", status: 404 }
  }

  if (objective.organizationId !== input.organizationId) {
    return { ok: false, error: "mission_org_mismatch", status: 403 }
  }

  const keepMonitoring = input.keepMonitoring ?? true
  const finalizedRequest = finalizeDatamoonRequestForBinding(input.datamoonRequest, keepMonitoring)
  const metadata = buildDatamoonBindingMetadata(input, finalizedRequest)

  const updated = await bindMissionDatamoonImportRequest(admin, input.organizationId, input.missionId, finalizedRequest, {
    lastRunId: input.lastRunId ?? null,
    metadata,
  })

  if (!updated) {
    return { ok: false, error: "bind_failed", status: 500 }
  }

  const runtime = updated.executionContext?.missionRuntime
  const activityLabel =
    runtime?.activityLabel ??
    missionLifecycleActivityLabel("monitoring", runtime?.counters ?? {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    })

  const binding: MissionFindLeadsBindingSummary = {
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER,
    missionId: input.missionId,
    searchAttached: true,
    audienceName: metadata.audienceName ?? null,
    searchSummary: input.searchSummary.trim(),
    provider: "datamoon_audience",
    keepMonitoring,
    refreshCadence: metadata.refreshCadence ?? "daily",
    lastRunId: input.lastRunId ?? null,
    onlyNewSinceLastRefresh: metadata.onlyNewSinceLastRefresh ?? false,
    monitoringStatus: keepMonitoring ? "Monitoring lead search" : "Search attached (manual refresh)",
    activityLabel,
  }

  logGrowthEngine("growth_mission_find_leads_bound", {
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER,
    mission_id: input.missionId,
    keep_monitoring: keepMonitoring,
    last_run_id: input.lastRunId ?? null,
  })

  return { ok: true, binding }
}

export { selectDefaultFindLeadsMissionId as resolveDefaultFindLeadsMissionId } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
