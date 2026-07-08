import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
  buildGrowthMissionAvaLaunchValidationFailureBody,
  buildGrowthMissionAvaLaunchExceptionFailureBody,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import {
  buildSearchValidationTraceFromDraft,
  evaluateGrowthAvaLaunchValidation,
  isAvaLaunchValidationFailureError,
  logGrowthAvaLaunchSearchValidationTrace,
  logGrowthAvaLaunchValidationResult,
  mapServiceErrorToAvaLaunchValidationErrors,
  mapZodIssuesToAvaLaunchValidationErrors,
  mergeAvaLaunchValidationErrors,
  shouldBlockGrowthAvaLaunchValidation,
} from "@/lib/growth/mission-center/growth-ava-launch-validation-diagnostics"
import { runGrowthMissionAvaLaunchRun } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-service"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  AVA_DATAMOON_AUDIENCE_TYPES,
  AVA_DATAMOON_COMPANY_SIZES,
  AVA_DATAMOON_INTENT_LEVELS,
  AVA_DATAMOON_LOOKBACK_DAYS,
  AVA_DATAMOON_PROVIDER_MODES,
  type AvaDatamoonAudienceDraft,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AVA_LAUNCH_ROUTE_VERSION = "ge-ava-live-route-verify-1" as const
const AVA_LAUNCH_ROUTE_VERSION_HEADER = "X-Ava-Launch-Route-Version"

function avaLaunchRouteResponse(body: Record<string, unknown>, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers)
  headers.set(AVA_LAUNCH_ROUTE_VERSION_HEADER, AVA_LAUNCH_ROUTE_VERSION)
  return NextResponse.json(
    { ...body, routeVersion: AVA_LAUNCH_ROUTE_VERSION },
    { ...init, headers },
  )
}

function tagAvaLaunchRouteAccessResponse(response: Response): Response {
  response.headers.set(AVA_LAUNCH_ROUTE_VERSION_HEADER, AVA_LAUNCH_ROUTE_VERSION)
  return response
}

const audienceDraftSchema = z.object({
  audienceName: z.string().trim().min(1),
  audienceType: z.enum(AVA_DATAMOON_AUDIENCE_TYPES),
  providerMode: z.enum(AVA_DATAMOON_PROVIDER_MODES),
  recordLimit: z.number().int().min(1).max(1_000_000),
  lookbackDays: z
    .number()
    .int()
    .refine((value): value is (typeof AVA_DATAMOON_LOOKBACK_DAYS)[number] =>
      (AVA_DATAMOON_LOOKBACK_DAYS as readonly number[]).includes(value),
    ),
  intentLevels: z.array(z.enum(AVA_DATAMOON_INTENT_LEVELS)).default([]),
  geography: z.object({
    country: z.string().trim().min(1),
    state: z.string().nullable(),
    city: z.string().nullable(),
  }),
  topics: z.array(z.string()).default([]),
  customTopic: z.string().nullable(),
  jobTitles: z.array(z.string()).default([]),
  customJobTitle: z.string().nullable(),
  companySize: z.enum(AVA_DATAMOON_COMPANY_SIZES),
  revenueRange: z.string().nullable(),
  includeBusinessEmail: z.boolean(),
  includePhone: z.boolean(),
  includeLinkedIn: z.boolean(),
  excludeDuplicates: z.boolean(),
  onlyNewSinceLastRefresh: z.boolean(),
})

const launchBodySchema = z.object({
  audienceDraft: audienceDraftSchema,
  searchSummary: z.string().trim().min(1),
  approvedByUser: z.literal(true),
  keepMonitoring: z.boolean().optional(),
  refreshCadence: z.enum(["daily", "weekly"]).optional(),
})

type RouteContext = { params: Promise<{ missionId: string }> }

function resolveBlockingValidationStatus(
  validationErrors: Array<{ code: string }>,
): number {
  const codes = new Set(
    validationErrors
      .filter((entry) => !["mission_not_active", "mission_blocked", "growth_autonomy_disabled"].includes(entry.code))
      .map((entry) => entry.code),
  )
  if (codes.has("growth_profile_schema_not_ready") || codes.has("datamoon_provider_disabled")) {
    return 503
  }
  if (codes.has("growth_profile_not_approved")) return 412
  if (codes.has("mission_not_found")) return 404
  if (codes.has("mission_org_mismatch")) return 403
  return 400
}

function readAudienceDraftFromBody(body: unknown): AvaDatamoonAudienceDraft | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const draft = record.audienceDraft
  if (!draft || typeof draft !== "object") return null
  return draft as AvaDatamoonAudienceDraft
}

/** GE-AVA-AUTONOMY-LAUNCH-RUN-1 — One-shot Ava launch: profile gate → bind → Datamoon → import → research visibility → HAC stop. */
export async function POST(request: Request, context: RouteContext) {
  const { missionId } = await context.params
  console.log("AVA_LAUNCH_ROUTE_ENTERED", {
    routeVersion: AVA_LAUNCH_ROUTE_VERSION,
    missionId: missionId?.trim() ?? null,
  })

  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return tagAvaLaunchRouteAccessResponse(access.response)

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return avaLaunchRouteResponse(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "organization_not_configured" },
      { status: 503 },
    )
  }

  if (!missionId?.trim()) {
    return avaLaunchRouteResponse(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "mission_id_required" },
      { status: 400 },
    )
  }

  const trimmedMissionId = missionId.trim()
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return avaLaunchRouteResponse(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "invalid_json" },
      { status: 400 },
    )
  }

  const parsedBody = launchBodySchema.safeParse(rawBody)
  if (!parsedBody.success) {
    const validationErrors = mapZodIssuesToAvaLaunchValidationErrors(parsedBody.error.issues, {
      requestBody: rawBody,
    })
    const draft = readAudienceDraftFromBody(rawBody)
    const searchTrace = draft
      ? buildSearchValidationTraceFromDraft({ missionId: trimmedMissionId, audienceDraft: draft })
      : null
    if (searchTrace) {
      logGrowthAvaLaunchSearchValidationTrace(searchTrace, validationErrors)
    }
    logGrowthAvaLaunchValidationResult({
      missionId: trimmedMissionId,
      evaluation: {
        qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
        checks: validationErrors.map((entry) => ({
          code: entry.code,
          label: entry.message,
          passed: false,
        })),
        validationErrors,
        status: 400,
        searchTrace:
          searchTrace ??
          buildSearchValidationTraceFromDraft({
            missionId: trimmedMissionId,
            audienceDraft: {
              audienceName: "",
              audienceType: "advanced_search",
              providerMode: "module",
              recordLimit: 0,
              lookbackDays: 7,
              intentLevels: [],
              geography: { country: "", state: null, city: null },
              topics: [],
              customTopic: null,
              jobTitles: [],
              customJobTitle: null,
              companySize: "smb",
              revenueRange: null,
              includeBusinessEmail: true,
              includePhone: true,
              includeLinkedIn: true,
              excludeDuplicates: true,
              onlyNewSinceLastRefresh: true,
            },
          }),
      },
      outcome: "blocked",
    })
    return avaLaunchRouteResponse(buildGrowthMissionAvaLaunchValidationFailureBody({ validationErrors }), {
      status: 400,
    })
  }

  const body = parsedBody.data
  const validation = await evaluateGrowthAvaLaunchValidation(access.admin, {
    organizationId,
    missionId: trimmedMissionId,
    audienceDraft: body.audienceDraft,
    searchSummary: body.searchSummary,
    approvedByUser: body.approvedByUser,
  })

  if (shouldBlockGrowthAvaLaunchValidation(validation.validationErrors)) {
    logGrowthAvaLaunchValidationResult({
      missionId: trimmedMissionId,
      evaluation: validation,
      outcome: "blocked",
    })
    return avaLaunchRouteResponse(
      buildGrowthMissionAvaLaunchValidationFailureBody({
        validationErrors: validation.validationErrors,
      }),
      { status: resolveBlockingValidationStatus(validation.validationErrors) },
    )
  }

  if (validation.validationErrors.length > 0) {
    logGrowthAvaLaunchValidationResult({
      missionId: trimmedMissionId,
      evaluation: validation,
      outcome: "passed",
    })
  }

  const providerRequest = buildDatamoonImportRequestFromAudienceDraft(body.audienceDraft)
  const result = await runGrowthMissionAvaLaunchRun(access.admin, {
    organizationId,
    missionId: trimmedMissionId,
    audienceDraft: body.audienceDraft,
    searchSummary: body.searchSummary,
    approvedByUser: body.approvedByUser,
    keepMonitoring: body.keepMonitoring,
    refreshCadence: body.refreshCadence,
    actor: { userId: access.userId ?? null, email: access.userEmail ?? null },
  })

  if (!result.ok) {
    if (result.exception) {
      return avaLaunchRouteResponse(
        buildGrowthMissionAvaLaunchExceptionFailureBody({
          error: result.error,
          exception: result.exception,
          runId: result.runId ?? null,
        }),
        { status: result.status },
      )
    }

    if (isAvaLaunchValidationFailureError(result.error)) {
      const mergedValidationErrors = mergeAvaLaunchValidationErrors(
        validation.validationErrors,
        mapServiceErrorToAvaLaunchValidationErrors(result.error, {
          audienceDraft: body.audienceDraft,
          providerRequest,
          sourceFailure: result.sourceFailure,
          issues: result.issues,
        }),
      )
      logGrowthAvaLaunchValidationResult({
        missionId: trimmedMissionId,
        evaluation: {
          ...validation,
          validationErrors: mergedValidationErrors,
        },
        outcome: "blocked",
      })
      return avaLaunchRouteResponse(
        buildGrowthMissionAvaLaunchValidationFailureBody({
          validationErrors: mergedValidationErrors,
          fallbackMessage: result.error,
          runId: result.runId ?? null,
          sourceFailure: result.sourceFailure,
          issues: result.issues,
        }),
        { status: result.status },
      )
    }

    return avaLaunchRouteResponse(
      {
        ok: false,
        qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
        error: result.error,
        runId: result.runId ?? null,
        ...(result.exception ? { exception: result.exception } : {}),
        ...(result.sourceFailure ? { sourceFailure: result.sourceFailure } : {}),
        ...(result.issues !== undefined ? { issues: result.issues } : {}),
      },
      { status: result.status },
    )
  }

  return avaLaunchRouteResponse({
    ok: true,
    qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
    result: result.result,
  })
}
