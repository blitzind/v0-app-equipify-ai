import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCustomerLifecycleInbox } from "@/lib/growth/customer-lifecycle/customer-lifecycle-dashboard-repository"
import {
  GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS,
  GROWTH_CUSTOMER_LIFECYCLE_STAGES,
  GROWTH_CUSTOMER_REFERRAL_STATUSES,
  GROWTH_CUSTOMER_REVIEW_STATUSES,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      feed: { items: [] },
    })
  }

  const url = new URL(request.url)
  const view = z.enum(GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS).catch("all").parse(url.searchParams.get("view"))
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined
  const lifecycleStageParam = url.searchParams.get("lifecycleStage")
  const lifecycleStage =
    lifecycleStageParam && z.enum(GROWTH_CUSTOMER_LIFECYCLE_STAGES).safeParse(lifecycleStageParam).success
      ? lifecycleStageParam
      : undefined
  const reviewStatusParam = url.searchParams.get("reviewStatus")
  const reviewStatus =
    reviewStatusParam && z.enum(GROWTH_CUSTOMER_REVIEW_STATUSES).safeParse(reviewStatusParam).success
      ? reviewStatusParam
      : undefined
  const referralStatusParam = url.searchParams.get("referralStatus")
  const referralStatus =
    referralStatusParam && z.enum(GROWTH_CUSTOMER_REFERRAL_STATUSES).safeParse(referralStatusParam).success
      ? referralStatusParam
      : undefined
  const minHealthScore = z.coerce.number().int().min(0).max(100).optional().catch(undefined).parse(
    url.searchParams.get("minHealthScore"),
  )
  const maxHealthScore = z.coerce.number().int().min(0).max(100).optional().catch(undefined).parse(
    url.searchParams.get("maxHealthScore"),
  )
  const renewalDueBefore = url.searchParams.get("renewalDueBefore") ?? undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit"))

  try {
    const items = await fetchGrowthCustomerLifecycleInbox(access.admin, {
      view,
      ownerUserId,
      lifecycleStage,
      reviewStatus,
      referralStatus,
      minHealthScore: minHealthScore ?? null,
      maxHealthScore: maxHealthScore ?? null,
      renewalDueBefore,
      limit,
    })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, feed: { items } })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load customer profiles." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const body = z
    .object({
      opportunityId: z.string().uuid().optional(),
      leadId: z.string().uuid().optional(),
      renewalDate: z.string().nullable().optional(),
    })
    .parse(await request.json().catch(() => ({})))

  try {
    const { createGrowthCustomerProfileFromCloseWon, createGrowthCustomerProfileFromLead } = await import(
      "@/lib/growth/customer-lifecycle/mutate-customer-profile"
    )
    const result = body.opportunityId
      ? await createGrowthCustomerProfileFromCloseWon(access.admin, {
          opportunityId: body.opportunityId,
          renewalDate: body.renewalDate ?? null,
          actor: { userId: access.userId, email: access.userEmail },
        })
      : body.leadId
        ? await createGrowthCustomerProfileFromLead(access.admin, {
            leadId: body.leadId,
            renewalDate: body.renewalDate ?? null,
            actor: { userId: access.userId, email: access.userEmail },
          })
        : { ok: false as const, code: "invalid_input", message: "Provide opportunityId or leadId." }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, profile: result.profile })
  } catch {
    return NextResponse.json({ error: "create_failed", message: "Could not create customer profile." }, { status: 500 })
  }
}
