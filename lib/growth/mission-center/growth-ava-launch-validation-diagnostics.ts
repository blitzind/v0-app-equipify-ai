/** GE-AVA-LAUNCH-VALIDATION-DEBUG-1 — Ava launch preflight validation diagnostics (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { logGrowthEngine } from "@/lib/growth/access"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { validateDatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"
import {
  GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
  type GrowthAvaLaunchValidationError,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
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
])

/** Checks that appear in server logs but do not block launch (orchestration unchanged). */
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

function errorEntry(
  code: string,
  message: string,
  field: string,
): GrowthAvaLaunchValidationError {
  return { code, message, field, severity: "error" }
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

  pushCheck(
    "approved_by_user_required",
    "Human review confirmed",
    input.approvedByUser,
    errorEntry(
      "approved_by_user_required",
      "Confirm human review before running Ava.",
      "approvedByUser",
    ),
  )

  pushCheck(
    "mission_id_required",
    "Mission selected",
    Boolean(missionId),
    errorEntry("mission_id_required", "Select a mission before running Ava.", "missionId"),
  )

  const profileState = await fetchBusinessProfileWorkspaceState(admin, input.organizationId)

  pushCheck(
    "growth_profile_schema_not_ready",
    "Business profile schema ready",
    profileState.schemaReady,
    errorEntry(
      "growth_profile_schema_not_ready",
      "Growth Profile is not ready in this environment.",
      "businessProfile",
    ),
  )

  pushCheck(
    "growth_profile_not_approved",
    "Business profile approved",
    profileState.schemaReady && Boolean(profileState.activeApproved),
    errorEntry(
      "growth_profile_not_approved",
      "Approve your Growth Profile before running Ava.",
      "businessProfile",
    ),
  )

  const objective = missionId
    ? await getGrowthObjective(admin, input.organizationId, missionId)
    : null

  pushCheck(
    "mission_not_found",
    "Mission exists",
    Boolean(objective),
    errorEntry("mission_not_found", "Selected mission was not found.", "missionId"),
  )

  const missionOrgMatch = Boolean(objective && objective.organizationId === input.organizationId)
  pushCheck(
    "mission_org_mismatch",
    "Mission belongs to organization",
    !objective || missionOrgMatch,
    errorEntry("mission_org_mismatch", "Selected mission does not belong to this organization.", "missionId"),
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
    errorEntry("mission_not_active", "Mission is not active.", "mission"),
  )

  const missionBlocked = Boolean(
    objective && (objective.emergencyStopActive || objective.status === "paused"),
  )
  pushCheck(
    "mission_blocked",
    "Mission not blocked",
    !missionBlocked,
    errorEntry("mission_blocked", "Mission is blocked.", "mission"),
  )

  const approvedLeadSearch = input.approvedByUser && Boolean(searchSummary || audienceName)
  pushCheck(
    "no_approved_lead_search",
    "Approved lead search",
    approvedLeadSearch,
    errorEntry(
      "no_approved_lead_search",
      "No approved search attached to this mission.",
      "audienceDraft",
    ),
  )

  const datamoonRequest = buildDatamoonImportRequestFromAudienceDraft(input.audienceDraft)
  const datamoonValidation = validateDatamoonAudienceImportRequest(datamoonRequest)
  pushCheck(
    "validation_failed",
    "Lead search request valid",
    datamoonValidation.ok,
    datamoonValidation.ok
      ? undefined
      : errorEntry(
          "validation_failed",
          datamoonValidation.issues[0]?.message ?? "Lead search request is invalid.",
          datamoonValidation.issues[0]?.field ?? "audienceDraft",
        ),
  )

  if (!datamoonValidation.ok) {
    for (const issue of datamoonValidation.issues.slice(1)) {
      validationErrors.push(
        errorEntry("validation_failed", issue.message, issue.field ?? "audienceDraft"),
      )
    }
  }

  const datamoonEnabled = isDatamoonProviderEnabled(env)
  pushCheck(
    "datamoon_provider_disabled",
    "Datamoon provider enabled",
    datamoonEnabled,
    errorEntry(
      "datamoon_provider_disabled",
      "Datamoon provider is disabled.",
      "datamoonProvider",
    ),
  )

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const autonomyEnabled = Boolean(killSwitches.autonomy_enabled)
  pushCheck(
    "growth_autonomy_disabled",
    "Growth autonomy enabled",
    autonomyEnabled,
    errorEntry(
      "growth_autonomy_disabled",
      "Growth autonomy is disabled.",
      "growthAutonomy",
    ),
  )

  return {
    qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
    checks,
    validationErrors,
    status: resolveValidationStatus(validationErrors),
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
    checklist: lines.join("\n"),
  })

  if (input.outcome === "blocked") {
    console.warn(["AVA Launch validation failed", ...lines].join("\n"))
  }
}

export function mapZodIssuesToAvaLaunchValidationErrors(
  issues: z.ZodIssue[],
): GrowthAvaLaunchValidationError[] {
  return issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "request"
    return errorEntry("validation_failed", issue.message, field)
  })
}

export function mapServiceErrorToAvaLaunchValidationErrors(error: string): GrowthAvaLaunchValidationError[] {
  switch (error) {
    case "approved_by_user_required":
      return [errorEntry("approved_by_user_required", "Confirm human review before running Ava.", "approvedByUser")]
    case "growth_profile_schema_not_ready":
      return [
        errorEntry(
          "growth_profile_schema_not_ready",
          "Growth Profile is not ready in this environment.",
          "businessProfile",
        ),
      ]
    case "growth_profile_not_approved":
      return [
        errorEntry(
          "growth_profile_not_approved",
          "Approve your Growth Profile before running Ava.",
          "businessProfile",
        ),
      ]
    case "mission_not_found":
      return [errorEntry("mission_not_found", "Selected mission was not found.", "missionId")]
    case "mission_org_mismatch":
      return [
        errorEntry(
          "mission_org_mismatch",
          "Selected mission does not belong to this organization.",
          "missionId",
        ),
      ]
    case "datamoon_provider_disabled":
      return [errorEntry("datamoon_provider_disabled", "Datamoon provider is disabled.", "datamoonProvider")]
    case "validation_failed":
    case GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR:
      return [errorEntry("validation_failed", "Lead search request is invalid.", "audienceDraft")]
    default:
      return [errorEntry(error, error.replaceAll("_", " "), "launch")]
  }
}
