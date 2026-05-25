import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCustomerProfileById } from "@/lib/growth/customer-lifecycle/customer-profile-repository"
import { listGrowthCustomerOnboardingTasks } from "@/lib/growth/customer-lifecycle/customer-onboarding-task-repository"
import {
  recordGrowthCustomerActivation,
  recordGrowthCustomerEngagement,
  recordGrowthCustomerReferralReceived,
  recordGrowthCustomerReviewReceived,
  requestGrowthCustomerReferral,
  requestGrowthCustomerReview,
  updateGrowthCustomerRenewalDate,
} from "@/lib/growth/customer-lifecycle/mutate-customer-onboarding"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { customerId } = await context.params
  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      profile: null,
      tasks: [],
    })
  }

  try {
    const profile = await fetchGrowthCustomerProfileById(access.admin, customerId)
    if (!profile) return NextResponse.json({ error: "not_found", message: "Customer not found." }, { status: 404 })
    const tasks = await listGrowthCustomerOnboardingTasks(access.admin, { customerProfileId: profile.id })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, profile, tasks })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load customer profile." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { customerId } = await context.params
  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const body = z
    .object({
      action: z.enum([
        "record_activation",
        "request_review",
        "record_review_received",
        "request_referral",
        "record_referral_received",
        "update_renewal_date",
        "record_engagement",
      ]),
      renewalDate: z.string().nullable().optional(),
      activationAt: z.string().nullable().optional(),
    })
    .parse(await request.json().catch(() => ({})))

  const actor = { userId: access.userId, email: access.userEmail }

  try {
    let result
    switch (body.action) {
      case "record_activation":
        result = await recordGrowthCustomerActivation(access.admin, {
          profileId: customerId,
          activationAt: body.activationAt ?? null,
          actor,
        })
        break
      case "request_review":
        result = await requestGrowthCustomerReview(access.admin, { profileId: customerId, actor })
        break
      case "record_review_received":
        result = await recordGrowthCustomerReviewReceived(access.admin, { profileId: customerId, actor })
        break
      case "request_referral":
        result = await requestGrowthCustomerReferral(access.admin, { profileId: customerId, actor })
        break
      case "record_referral_received":
        result = await recordGrowthCustomerReferralReceived(access.admin, { profileId: customerId, actor })
        break
      case "update_renewal_date":
        result = await updateGrowthCustomerRenewalDate(access.admin, {
          profileId: customerId,
          renewalDate: body.renewalDate ?? null,
          actor,
        })
        break
      case "record_engagement":
        result = await recordGrowthCustomerEngagement(access.admin, { profileId: customerId, actor })
        break
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, profile: result.profile })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not update customer profile." }, { status: 500 })
  }
}
