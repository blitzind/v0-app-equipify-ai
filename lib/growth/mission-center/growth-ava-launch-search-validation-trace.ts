/** GE-AVA-SEARCH-VALIDATION-2 — Raw validator trace helpers (client-safe). */

import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type {
  DatamoonAudienceImportRequest,
  DatamoonAudienceImportValidationIssue,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { GrowthAvaLaunchValidationError } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"

export const GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER = "ge-ava-search-validation-2-v1" as const

export const AVA_LAUNCH_VALIDATOR_LAUNCH_BODY_SCHEMA = "launchBodySchema" as const
export const AVA_LAUNCH_VALIDATOR_EVALUATE_PREFLIGHT = "evaluateGrowthAvaLaunchValidation" as const
export const AVA_LAUNCH_VALIDATOR_DATAMOON_IMPORT = "validateDatamoonAudienceImportRequest" as const
export const AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE = "runGrowthMissionAvaLaunchRun" as const

export type GrowthAvaLaunchSearchValidationTrace = {
  qa_marker: typeof GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER
  missionId: string
  audienceDraft: {
    audienceName: string
    audienceType: string
    providerMode: string
    recordLimit: number
    lookbackDays: number
    intentLevels: string[]
    geography: AvaDatamoonAudienceDraft["geography"]
    topics: string[]
    customTopic: string | null
    jobTitles: string[]
    customJobTitle: string | null
    companySize: string
    onlyNewSinceLastRefresh: boolean
  }
  providerRequest: {
    run_name: string
    audience_type: string
    provider_mode?: string
    topic_ids?: string[]
    topic_ids_length: number
    limit?: number
    filters_count: number
    filters: DatamoonAudienceImportRequest["filters"]
  }
  datamoonValidation: {
    ok: boolean
    issues: DatamoonAudienceImportValidationIssue[]
  }
  mission: {
    id: string | null
    title: string | null
    status: string | null
    hasBoundSearch: boolean
  }
}

export function summarizeAudienceDraftForTrace(
  draft: AvaDatamoonAudienceDraft,
): GrowthAvaLaunchSearchValidationTrace["audienceDraft"] {
  return {
    audienceName: draft.audienceName,
    audienceType: draft.audienceType,
    providerMode: draft.providerMode,
    recordLimit: draft.recordLimit,
    lookbackDays: draft.lookbackDays,
    intentLevels: [...draft.intentLevels],
    geography: { ...draft.geography },
    topics: [...draft.topics],
    customTopic: draft.customTopic,
    jobTitles: [...draft.jobTitles],
    customJobTitle: draft.customJobTitle,
    companySize: draft.companySize,
    onlyNewSinceLastRefresh: draft.onlyNewSinceLastRefresh,
  }
}

export function summarizeProviderRequestForTrace(
  request: DatamoonAudienceImportRequest,
): GrowthAvaLaunchSearchValidationTrace["providerRequest"] {
  const topicIds = request.topic_ids ?? []
  return {
    run_name: request.run_name,
    audience_type: request.audience_type,
    provider_mode: request.provider_mode,
    topic_ids: topicIds.length > 0 ? [...topicIds] : undefined,
    topic_ids_length: topicIds.length,
    limit: request.limit,
    filters_count: request.filters.length,
    filters: request.filters,
  }
}

export function buildGrowthAvaLaunchSearchValidationTrace(input: {
  missionId: string
  audienceDraft: AvaDatamoonAudienceDraft
  providerRequest: DatamoonAudienceImportRequest
  datamoonValidation: { ok: boolean; issues: DatamoonAudienceImportValidationIssue[] }
  mission?: {
    id?: string | null
    title?: string | null
    status?: string | null
    hasBoundSearch?: boolean
  } | null
}): GrowthAvaLaunchSearchValidationTrace {
  return {
    qa_marker: GROWTH_AVA_SEARCH_VALIDATION_2_QA_MARKER,
    missionId: input.missionId,
    audienceDraft: summarizeAudienceDraftForTrace(input.audienceDraft),
    providerRequest: summarizeProviderRequestForTrace(input.providerRequest),
    datamoonValidation: {
      ok: input.datamoonValidation.ok,
      issues: input.datamoonValidation.issues,
    },
    mission: {
      id: input.mission?.id ?? null,
      title: input.mission?.title ?? null,
      status: input.mission?.status ?? null,
      hasBoundSearch: Boolean(input.mission?.hasBoundSearch),
    },
  }
}

export function datamoonValidationIssueExpected(issue: DatamoonAudienceImportValidationIssue): string {
  switch (issue.code) {
    case "topic_ids_required":
      return "at least one topic_id when audience_type is b2b or b2c"
    case "topic_ids_max_exceeded":
      return "at most 5 topic_ids"
    case "run_name_required":
      return "non-empty run_name"
    case "invalid_audience_type":
      return "advanced_search | b2b | b2c"
    case "filters_required":
      return "filters array"
    case "invalid_limit":
      return "limit between 1 and 1,000,000"
    case "invalid_provider_mode":
      return "ext | module"
    default:
      return issue.message
  }
}

export function datamoonValidationIssueActual(
  issue: DatamoonAudienceImportValidationIssue,
  draft: AvaDatamoonAudienceDraft,
  request: DatamoonAudienceImportRequest,
): unknown {
  switch (issue.field ?? issue.code) {
    case "topic_ids":
    case "topic_ids_required":
      return {
        audienceType: draft.audienceType,
        topics: draft.topics,
        customTopic: draft.customTopic,
        topic_ids: request.topic_ids ?? [],
        topic_ids_length: (request.topic_ids ?? []).length,
      }
    case "run_name":
    case "run_name_required":
      return {
        audienceName: draft.audienceName,
        run_name: request.run_name,
      }
    case "audience_type":
    case "invalid_audience_type":
      return draft.audienceType
    case "limit":
    case "invalid_limit":
      return request.limit
    case "provider_mode":
    case "invalid_provider_mode":
      return request.provider_mode
    case "filters":
    case "filters_required":
      return {
        filters_count: request.filters.length,
        filters: request.filters,
      }
    default:
      return {
        audienceType: draft.audienceType,
        audienceName: draft.audienceName,
        geography: draft.geography,
        providerMode: draft.providerMode,
      }
  }
}

export function buildDatamoonImportValidationTraceError(
  issue: DatamoonAudienceImportValidationIssue,
  draft: AvaDatamoonAudienceDraft,
  request: DatamoonAudienceImportRequest,
): GrowthAvaLaunchValidationError {
  return {
    code: issue.code,
    message: issue.message,
    field: issue.field ?? "audienceDraft",
    severity: "error",
    validator: AVA_LAUNCH_VALIDATOR_DATAMOON_IMPORT,
    expected: datamoonValidationIssueExpected(issue),
    actual: datamoonValidationIssueActual(issue, draft, request),
    rawIssue: issue,
  }
}
