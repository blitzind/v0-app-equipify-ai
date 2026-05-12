import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
import { createHostedSubscriptionCheckout } from "@/lib/billing/hosted-subscription-checkout"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { isOrganizationArchived } from "@/lib/organizations/archive-status"
import {
  assertPublishableKeyMatchesDeployment,
  isStripeLiveEnforced,
  validateResolvedStripePriceIds,
} from "@/lib/billing/stripe-env"
import { sanitizeBillingEndpointUserMessage } from "@/lib/billing/stripe-saas-billing-errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Creates a Stripe Checkout Session (hosted). Session/subscription metadata includes `organizationId` for webhooks. */

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "You must be signed in." }, { status: 401 })
  }

  let body: {
    organizationId?: string
    planId?: string
    billingCycle?: string
    skipTrial?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const billingCycle =
    body.billingCycle === "annual" || body.billingCycle === "monthly" ? body.billingCycle : null
  if (!billingCycle) {
    return NextResponse.json(
      { error: "invalid_cycle", message: "billingCycle must be monthly or annual." },
      { status: 400 },
    )
  }

  if (body.planId == null || String(body.planId).trim() === "") {
    return NextResponse.json({ error: "invalid_plan", message: "planId is required." }, { status: 400 })
  }

  const planId = normalizePlanIdForRead(String(body.planId)) as PlanId

  const authEmail = user.email?.trim()
  const userIsPlatformAdmin = authEmail ? isPlatformAdminEmail(authEmail) : false

  let organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""

  if (!organizationId) {
    const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
    if ("error" in resolved) {
      return NextResponse.json({ error: "no_org", message: resolved.error }, { status: 400 })
    }
    organizationId = resolved.organizationId
  } else {
    if (!userIsPlatformAdmin) {
      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
      if (!member) {
        return NextResponse.json(
          { error: "forbidden", message: "You do not have access to this organization." },
          { status: 403 },
        )
      }
    }
  }

  if (!userIsPlatformAdmin && (await isOrganizationArchived(supabase, organizationId))) {
    return NextResponse.json(
      {
        error: "organization_archived",
        message: "This workspace has been archived. Contact support or restore it from Platform Admin.",
      },
      { status: 403 },
    )
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    "http://localhost:3000"

  try {
    assertPublishableKeyMatchesDeployment(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    console.error("[billing/checkout] publishable key / deployment check failed", raw)
    return NextResponse.json(
      { error: "billing_misconfigured", message: sanitizeBillingEndpointUserMessage(raw) },
      { status: 503 },
    )
  }

  if (isStripeLiveEnforced()) {
    const priceCheck = validateResolvedStripePriceIds()
    if (!priceCheck.ok) {
      console.error("[billing/checkout] missing or invalid Stripe price ids", priceCheck.errors)
      return NextResponse.json(
        {
          error: "billing_misconfigured",
          message: "Billing is not fully configured for this environment. Please contact support.",
        },
        { status: 503 },
      )
    }
  }

  const result = await createHostedSubscriptionCheckout({
    organizationId,
    userId: user.id,
    planId,
    billingCycle,
    origin,
    skipTrial: Boolean(body.skipTrial),
  })

  if (result.error || !result.url) {
    return NextResponse.json(
      {
        error: "checkout_failed",
        message: result.error ?? "Could not create checkout session.",
      },
      { status: 400 },
    )
  }

  return NextResponse.json({ url: result.url })
}
