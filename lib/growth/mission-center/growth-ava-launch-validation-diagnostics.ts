/** GE-AVA-LAUNCH-VALIDATION-DEBUG-1 / GE-AVA-SEARCH-VALIDATION-2 — Ava launch validation diagnostics (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { logGrowthEngine } from "@/lib/growth/access"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { validateDatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  AVA_LAUNCH_VALIDATOR_DATAMOON_IMPORT,
  AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
  AVA_LAUNCH_VALIDATOR_LAUNCH_BODY_SCHEMA,
  AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
  buildDatamoonImportValidationTraceError,
  buildGrowthAvaLaunchSearchValidationTrace,
  mapPropagatedAvaLaunchIssuesToValidationErrors,
  type GrowthAvaLaunchSearchValidationTrace,
} from "@/lib/growth/mission-center/growth-ava-launch-search-validation-trace"
import {
  GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
  GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER,
  type GrowthAvaLaunchValidationError,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import { isDatamoonProviderEnabled } from "@/lib/growth/providers/datamoon/datamoon-client"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type GrowthAvaLaunchValidationCheck = {
  code: string
  label: string
  passed: boolean
}

export type EvaluateGrowthAvaLaunchValidationInput = {
  organizationId: string
  missionId: string
  audienceDraft: AvaDatamoonAudienceDraft
  searchSummary: string
  approvedByUser: boolean
  env?: NodeJS.ProcessEnv
}

export type GrowthAvaLaunchValidationEvaluation = {
  qa_marker: typeof GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER
  checks: GrowthAvaLaunchValidationCheck[]
  validationErrors: GrowthAvaLaunchValidationError[]
  status: number
  searchTrace: GrowthAvaLaunchSearchValidationTrace
}

const PREFLIGHT_VALIDATION_ERROR_CODES = new Set([
  "approved_by_user_required",
  "growth_profile_schema_not_ready",
  "growth_profile_not_approved",
  "mission_id_required",
  "mission_not_found",
  "mission_org_mismatch",
  "no_approved_lead_search",
  "validation_failed",
  "datamoon_provider_disabled",
  "topic_ids_required",
  "run_name_required",
  "invalid_audience_type",
  "filters_required",
  "topic_ids_max_exceeded",
  "invalid_limit",
  "invalid_provider_mode",
])

const DIAGNOSTIC_ONLY_CHECK_CODES = new Set([
  "mission_not_active",
  "mission_blocked",
  "growth_autonomy_disabled",
])

export function isGrowthAvaLaunchPreflightValidationErrorCode(error: string): boolean {
  return PREFLIGHT_VALIDATION_ERROR_CODES.has(error)
}

export function isAvaLaunchValidationFailureError(error: string): boolean {
  if (error === GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR) return true
  return isGrowthAvaLaunchPreflightValidationErrorCode(error)
}

export function mergeAvaLaunchValidationErrors(
  ...groups: GrowthAvaLaunchValidationError[][]
): GrowthAvaLaunchValidationError[] {
  const merged: GrowthAvaLaunchValidationError[] = []
  for (const group of groups) {
    for (const entry of group) {
      if (!merged.some((existing) => existing.code === entry.code && existing.field === entry.field)) {
        merged.push(entry)
      }
    }
  }
  return merged
}

function traceError(input: {
  code: string
  message: string
  field: string
  validator: string
  expected?: string
  actual?: unknown
  rawIssue?: unknown
}): GrowthAvaLaunchValidationError {
  return {
    code: input.code,
    message: input.message,
    field: input.field,
    severity: "error",
    validator: input.validator,
    expected: input.expected,
    actual: input.actual,
    rawIssue: input.rawIssue,
  }
}

function resolveValidationStatus(errors: GrowthAvaLaunchValidationError[]): number {
  const codes = new Set(errors.map((entry) => entry.code))
  if (codes.has("growth_profile_schema_not_ready") || codes.has("datamoon_provider_disabled")) {
    return 503
  }
  if (codes.has("growth_profile_not_approved")) return 412
  if (codes.has("mission_not_found")) return 404
  if (codes.has("mission_org_mismatch")) return 403
  return 400
}

function resolveValueAtPath(root: unknown, path: Array<string | number>): unknown {
  let current = root
  for (const segment of path) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[String(segment)]
  }
  return current
}

function zodIssueExpected(issue: z.ZodIssue): string | undefined {
  switch (issue.code) {
    case "too_small":
      return issue.type === "string"
        ? `non-empty string (min ${String(issue.minimum)})`
        : `min ${String(issue.minimum)}`
    case "too_big":
      return `max ${String(issue.maximum)}`
    case "invalid_type":
      return String(issue.expected)
    case "invalid_enum":
      return issue.options.map(String).join(" | ")
    case "invalid_literal":
      return JSON.stringify(issue.expected)
    case "custom":
      return issue.params ? JSON.stringify(issue.params) : undefined
    default:
      return undefined
  }
}

function zodIssueRawIssue(issue: z.ZodIssue): Record<string, unknown> {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }
}

function missionHasBoundSearch(objective: Awaited<ReturnType<typeof getGrowthObjective>>): boolean {
  const runtime = objective?.executionContext?.missionRuntime
  if (runtime?.qa_marker !== GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return false
  return Boolean(runtime.datamoon?.importRequestJson?.trim())
}

export async function evaluateGrowthAvaLaunchValidation(
  admin: SupabaseClient,
  input: EvaluateGrowthAvaLaunchValidationInput,
): Promise<GrowthAvaLaunchValidationEvaluation> {
  const env = input.env ?? process.env
  const checks: GrowthAvaLaunchValidationCheck[] = []
  const validationErrors: GrowthAvaLaunchValidationError[] = []

  const pushCheck = (
    code: string,
    label: string,
    passed: boolean,
    failure?: GrowthAvaLaunchValidationError,
  ) => {
    checks.push({ code, label, passed })
    if (!passed && failure) validationErrors.push(failure)
  }

  const missionId = input.missionId.trim()
  const searchSummary = input.searchSummary.trim()
  const audienceName = input.audienceDraft.audienceName.trim()
  const datamoonRequest = buildDatamoonImportRequestFromAudienceDraft(input.audienceDraft)
  const datamoonValidation = validateDatamoonAudienceImportRequest(datamoonRequest)

  const objective = missionId
    ? await getGrowthObjective(admin, input.organizationId, missionId)
    : null

  const searchTrace = buildGrowthAvaLaunchSearchValidationTrace({
    missionId,
    audienceDraft: input.audienceDraft,
    providerRequest: datamoonRequest,
    datamoonValidation,
    mission: objective
      ? {
          id: objective.id,
          title: objective.title,
          status: objective.status,
          hasBoundSearch: missionHasBoundSearch(objective),
        }
      : null,
  })

  pushCheck(
    "approved_by_user_required",
    "Human review confirmed",
    input.approvedByUser,
    traceError({
      code: "approved_by_user_required",
      message: "Confirm human review before running Ava.",
      field: "approvedByUser",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "true",
      actual: input.approvedByUser,
    }),
  )

  pushCheck(
    "mission_id_required",
    "Mission selected",
    Boolean(missionId),
    traceError({
      code: "mission_id_required",
      message: "Select a mission before running Ava.",
      field: "missionId",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "non-empty missionId",
      actual: missionId,
    }),
  )

  const profileState = await fetchBusinessProfileWorkspaceState(admin, input.organizationId)

  pushCheck(
    "growth_profile_schema_not_ready",
    "Business profile schema ready",
    profileState.schemaReady,
    traceError({
      code: "growth_profile_schema_not_ready",
      message: "Growth Profile is not ready in this environment.",
      field: "businessProfile",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "schemaReady=true",
      actual: profileState.schemaReady,
    }),
  )

  pushCheck(
    "growth_profile_not_approved",
    "Business profile approved",
    profileState.schemaReady && Boolean(profileState.activeApproved),
    traceError({
      code: "growth_profile_not_approved",
      message: "Approve your Growth Profile before running Ava.",
      field: "businessProfile",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "activeApproved profile",
      actual: Boolean(profileState.activeApproved),
    }),
  )

  pushCheck(
    "mission_not_found",
    "Mission exists",
    Boolean(objective),
    traceError({
      code: "mission_not_found",
      message: "Selected mission was not found.",
      field: "missionId",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "existing mission",
      actual: missionId,
    }),
  )

  const missionOrgMatch = Boolean(objective && objective.organizationId === input.organizationId)
  pushCheck(
    "mission_org_mismatch",
    "Mission belongs to organization",
    !objective || missionOrgMatch,
    traceError({
      code: "mission_org_mismatch",
      message: "Selected mission does not belong to this organization.",
      field: "missionId",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: input.organizationId,
      actual: objective?.organizationId ?? null,
    }),
  )

  const missionActive = Boolean(
    objective &&
      objective.status === "active" &&
      objective.runtime?.running &&
      !objective.emergencyStopActive,
  )
  pushCheck(
    "mission_not_active",
    "Mission active",
    missionActive,
    traceError({
      code: "mission_not_active",
      message: "Mission is not active.",
      field: "mission",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "status=active and runtime.running=true",
      actual: {
        status: objective?.status ?? null,
        running: objective?.runtime?.running ?? false,
        emergencyStopActive: objective?.emergencyStopActive ?? false,
      },
    }),
  )

  const missionBlocked = Boolean(
    objective && (objective.emergencyStopActive || objective.status === "paused"),
  )
  pushCheck(
    "mission_blocked",
    "Mission not blocked",
    !missionBlocked,
    traceError({
      code: "mission_blocked",
      message: "Mission is blocked.",
      field: "mission",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "not paused and no emergency stop",
      actual: {
        status: objective?.status ?? null,
        emergencyStopActive: objective?.emergencyStopActive ?? false,
      },
    }),
  )

  const approvedLeadSearch = input.approvedByUser && Boolean(searchSummary || audienceName)
  pushCheck(
    "no_approved_lead_search",
    "Approved lead search",
    approvedLeadSearch,
    traceError({
      code: "no_approved_lead_search",
      message: "No approved search attached to this mission.",
      field: "audienceDraft",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "approvedByUser=true and non-empty searchSummary or audienceName",
      actual: {
        approvedByUser: input.approvedByUser,
        searchSummary,
        audienceName,
      },
    }),
  )

  pushCheck(
    "validation_failed",
    "Lead search request valid",
    datamoonValidation.ok,
    datamoonValidation.ok
      ? undefined
      : buildDatamoonImportValidationTraceError(
          datamoonValidation.issues[0]!,
          input.audienceDraft,
          datamoonRequest,
        ),
  )

  if (!datamoonValidation.ok) {
    for (const issue of datamoonValidation.issues.slice(1)) {
      validationErrors.push(
        buildDatamoonImportValidationTraceError(issue, input.audienceDraft, datamoonRequest),
      )
    }
  }

  const datamoonEnabled = isDatamoonProviderEnabled(env)
  pushCheck(
    "datamoon_provider_disabled",
    "Datamoon provider enabled",
    datamoonEnabled,
    traceError({
      code: "datamoon_provider_disabled",
      message: "Datamoon provider is disabled.",
      field: "datamoonProvider",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "DATAMOON_PROVIDER_ENABLED=true",
      actual: datamoonEnabled,
    }),
  )

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const autonomyEnabled = Boolean(killSwitches.autonomy_enabled)
  pushCheck(
    "growth_autonomy_disabled",
    "Growth autonomy enabled",
    autonomyEnabled,
    traceError({
      code: "growth_autonomy_disabled",
      message: "Growth autonomy is disabled.",
      field: "growthAutonomy",
      validator: AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT,
      expected: "autonomy_enabled kill switch true",
      actual: autonomyEnabled,
    }),
  )

  return {
    qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
    checks,
    validationErrors,
    status: resolveValidationStatus(validationErrors),
    searchTrace,
  }
}

export function shouldBlockGrowthAvaLaunchValidation(
  validationErrors: GrowthAvaLaunchValidationError[],
): boolean {
  return validationErrors.some((entry) => !DIAGNOSTIC_ONLY_CHECK_CODES.has(entry.code))
}

export function logGrowthAvaLaunchValidationResult(input: {
  missionId: string
  evaluation: GrowthAvaLaunchValidationEvaluation
  outcome: "blocked" | "passed"
}): void {
  const lines = input.evaluation.checks.map((check) => {
    const marker = check.passed ? "✓" : "✗"
    return `${marker} ${check.label}`
  })

  logGrowthEngine("ava_launch_validation", {
    qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
    mission_id: input.missionId,
    outcome: input.outcome,
    error: input.outcome === "blocked" ? GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR : null,
    validation_error_codes: input.evaluation.validationErrors.map((entry) => entry.code),
    validation_errors: input.evaluation.validationErrors,
    checklist: lines.join("\n"),
    search_trace: input.evaluation.searchTrace,
  })

  if (input.outcome === "blocked") {
    console.warn(["AVA Launch validation failed", ...lines].join("\n"))
    logGrowthAvaLaunchSearchValidationTrace(input.evaluation.searchTrace, input.evaluation.validationErrors)
  }
}

export function logGrowthAvaLaunchSearchValidationTrace(
  trace: GrowthAvaLaunchSearchValidationTrace,
  validationErrors: GrowthAvaLaunchValidationError[],
): void {
  logGrowthEngine("ava_launch_search_validation_trace", {
    qa_marker: GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER,
    ...trace,
    validation_errors: validationErrors,
  })
  console.warn(
    [
      "AVA Launch search validation trace",
      JSON.stringify(
        {
          missionId: trace.missionId,
          audienceDraft: trace.audienceDraft,
          providerRequest: trace.providerRequest,
          datamoonValidation: trace.datamoonValidation,
          mission: trace.mission,
          validationErrors,
        },
        null,
        2,
      ),
    ].join("\n"),
  )
}

export function buildSearchValidationTraceFromDraft(input: {
  missionId: string
  audienceDraft: AvaDatamoonAudienceDraft
  mission?: GrowthAvaLaunchSearchValidationTrace["mission"] | null
}): GrowthAvaLaunchSearchValidationTrace {
  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(input.audienceDraft)
  const datamoonValidation = validateDatamoonAudienceImportRequest(providerRequest)
  return buildGrowthAvaLaunchSearchValidationTrace({
    missionId: input.missionId,
    audienceDraft: input.audienceDraft,
    providerRequest,
    datamoonValidation,
    mission: input.mission,
  })
}

export function mapZodIssuesToAvaLaunchValidationErrors(
  issues: z.ZodIssue[],
  context?: { requestBody?: unknown },
): GrowthAvaLaunchValidationError[] {
  return issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "request"
    const actual = resolveValueAtPath(context?.requestBody, issue.path)
    return traceError({
      code: "validation_failed",
      message: issue.message,
      field,
      validator: AVA_LAUNCH_VALIDATOR_LAUNCH_BODY_SCHEMA,
      expected: zodIssueExpected(issue),
      actual,
      rawIssue: zodIssueRawIssue(issue),
    })
  })
}

export function mapServiceErrorToAvaLaunchValidationErrors(
  error: string,
  context?: {
    audienceDraft?: AvaDatamoonAudienceDraft
    providerRequest?: DatamoonAudienceImportRequest
    sourceFailure?: Record<string, unknown>
    issues?: unknown
  },
): GrowthAvaLaunchValidationError[] {
  const propagatedIssues = context?.issues ?? context?.sourceFailure?.issues
  const propagatedValidationErrors = mapPropagatedAvaLaunchIssuesToValidationErrors(propagatedIssues, {
    audienceDraft: context?.audienceDraft,
    providerRequest: context?.providerRequest,
  })
  if (propagatedValidationErrors && propagatedValidationErrors.length > 0) {
    return propagatedValidationErrors
  }

  if (error === "validation_failed" && context?.providerRequest && context?.audienceDraft) {
    const datamoonValidation = validateDatamoonAudienceImportRequest(context.providerRequest)
    if (!datamoonValidation.ok) {
      return datamoonValidation.issues.map((issue) =>
        buildDatamoonImportValidationTraceError(issue, context.audienceDraft!, context.providerRequest!),
      )
    }
  }

  switch (error) {
    case "approved_by_user_required":
      return [
        traceError({
          code: "approved_by_user_required",
          message: "Confirm human review before running Ava.",
          field: "approvedByUser",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "growth_profile_schema_not_ready":
      return [
        traceError({
          code: "growth_profile_schema_not_ready",
          message: "Growth Profile is not ready in this environment.",
          field: "businessProfile",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "growth_profile_not_approved":
      return [
        traceError({
          code: "growth_profile_not_approved",
          message: "Approve your Growth Profile before running Ava.",
          field: "businessProfile",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "mission_not_found":
      return [
        traceError({
          code: "mission_not_found",
          message: "Selected mission was not found.",
          field: "missionId",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "mission_org_mismatch":
      return [
        traceError({
          code: "mission_org_mismatch",
          message: "Selected mission does not belong to this organization.",
          field: "missionId",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "datamoon_provider_disabled":
      return [
        traceError({
          code: "datamoon_provider_disabled",
          message: "Datamoon provider is disabled.",
          field: "datamoonProvider",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    case "validation_failed":
    case GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR:
      return [
        traceError({
          code: "validation_failed",
          message: error,
          field: "audienceDraft",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
    default:
      return [
        traceError({
          code: error,
          message: error.replaceAll("_", " "),
          field: "launch",
          validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
          rawIssue: { serviceError: error },
        }),
      ]
  }
}
