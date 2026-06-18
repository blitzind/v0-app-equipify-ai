import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getEquipifyPlanDisplayName } from "@/lib/billing/get-equipify-plan-display-name"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import type { TenantWorkspace } from "@/lib/tenant-data"

export type OrganizationPlanDisplayInput = {
  /** Full subscription row when available (preferred — preserves raw `plan_id` including enterprise). */
  subscription?: OrganizationSubscription | null
  /** Fallback when subscription row is absent but a plan id is known (legacy workspace fields). */
  planId?: string | null
  /** Tenant sync slice from `TenantWorkspaceSync` / `planBadgeFromWorkspace`. */
  tenantSubscription?: TenantWorkspace["organizationSubscription"]
}

function subscriptionFromTenantSlice(
  tenant: NonNullable<TenantWorkspace["organizationSubscription"]>,
): OrganizationSubscription {
  return {
    id: "",
    organization_id: "",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan_id: tenant.planId,
    intended_plan_id: tenant.intendedPlanId ?? null,
    billing_cycle: "monthly",
    status: tenant.status,
    trial_starts_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: "",
    updated_at: "",
  }
}

/**
 * Resolves organization → subscription → effective plan → branded display name.
 * Pure function — no network, no Supabase, no Stripe.
 */
export function getOrganizationPlanDisplay(input: OrganizationPlanDisplayInput = {}): string {
  const subscriptionExplicitlyNull =
    input.subscription === null ||
    (input.subscription === undefined && input.tenantSubscription === null)

  if (subscriptionExplicitlyNull) {
    return "Equipify"
  }

  const subscription =
    input.subscription ??
    (input.tenantSubscription ? subscriptionFromTenantSlice(input.tenantSubscription) : null)

  const rawPlanId = subscription?.plan_id ?? input.planId ?? null
  if (!rawPlanId || String(rawPlanId).trim() === "") {
    return "Equipify"
  }

  const effectivePlanId = subscription
    ? getEffectivePlanId(subscription.plan_id, subscription)
    : normalizePlanIdForRead(rawPlanId)

  return getEquipifyPlanDisplayName({
    planId: rawPlanId,
    effectivePlanId,
  })
}

/** Convenience for chrome that already holds `TenantWorkspace` (sidebar, account footer). */
export function getOrganizationPlanDisplayFromWorkspace(workspace: TenantWorkspace): string {
  if (workspace.organizationSubscription === null) {
    return "Equipify"
  }

  return getOrganizationPlanDisplay({
    planId: workspace.organizationSubscription?.planId ?? workspace.planId,
    tenantSubscription: workspace.organizationSubscription,
  })
}
