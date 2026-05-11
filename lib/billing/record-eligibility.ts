import { getPlanLimits } from "@/lib/billing/entitlements"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isTrialActive } from "@/lib/billing/subscriptions"
import { getBillingAccessState } from "@/lib/billing/access"
import type { UsageWithLimits } from "@/lib/billing/usage"
import { planIdFromSubscriptionRow } from "@/lib/billing/usage"

/** Standard copy when billing state blocks creates */
export const RECORD_CREATION_BILLING_MESSAGE =
  "Your trial or subscription needs attention before creating new records."

export const USAGE_COUNT_VERIFY_EQUIPMENT_MESSAGE =
  "We could not verify equipment usage for this workspace. Try again in a moment."

export const USAGE_COUNT_VERIFY_SEATS_MESSAGE =
  "We could not verify team seat usage for this workspace. Try again in a moment."

export type RecordEligibilityReason =
  | "billing"
  | "equipment"
  | "seats"
  | "maintenance_plan"
  | "usage_verify"

export type QuotaEvaluationOptions = {
  /** True when live usage counts could not be loaded (e.g. `getUsageWithLimits` failed). */
  usageLoadFailed?: boolean
  /**
   * Member-initiated actions: fail closed when counts are unavailable but the plan has a finite cap.
   * Service/cron paths should pass false so transient read errors do not block automation.
   */
  strictUsageCounts?: boolean
  /** Platform support: skip numeric seat cap (billing state still applies). */
  skipSeatCap?: boolean
}

export type RecordEligibility =
  | { ok: true }
  | { ok: false; reason: RecordEligibilityReason; message: string }

function billingEligibility(subscription: OrganizationSubscription | null): RecordEligibility {
  const access = getBillingAccessState(subscription)
  if (!access.allowRecordCreation) {
    return { ok: false, reason: "billing", message: RECORD_CREATION_BILLING_MESSAGE }
  }
  return { ok: true }
}

/** Customers, work orders, quotes, invoices (no extra quota beyond billing). */
export function evaluateStandardCreate(
  subscription: OrganizationSubscription | null,
): RecordEligibility {
  return billingEligibility(subscription)
}

/** Adding equipment: billing + equipment count vs plan. */
export function evaluateEquipmentCreate(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  opts?: QuotaEvaluationOptions,
): RecordEligibility {
  const strict = opts?.strictUsageCounts ?? false
  const loadFailed = opts?.usageLoadFailed ?? false

  const b = billingEligibility(subscription)
  if (!b.ok) return b

  if (strict && loadFailed && subscription != null) {
    const planId = planIdFromSubscriptionRow(subscription.plan_id)
    const limits = getPlanLimits(planId, isTrialActive(subscription))
    if (limits.equipment !== "unlimited") {
      return { ok: false, reason: "usage_verify", message: USAGE_COUNT_VERIFY_EQUIPMENT_MESSAGE }
    }
  }

  if (!usagePack) {
    return { ok: true }
  }
  const maxEq = usagePack.limits.equipment
  if (maxEq !== "unlimited" && usagePack.usage.equipmentUsed >= maxEq) {
    return {
      ok: false,
      reason: "equipment",
      message: `Equipment limit reached (${maxEq.toLocaleString()}). Upgrade your plan or archive unused records.`,
    }
  }
  return { ok: true }
}

/**
 * Inviting a member: billing + reserved seats vs plan cap.
 * `seatSlotsUsed` must be **seats reserved for the plan** (active billable + invited member rows + pending token invites) — see `fetchOrganizationSeatMetrics`.
 */
export function evaluateSeatInvite(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  seatSlotsUsed: number | null,
  opts?: QuotaEvaluationOptions,
): RecordEligibility {
  const strict = opts?.strictUsageCounts ?? false
  const loadFailed = opts?.usageLoadFailed ?? false

  const b = billingEligibility(subscription)
  if (!b.ok) return b

  if (opts?.skipSeatCap) {
    return { ok: true }
  }

  if (strict && loadFailed && subscription != null) {
    const planId = planIdFromSubscriptionRow(subscription.plan_id)
    const limits = getPlanLimits(planId, isTrialActive(subscription))
    if (limits.users !== "unlimited") {
      return { ok: false, reason: "usage_verify", message: USAGE_COUNT_VERIFY_SEATS_MESSAGE }
    }
  }

  if (!usagePack || seatSlotsUsed == null) {
    return { ok: true }
  }
  const maxUsers = usagePack.limits.users
  if (maxUsers !== "unlimited" && seatSlotsUsed >= maxUsers) {
    return {
      ok: false,
      reason: "seats",
      message: `Seat limit reached (${maxUsers}). Upgrade your plan or remove members to invite others.`,
    }
  }
  return { ok: true }
}
