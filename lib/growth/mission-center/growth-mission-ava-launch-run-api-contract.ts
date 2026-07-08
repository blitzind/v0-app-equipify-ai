/** GE-AVA-AUTONOMY-LAUNCH-RUN-1 — Ava launch run API contract (client-safe). */

import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { MissionFindLeadsBindingSummary } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"
import type { AvaLaunchSerializedException } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-exception-transparency"

export const GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER = "ge-ava-autonomy-launch-run-1-v1" as const

export const GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER = "ge-ava-launch-validation-debug-1-v1" as const

export const GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER = "ge-ava-search-validation-2-v1" as const

export const GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR = "Validation failed" as const

export const GROWTH_AVA_LAUNCH_CANT_START_HEADING = "Ava can't start yet." as const

export type GrowthAvaLaunchValidationError = {
  code: string
  message: string
  field: string
  severity: "error"
  validator?: string
  expected?: string
  actual?: unknown
  rawIssue?: unknown
}

const AVA_LAUNCH_VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  approved_by_user_required: "Confirm human review before running Ava.",
  growth_profile_schema_not_ready: "Growth Profile is not ready in this environment.",
  growth_profile_not_approved: "Approve your Growth Profile before running Ava.",
  mission_id_required: "Select a mission before running Ava.",
  mission_not_found: "Selected mission was not found.",
  mission_org_mismatch: "Selected mission does not belong to this organization.",
  mission_not_active: "Mission is not active.",
  mission_blocked: "Mission is blocked.",
  no_approved_lead_search: "No approved search attached to this mission.",
  datamoon_provider_disabled: "Datamoon provider is disabled.",
  growth_autonomy_disabled: "Growth autonomy is disabled.",
  topic_ids_required: "B2B/B2C audiences require at least one topic.",
  run_name_required: "Run name is required.",
  invalid_audience_type: "Audience type is invalid.",
  invalid_limit: "Record limit is out of range.",
  invalid_provider_mode: "Provider mode is invalid.",
}

export function resolveGrowthAvaLaunchValidationMessage(error: GrowthAvaLaunchValidationError): string {
  if (error.validator || error.rawIssue) return error.message
  if (error.code === "validation_failed") return error.message
  return AVA_LAUNCH_VALIDATION_ERROR_MESSAGES[error.code] ?? error.message
}

export function formatGrowthAvaLaunchValidationErrorsForUi(
  validationErrors: GrowthAvaLaunchValidationError[],
): string {
  if (validationErrors.length === 0) return GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR
  const bullets = validationErrors
    .map((entry) => resolveGrowthAvaLaunchValidationMessage(entry))
    .filter((message, index, all) => all.indexOf(message) === index)
    .map((message) => `• ${message}`)
  return [GROWTH_AVA_LAUNCH_CANT_START_HEADING, "", ...bullets].join("\n")
}

export function ensureGrowthAvaLaunchValidationErrors(
  validationErrors: GrowthAvaLaunchValidationError[],
  fallbackMessage?: string,
): GrowthAvaLaunchValidationError[] {
  if (validationErrors.length > 0) return validationErrors
  const message = fallbackMessage?.trim() || "Launch validation failed."
  return [
    {
      code: "validation_failed",
      message,
      field: "launch",
      severity: "error",
      validator: "unknown",
      rawIssue: { fallbackMessage: message },
    },
  ]
}

export function isGrowthMissionAvaLaunchValidationFailureError(error: string): boolean {
  return error === GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR || error === "validation_failed"
}

export function buildGrowthMissionAvaLaunchValidationFailureBody(input: {
  validationErrors: GrowthAvaLaunchValidationError[]
  fallbackMessage?: string
  runId?: string | null
}): {
  ok: false
  qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
  validation_debug_qa_marker: typeof GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER
  search_validation_trace_qa_marker?: typeof GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER
  error: typeof GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR
  validationErrors: GrowthAvaLaunchValidationError[]
  runId?: string | null
} {
  const validationErrors = ensureGrowthAvaLaunchValidationErrors(
    input.validationErrors,
    input.fallbackMessage,
  )
  const body: {
    ok: false
    qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
    validation_debug_qa_marker: typeof GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER
    search_validation_trace_qa_marker: typeof GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER
    error: typeof GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR
    validationErrors: GrowthAvaLaunchValidationError[]
    runId?: string | null
  } = {
    ok: false,
    qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
    validation_debug_qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
    search_validation_trace_qa_marker: GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER,
    error: GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
    validationErrors,
  }
  if (input.runId !== undefined) {
    body.runId = input.runId
  }
  return body
}

export function buildGrowthMissionAvaLaunchExceptionFailureBody(input: {
  error: string
  exception: AvaLaunchSerializedException
  runId?: string | null
}): {
  ok: false
  qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
  error: string
  exception: AvaLaunchSerializedException
  validationErrors: GrowthAvaLaunchValidationError[]
  runId?: string | null
} {
  const body: {
    ok: false
    qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
    error: string
    exception: AvaLaunchSerializedException
    validationErrors: GrowthAvaLaunchValidationError[]
    runId?: string | null
  } = {
    ok: false,
    qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
    error: input.error,
    exception: input.exception,
    validationErrors: [
      {
        code: "validation_failed",
        message: input.exception.message,
        field: "launch",
        severity: "error",
        validator: "runGrowthMissionAvaLaunchRun",
        rawIssue: { exception: input.exception },
      },
    ],
  }
  if (input.runId !== undefined) {
    body.runId = input.runId
  }
  return body
}

export const GROWTH_AVA_LAUNCH_RUN_TITLE = "Run Ava" as const
export const GROWTH_AVA_LAUNCH_RUN_DESCRIPTION =
  "Find leads from your approved search, import them, start research, and surface items for human approval — no outbound send." as const
export const GROWTH_AVA_LAUNCH_RUN_SUCCESS_COPY =
  "Ava launch run complete. Review imported leads and pending approvals before outreach." as const

export function buildMissionAvaLaunchRunApiPath(missionId: string): string {
  return `/api/platform/growth/mission-center/${encodeURIComponent(missionId)}/ava-launch-run`
}

export type GrowthMissionAvaLaunchRunRequest = {
  audienceDraft: AvaDatamoonAudienceDraft
  searchSummary: string
  approvedByUser: true
  keepMonitoring?: boolean
  refreshCadence?: "daily" | "weekly"
}

export type GrowthMissionAvaLaunchRunLeadResearchStatus = {
  leadId: string
  workflowStatus: string | null
  researchPilotEnabled: boolean
}

export type GrowthMissionAvaLaunchRunHumanApprovalSummary = {
  totalPending: number
  topItems: Array<{
    id: string
    title: string
    channel: string
    href: string | null
    leadId: string | null
  }>
  approvalsHref: "/growth/os/approvals"
}

export type GrowthMissionAvaLaunchRunResult = {
  qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
  missionId: string
  runId: string
  binding: MissionFindLeadsBindingSummary
  import: {
    imported: number
    duplicates: number
    skipped: number
    errors: number
    leadIds: string[]
    previewCount: number
  }
  research: {
    pilotEnabled: boolean
    leads: GrowthMissionAvaLaunchRunLeadResearchStatus[]
  }
  humanApprovalCenter: GrowthMissionAvaLaunchRunHumanApprovalSummary
  stoppedAt: "human_approval"
}

export type GrowthMissionAvaLaunchRunResponse =
  | { ok: true; result: GrowthMissionAvaLaunchRunResult }
  | {
      ok: false
      qa_marker: typeof GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER
      validation_debug_qa_marker?: typeof GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER
      search_validation_trace_qa_marker?: typeof GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER
      error: string
      validationErrors?: GrowthAvaLaunchValidationError[]
      exception?: AvaLaunchSerializedException
      runId?: string | null
    }
