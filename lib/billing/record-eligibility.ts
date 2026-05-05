import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { getBillingAccessState } from "@/lib/billing/access"
import type { UsageWithLimits } from "@/lib/billing/usage"

/** Standard copy when billing state blocks creates */
export const RECORD_CREATION_BILLING_MESSAGE =
  "Your trial or subscription needs attention before creating new records."

export type RecordEligibilityReason = "billing" | "equipment" | "seats" | "maintenance_plan"

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
): RecordEligibility {
  const b = billingEligibility(subscription)
  if (!b.ok) return b
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
 * Inviting a member: billing + seat slots (active + invited roster).
 * Pass total seat slots already used (active + invited).
 */
export function evaluateSeatInvite(
  subscription: OrganizationSubscription | null,
  usagePack: UsageWithLimits | null,
  seatSlotsUsed: number | null,
): RecordEligibility {
  const b = billingEligibility(subscription)
  if (!b.ok) return b
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
