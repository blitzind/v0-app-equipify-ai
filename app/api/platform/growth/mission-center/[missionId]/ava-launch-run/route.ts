import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import {
  evaluateGrowthAvaLaunchValidation,
  isGrowthAvaLaunchPreflightValidationErrorCode,
  logGrowthAvaLaunchValidationResult,
  mapServiceErrorToAvaLaunchValidationErrors,
  mapZodIssuesToAvaLaunchValidationErrors,
  shouldBlockGrowthAvaLaunchValidation,
} from "@/lib/growth/mission-center/growth-ava-launch-validation-diagnostics"
import { runGrowthMissionAvaLaunchRun } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-service"
import {
  AVA_DATAMOON_AUDIENCE_TYPES,
  AVA_DATAMOON_COMPANY_SIZES,
  AVA_DATAMOON_INTENT_LEVELS,
  AVA_DATAMOON_LOOKBACK_DAYS,
  AVA_DATAMOON_PROVIDER_MODES,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

/** GE-AVA-AUTONOMY-LAUNCH-RUN-1 — One-shot Ava launch: profile gate → bind → Datamoon → import → research visibility → HAC stop. */
export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "organization_not_configured" },
      { status: 503 },
    )
  }

  const { missionId } = await context.params
  if (!missionId?.trim()) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "mission_id_required" },
      { status: 400 },
    )
  }

  const parsedBody = launchBodySchema.safeParse(await request.json())
  if (!parsedBody.success) {
    const validationErrors = mapZodIssuesToAvaLaunchValidationErrors(parsedBody.error.issues)
    logGrowthAvaLaunchValidationResult({
      missionId: missionId.trim(),
      evaluation: {
        qa_marker: GROWTH_AVA_LAUNCH_VALIDATION_DEBUG_1_QA_MARKER,
        checks: validationErrors.map((entry) => ({
          code: entry.code,
          label: entry.message,
          passed: false,
        })),
        validationErrors,
        status: 400,
      },
      outcome: "blocked",
    })
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
        error: GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
        validationErrors,
      },
      { status: 400 },
    )
  }

  const body = parsedBody.data
  const trimmedMissionId = missionId.trim()
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
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
        error: GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
        validationErrors: validation.validationErrors,
      },
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
    if (isGrowthAvaLaunchPreflightValidationErrorCode(result.error)) {
      const serviceValidationErrors = mapServiceErrorToAvaLaunchValidationErrors(result.error)
      const mergedValidationErrors = [
        ...validation.validationErrors,
        ...serviceValidationErrors.filter(
          (entry) => !validation.validationErrors.some((existing) => existing.code === entry.code),
        ),
      ]
      logGrowthAvaLaunchValidationResult({
        missionId: trimmedMissionId,
        evaluation: {
          ...validation,
          validationErrors: mergedValidationErrors,
        },
        outcome: "blocked",
      })
      return NextResponse.json(
        {
          ok: false,
          qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
          error: GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
          validationErrors: mergedValidationErrors,
          runId: result.runId ?? null,
        },
        { status: result.status },
      )
    }

    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
        error: result.error,
        runId: result.runId ?? null,
      },
      { status: result.status },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
    result: result.result,
  })
}
