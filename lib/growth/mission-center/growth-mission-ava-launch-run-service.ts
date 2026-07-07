/** GE-AVA-AUTONOMY-LAUNCH-RUN-1 — Compose existing Growth services into one Ava launch run (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { isLeadResearchPilotEnabled } from "@/lib/growth/aios/pilot/lead-research-pilot-config"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  importDatamoonAudiencePreviewRecords,
  pollDatamoonAudienceImportRun,
  startDatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import { bindFindLeadsSearchToMission } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
  type GrowthMissionAvaLaunchRunResult,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import { registerAvaAutonomyCompletionPendingLeads } from "@/lib/growth/mission-center/growth-ava-autonomy-completion-service"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

export type RunGrowthMissionAvaLaunchRunInput = {
  organizationId: string
  missionId: string
  audienceDraft: AvaDatamoonAudienceDraft
  searchSummary: string
  approvedByUser: boolean
  keepMonitoring?: boolean
  refreshCadence?: "daily" | "weekly"
  actor: { userId: string | null; email?: string | null }
}

export type RunGrowthMissionAvaLaunchRunSuccess = {
  ok: true
  result: GrowthMissionAvaLaunchRunResult
}

export type RunGrowthMissionAvaLaunchRunFailure = {
  ok: false
  error: string
  status: number
  runId?: string | null
}

function resolveSearchSummary(input: RunGrowthMissionAvaLaunchRunInput): string {
  const explicit = input.searchSummary.trim()
  if (explicit) return explicit
  const audienceName = input.audienceDraft.audienceName.trim()
  if (audienceName) return audienceName
  return "Find Leads search"
}

async function resolveLeadResearchStatuses(
  admin: SupabaseClient,
  organizationId: string,
  leadIds: string[],
): Promise<GrowthMissionAvaLaunchRunResult["research"]> {
  const pilotEnabled = isLeadResearchPilotEnabled()
  const leads = await Promise.all(
    leadIds.slice(0, 25).map(async (leadId) => {
      const snapshot = pilotEnabled
        ? await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, { organizationId, leadId })
        : null
      return {
        leadId,
        workflowStatus: snapshot?.workflowStatus ?? null,
        researchPilotEnabled: pilotEnabled,
      }
    }),
  )
  return { pilotEnabled, leads }
}

async function resolveHumanApprovalSummary(
  admin: SupabaseClient,
  organizationId: string,
  importedLeadIds: string[],
): Promise<GrowthMissionAvaLaunchRunResult["humanApprovalCenter"]> {
  const commandCenter = await fetchAiOsCommandCenterReadModel(admin, { organizationId })
  const importedSet = new Set(importedLeadIds)
  const pendingItems = commandCenter.humanApprovalCenter.items.filter(
    (item) => item.status === "pending" || item.status === "needs_review" || item.status === "blocked",
  )
  const relatedItems =
    importedSet.size > 0
      ? pendingItems.filter(
          (item) =>
            item.subjectType === "lead" &&
            typeof item.subjectId === "string" &&
            importedSet.has(item.subjectId),
        )
      : []
  const topSource = relatedItems.length > 0 ? relatedItems : pendingItems

  return {
    totalPending: pendingItems.length,
    topItems: topSource.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel ?? "general",
      href: item.route ?? null,
      leadId: item.subjectType === "lead" ? (item.subjectId ?? null) : null,
    })),
    approvalsHref: "/growth/os/approvals",
  }
}

export async function runGrowthMissionAvaLaunchRun(
  admin: SupabaseClient,
  input: RunGrowthMissionAvaLaunchRunInput,
): Promise<RunGrowthMissionAvaLaunchRunSuccess | RunGrowthMissionAvaLaunchRunFailure> {
  if (!input.approvedByUser) {
    return { ok: false, error: "approved_by_user_required", status: 400 }
  }

  const profileState = await fetchBusinessProfileWorkspaceState(admin, input.organizationId)
  if (!profileState.schemaReady) {
    return { ok: false, error: "growth_profile_schema_not_ready", status: 503 }
  }
  if (!profileState.activeApproved) {
    return { ok: false, error: "growth_profile_not_approved", status: 412 }
  }

  const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
  if (!objective) {
    return { ok: false, error: "mission_not_found", status: 404 }
  }
  if (objective.organizationId !== input.organizationId) {
    return { ok: false, error: "mission_org_mismatch", status: 403 }
  }

  const datamoonRequest = buildDatamoonImportRequestFromAudienceDraft(input.audienceDraft)
  const searchSummary = resolveSearchSummary(input)
  const keepMonitoring = input.keepMonitoring ?? true

  const started = await startDatamoonAudienceImportRun(admin, datamoonRequest, input.actor)
  if (!started.ok) {
    return { ok: false, error: started.error, status: started.error === "datamoon_provider_disabled" ? 503 : 400 }
  }

  const bound = await bindFindLeadsSearchToMission(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    datamoonRequest,
    searchSummary,
    source: "find_leads",
    approvedByUser: true,
    keepMonitoring,
    lastRunId: started.run.id,
    refreshCadence: input.refreshCadence ?? "daily",
  })
  if (!bound.ok) {
    return { ok: false, error: bound.error, status: bound.status, runId: started.run.id }
  }

  const polled = await pollDatamoonAudienceImportRun(admin, started.run.id)
  if (!polled.ok) {
    return { ok: false, error: polled.error, status: 400, runId: started.run.id }
  }

  const previewCount = polled.run.previewCount ?? 0
  const runReady = polled.run.status === "completed" || polled.run.status === "imported_partial"
  if (!runReady) {
    return {
      ok: false,
      error: "datamoon_poll_incomplete",
      status: 409,
      runId: started.run.id,
    }
  }

  let imported = 0
  let duplicates = 0
  let skipped = 0
  let errors = 0
  let leadIds: string[] = []

  if (previewCount > 0) {
    try {
      const importResult = await importDatamoonAudiencePreviewRecords(admin, started.run.id, {
        importAllPreviewed: true,
        actor: input.actor,
      })
      imported = importResult.imported
      duplicates = importResult.duplicates
      skipped = importResult.skipped
      errors = importResult.errors
      leadIds = importResult.leadIds
    } catch (error) {
      const message = error instanceof Error ? error.message : "datamoon_import_failed"
      return { ok: false, error: message, status: 500, runId: started.run.id }
    }
  }

  if (leadIds.length > 0) {
    await registerAvaAutonomyCompletionPendingLeads(admin, {
      organizationId: input.organizationId,
      missionId: input.missionId,
      leadIds,
    })
  }

  const [research, humanApprovalCenter] = await Promise.all([
    resolveLeadResearchStatuses(admin, input.organizationId, leadIds),
    resolveHumanApprovalSummary(admin, input.organizationId, leadIds),
  ])

  logGrowthEngine("growth_mission_ava_launch_run_completed", {
    qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
    mission_id: input.missionId,
    run_id: started.run.id,
    imported,
    preview_count: previewCount,
    pending_approvals: humanApprovalCenter.totalPending,
  })

  return {
    ok: true,
    result: {
      qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
      missionId: input.missionId,
      runId: started.run.id,
      binding: bound.binding,
      import: {
        imported,
        duplicates,
        skipped,
        errors,
        leadIds,
        previewCount,
      },
      research,
      humanApprovalCenter,
      stoppedAt: "human_approval",
    },
  }
}
