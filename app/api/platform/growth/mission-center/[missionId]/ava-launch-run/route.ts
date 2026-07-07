import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
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

  let body: z.infer<typeof launchBodySchema>
  try {
    body = launchBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, error: "invalid_request" },
      { status: 400 },
    )
  }

  const result = await runGrowthMissionAvaLaunchRun(access.admin, {
    organizationId,
    missionId: missionId.trim(),
    audienceDraft: body.audienceDraft,
    searchSummary: body.searchSummary,
    approvedByUser: body.approvedByUser,
    keepMonitoring: body.keepMonitoring,
    refreshCadence: body.refreshCadence,
    actor: { userId: access.userId ?? null, email: access.userEmail ?? null },
  })

  if (!result.ok) {
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
