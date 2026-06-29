import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import { createGrowthOpportunity } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import { evaluateGrowthOpportunityPipelineSignals } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import { fetchGrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-dashboard-repository"
import { listGrowthOpportunityPipeline } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  GROWTH_OPPORTUNITY_FORECAST_CATEGORIES,
  GROWTH_OPPORTUNITY_PIPELINE_VIEWS,
  GROWTH_OPPORTUNITY_PRIORITIES,
  GROWTH_OPPORTUNITY_STAGE_KEYS,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"
import {
  GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE,
  isGrowthOpportunityPipelineSchemaReady,
  probeGrowthOpportunityPipelineSchema,
} from "@/lib/growth/opportunity-pipeline/pipeline-schema-health"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  stageKey: z.enum(GROWTH_OPPORTUNITY_STAGE_KEYS).optional(),
  forecastCategory: z.enum(GROWTH_OPPORTUNITY_FORECAST_CATEGORIES).optional(),
  expectedCloseDate: z.string().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(GROWTH_OPPORTUNITY_PRIORITIES).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const viewParam = url.searchParams.get("view")
  const view =
    viewParam && GROWTH_OPPORTUNITY_PIPELINE_VIEWS.includes(viewParam as (typeof GROWTH_OPPORTUNITY_PIPELINE_VIEWS)[number])
      ? (viewParam as (typeof GROWTH_OPPORTUNITY_PIPELINE_VIEWS)[number])
      : "all_pipeline"

  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  const stageKeyParam = url.searchParams.get("stageKey")
  const stageKey =
    stageKeyParam && GROWTH_OPPORTUNITY_STAGE_KEYS.includes(stageKeyParam as (typeof GROWTH_OPPORTUNITY_STAGE_KEYS)[number])
      ? (stageKeyParam as (typeof GROWTH_OPPORTUNITY_STAGE_KEYS)[number])
      : undefined

  const forecastCategoryParam = url.searchParams.get("forecastCategory")
  const forecastCategory =
    forecastCategoryParam &&
    GROWTH_OPPORTUNITY_FORECAST_CATEGORIES.includes(
      forecastCategoryParam as (typeof GROWTH_OPPORTUNITY_FORECAST_CATEGORIES)[number],
    )
      ? (forecastCategoryParam as (typeof GROWTH_OPPORTUNITY_FORECAST_CATEGORIES)[number])
      : undefined

  const priorityParam = url.searchParams.get("priority")
  const priority =
    priorityParam && GROWTH_OPPORTUNITY_PRIORITIES.includes(priorityParam as (typeof GROWTH_OPPORTUNITY_PRIORITIES)[number])
      ? (priorityParam as (typeof GROWTH_OPPORTUNITY_PRIORITIES)[number])
      : undefined

  const stale = url.searchParams.get("stale") === "true" ? true : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(url.searchParams.get("limit") ?? "25")
  const offset = z.coerce.number().int().min(0).catch(0).parse(url.searchParams.get("offset") ?? "0")
  const refresh = url.searchParams.get("refresh") === "true"

  try {
    const schemaProbe = await probeGrowthOpportunityPipelineSchema(access.admin)
    const schemaReady = isGrowthOpportunityPipelineSchemaReady(schemaProbe)
    if (!schemaReady) {
      return growthHomeNoStoreJson({
        ok: true,
        meta: { schemaReady: false, setupMessage: GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE },
        feed: { items: [], total: 0, hasMore: false },
        dashboard: null,
      })
    }

    if (refresh) await evaluateGrowthOpportunityPipelineSignals(access.admin)

    const [feed, dashboard] = await Promise.all([
      listGrowthOpportunityPipeline(access.admin, {
        view,
        ownerUserId,
        stageKey,
        forecastCategory,
        priority,
        stale,
        limit,
        offset,
      }),
      fetchGrowthOpportunityPipelineDashboard(access.admin, ownerUserId ?? access.userId),
    ])

    return growthHomeNoStoreJson({
      ok: true,
      meta: { schemaReady: true },
      feed,
      dashboard,
    })
  } catch (e) {
    const rawMessage = e instanceof Error ? e.message : "Could not load opportunity pipeline."
    const message =
      rawMessage.includes("schema cache") || rawMessage.includes("could not find")
        ? GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE
        : "Could not load opportunity pipeline."
    return growthHomeNoStoreJson({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const body = createSchema.parse(await request.json())
    const schemaProbe = await probeGrowthOpportunityPipelineSchema(access.admin)
    if (!isGrowthOpportunityPipelineSchemaReady(schemaProbe)) {
      return NextResponse.json(
        { error: "schema_not_ready", message: GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE },
        { status: 503 },
      )
    }

    const result = await createGrowthOpportunity(access.admin, {
      ...body,
      actor: { userId: access.userId, email: access.userEmail },
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, opportunity: result.opportunity })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", message: "Invalid request body." }, { status: 400 })
    }
    const message = e instanceof Error ? e.message : "Could not create opportunity."
    const safeMessage =
      message.includes("schema cache") || message.includes("could not find")
        ? GROWTH_OPPORTUNITY_PIPELINE_SETUP_MESSAGE
        : "Could not create opportunity."
    return NextResponse.json({ error: "create_failed", message: safeMessage }, { status: 500 })
  }
}
