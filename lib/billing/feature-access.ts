import { canUseFeature } from "@/lib/billing/entitlements"
import type { PlanId } from "@/lib/plans"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isTrialActive } from "@/lib/billing/subscriptions"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

function trialOn(sub: OrganizationSubscription | null): boolean {
  return sub ? isTrialActive(sub) : false
}

export function canAccessAiInsights(planIdRaw: string, subscription: OrganizationSubscription | null): boolean {
  return canUseFeature(normalizePlanIdForRead(planIdRaw), "ai", trialOn(subscription))
}

export function canAccessMaintenancePlansFeature(
  planIdRaw: string,
  subscription: OrganizationSubscription | null,
): boolean {
  return canUseFeature(normalizePlanIdForRead(planIdRaw), "maintenance_plans", trialOn(subscription))
}

export function canAccessApiFeatures(planIdRaw: string, subscription: OrganizationSubscription | null): boolean {
  return canUseFeature(normalizePlanIdForRead(planIdRaw), "api_access", trialOn(subscription))
}

export function maintenancePlanUpgradeMessage(_planId: PlanId): string {
  return "Maintenance plans require Growth or higher. Upgrade in billing to create plans."
}

export function aiFeatureUpgradeMessage(): string {
  return "AI features require Growth or higher. Upgrade in billing."
}
