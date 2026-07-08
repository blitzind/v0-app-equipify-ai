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
  startDatamoonAudienceImportRun,
  waitForDatamoonAudienceImportRunPollCompletion,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import { validateDatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import { bindFindLeadsSearchToMission } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
  type GrowthMissionAvaLaunchRunResult,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import { registerAvaAutonomyCompletionPendingLeads } from "@/lib/growth/mission-center/growth-ava-autonomy-completion-service"
import {
  AVA_LAUNCH_STAGE,
  logAvaLaunchStage,
  returnAvaLaunchFailure,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace"
import {
  buildAvaLaunchRootCauseTestException,
  buildAvaLaunchUnexpectedExceptionFailure,
  serializeAvaLaunchRunException,
  shouldThrowAvaLaunchRootCauseTestException,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-exception-transparency"
import { mergeAvaLaunchRunServiceFailure } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-downstream-failure"
import {
  beginAvaLaunchRuntimeObjectTraceSession,
  endAvaLaunchRuntimeObjectTraceSession,
  logAvaRuntimeObjectConstruction,
  logAvaRuntimeTrace,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-runtime-object-trace"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
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
  message?: string
  exception?: import("@/lib/growth/mission-center/growth-mission-ava-launch-run-exception-transparency").AvaLaunchSerializedException
  sourceFailure?: Record<string, unknown>
  issues?: unknown
}

function returnAvaLaunchUnexpectedExceptionFailure(
  error: unknown,
  trace: {
    stage: (typeof AVA_LAUNCH_STAGE)[keyof typeof AVA_LAUNCH_STAGE]
    payload?: unknown
    runId?: string | null
  },
): RunGrowthMissionAvaLaunchRunFailure {
  const failure = buildAvaLaunchUnexpectedExceptionFailure(error, {
    status: 500,
    runId: trace.runId ?? null,
  })
  const exception = failure.exception!
  returnAvaLaunchFailure(failure, {
    stage: trace.stage,
    code: "validation_failed",
    message: exception.message,
    original: error,
    cause: exception.cause,
    stack: exception.stack,
    payload: trace.payload,
  })
  return failure
}

function resolveSearchSummary(input: RunGrowthMissionAvaLaunchRunInput): string {
  const explicit = input.searchSummary.trim()
  if (explicit) return explicit
  const audienceName = input.audienceDraft.audienceName.trim()
  if (audienceName) return audienceName
  return "Find Leads search"
}

function resolveBoundSearchLookup(objective: Awaited<ReturnType<typeof getGrowthObjective>>): {
  hasBoundSearch: boolean
  importRequestJsonLength: number
} {
  const runtime = objective?.executionContext?.missionRuntime
  const importRequestJson = runtime?.datamoon?.importRequestJson ?? null
  const hasBoundSearch =
    runtime?.qa_marker === GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER && Boolean(importRequestJson?.trim())
  return {
    hasBoundSearch,
    importRequestJsonLength: importRequestJson?.length ?? 0,
  }
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
  beginAvaLaunchRuntimeObjectTraceSession({
    missionId: input.missionId,
    organizationId: input.organizationId,
  })

  try {
    if (shouldThrowAvaLaunchRootCauseTestException()) {
      throw buildAvaLaunchRootCauseTestException()
    }

    logAvaRuntimeObjectConstruction({
      label: "input.audienceDraft",
      object: input.audienceDraft,
      constructedBy: {
        file: "app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts",
        function: "POST → runGrowthMissionAvaLaunchRun(input.audienceDraft)",
      },
      stage: AVA_LAUNCH_STAGE.audience_draft,
    })

  logAvaLaunchStage(AVA_LAUNCH_STAGE.audience_draft, {
    missionId: input.missionId,
    organizationId: input.organizationId,
    approvedByUser: input.approvedByUser,
    audienceDraft: input.audienceDraft,
    searchSummary: input.searchSummary,
  })

  if (!input.approvedByUser) {
    return returnAvaLaunchFailure(
      { ok: false, error: "approved_by_user_required", status: 400 },
      {
        stage: AVA_LAUNCH_STAGE.audience_draft,
        code: "approved_by_user_required",
        message: "approved_by_user_required",
        original: { approvedByUser: input.approvedByUser },
        payload: { approvedByUser: input.approvedByUser },
      },
    )
  }

  const profileState = await fetchBusinessProfileWorkspaceState(admin, input.organizationId)
  if (!profileState.schemaReady) {
    return returnAvaLaunchFailure(
      { ok: false, error: "growth_profile_schema_not_ready", status: 503 },
      {
        stage: AVA_LAUNCH_STAGE.audience_draft,
        code: "growth_profile_schema_not_ready",
        message: "growth_profile_schema_not_ready",
        original: profileState,
        payload: { schemaReady: profileState.schemaReady },
      },
    )
  }
  if (!profileState.activeApproved) {
    return returnAvaLaunchFailure(
      { ok: false, error: "growth_profile_not_approved", status: 412 },
      {
        stage: AVA_LAUNCH_STAGE.audience_draft,
        code: "growth_profile_not_approved",
        message: "growth_profile_not_approved",
        original: profileState,
        payload: { activeApproved: profileState.activeApproved },
      },
    )
  }

  logAvaLaunchStage(AVA_LAUNCH_STAGE.mission_lookup, {
    missionId: input.missionId,
    organizationId: input.organizationId,
  })

  const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
  if (!objective) {
    return returnAvaLaunchFailure(
      { ok: false, error: "mission_not_found", status: 404 },
      {
        stage: AVA_LAUNCH_STAGE.mission_lookup,
        code: "mission_not_found",
        message: "mission_not_found",
        original: null,
        payload: { missionId: input.missionId, organizationId: input.organizationId },
      },
    )
  }
  if (objective.organizationId !== input.organizationId) {
    return returnAvaLaunchFailure(
      { ok: false, error: "mission_org_mismatch", status: 403 },
      {
        stage: AVA_LAUNCH_STAGE.mission_lookup,
        code: "mission_org_mismatch",
        message: "mission_org_mismatch",
        original: {
          missionOrganizationId: objective.organizationId,
          requestOrganizationId: input.organizationId,
        },
        payload: {
          missionId: input.missionId,
          missionOrganizationId: objective.organizationId,
          requestOrganizationId: input.organizationId,
        },
      },
    )
  }

  logAvaLaunchStage(AVA_LAUNCH_STAGE.bound_search_lookup, {
    missionId: input.missionId,
    ...resolveBoundSearchLookup(objective),
  })

  logAvaLaunchStage(AVA_LAUNCH_STAGE.provider_request, {
    missionId: input.missionId,
    audienceDraft: input.audienceDraft,
  })

  const datamoonRequest = buildDatamoonImportRequestFromAudienceDraft(input.audienceDraft)
  logAvaRuntimeObjectConstruction({
    label: "datamoonRequest",
    object: datamoonRequest,
    constructedBy: {
      file: "lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts",
      function: "buildDatamoonImportRequestFromAudienceDraft",
    },
    sourceLabel: "input.audienceDraft",
    sourceObject: input.audienceDraft,
    stage: AVA_LAUNCH_STAGE.provider_request,
  })
  const searchSummary = resolveSearchSummary(input)
  const keepMonitoring = input.keepMonitoring ?? true

  logAvaRuntimeTrace({
    stage: AVA_LAUNCH_STAGE.datamoon_validation,
    function: "validateDatamoonAudienceImportRequest",
    file: "lib/growth/lead-sources/datamoon/datamoon-audience-import-validation.ts",
    object: datamoonRequest,
    label: "datamoonRequest.preLaunchServiceValidation",
    constructedBy: {
      file: "lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts",
      function: "buildDatamoonImportRequestFromAudienceDraft",
    },
  })
  const datamoonValidation = validateDatamoonAudienceImportRequest(datamoonRequest)
  logAvaLaunchStage(AVA_LAUNCH_STAGE.datamoon_validation, {
    missionId: input.missionId,
    providerRequest: datamoonRequest,
    datamoonValidation,
  })

  logAvaLaunchStage(AVA_LAUNCH_STAGE.provider_launch, {
    missionId: input.missionId,
    providerRequest: datamoonRequest,
  })

  logAvaRuntimeTrace({
    stage: AVA_LAUNCH_STAGE.provider_launch,
    function: "startDatamoonAudienceImportRun",
    file: "lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts",
    object: datamoonRequest,
    label: "datamoonRequest.startDatamoonAudienceImportRun.input",
    constructedBy: {
      file: "lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts",
      function: "buildDatamoonImportRequestFromAudienceDraft",
    },
  })

  const started = await startDatamoonAudienceImportRun(admin, datamoonRequest, input.actor)
  if (!started.ok) {
    const failureStage =
      started.error === "validation_failed" ? AVA_LAUNCH_STAGE.datamoon_validation : AVA_LAUNCH_STAGE.provider_launch
    return returnAvaLaunchFailure(
      mergeAvaLaunchRunServiceFailure(
        {
          ok: false,
          error: started.error,
          status: started.error === "datamoon_provider_disabled" ? 503 : 400,
        },
        started,
      ),
      {
        stage: failureStage,
        code: started.error,
        message: started.error,
        original: started,
        cause: started.error === "validation_failed" ? started.issues ?? started : started,
        payload: datamoonRequest,
      },
    )
  }

  logAvaLaunchStage(AVA_LAUNCH_STAGE.bind_results, {
    missionId: input.missionId,
    runId: started.run.id,
    datamoonRequest,
    searchSummary,
    keepMonitoring,
  })

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
    return returnAvaLaunchFailure(
      mergeAvaLaunchRunServiceFailure(
        { ok: false, error: bound.error, status: bound.status, runId: started.run.id },
        bound,
      ),
      {
        stage: AVA_LAUNCH_STAGE.bind_results,
        code: bound.error,
        message: bound.error,
        original: bound,
        payload: {
          missionId: input.missionId,
          runId: started.run.id,
          datamoonRequest,
          searchSummary,
        },
      },
    )
  }

  const pollWait = await waitForDatamoonAudienceImportRunPollCompletion(admin, started.run.id)
  if (!pollWait.ok) {
    return returnAvaLaunchFailure(
      {
        ok: false,
        error: pollWait.error,
        status: pollWait.error === "datamoon_poll_pending" ? 409 : 400,
        runId: pollWait.runId,
        message: pollWait.message,
      },
      {
        stage: AVA_LAUNCH_STAGE.provider_launch,
        code: pollWait.error,
        message: pollWait.message,
        original: pollWait.run ?? pollWait,
        payload: {
          runId: pollWait.runId,
          attempts: pollWait.attempts,
          status: pollWait.run?.status ?? null,
          previewCount: pollWait.run?.previewCount ?? 0,
        },
      },
    )
  }

  const polled = pollWait.polled
  const previewCount = polled.run.previewCount ?? 0

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
      const exception = serializeAvaLaunchRunException(error)
      return returnAvaLaunchFailure(
        {
          ok: false,
          error: exception.message,
          status: 500,
          runId: started.run.id,
          exception,
        },
        {
          stage: AVA_LAUNCH_STAGE.provider_launch,
          code: exception.message,
          message: exception.message,
          original: error,
          cause: exception.cause,
          stack: exception.stack,
          payload: { runId: started.run.id, previewCount },
        },
      )
    }
  }

  if (leadIds.length > 0) {
    logAvaLaunchStage(AVA_LAUNCH_STAGE.autonomy_start, {
      missionId: input.missionId,
      runId: started.run.id,
      leadIds,
    })
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
  } catch (error) {
    return returnAvaLaunchUnexpectedExceptionFailure(error, {
      stage: AVA_LAUNCH_STAGE.provider_launch,
    })
  } finally {
    endAvaLaunchRuntimeObjectTraceSession()
  }
}
