import type Stripe from "stripe"

export type BlitzpayAchCapabilityStatus =
  | "active"
  | "pending"
  | "inactive"
  | "unrequested"
  | "restricted"

export type BlitzpayAchCapabilitySnapshot = {
  status: BlitzpayAchCapabilityStatus
  achReady: boolean
}

/** Stripe Account.capabilities values may be status strings or Capability objects (SDK/API version dependent). */
export type StripeAccountCapabilityValue =
  | Stripe.Account.Capability.Status
  | Stripe.Account.Capability
  | null
  | undefined

const KNOWN_CAPABILITY_STATUSES = new Set<Stripe.Account.Capability.Status>([
  "active",
  "inactive",
  "pending",
])

export function normalizeCapabilityStatus(
  cap: StripeAccountCapabilityValue,
): Stripe.Account.Capability.Status | "unrequested" {
  if (cap == null) return "unrequested"
  if (typeof cap === "string") {
    return KNOWN_CAPABILITY_STATUSES.has(cap) ? cap : "unrequested"
  }
  if (typeof cap === "object" && typeof cap.status === "string") {
    return KNOWN_CAPABILITY_STATUSES.has(cap.status) ? cap.status : "unrequested"
  }
  return "unrequested"
}

export function resolveAchCapabilityStatusFromAccount(
  account: Pick<Stripe.Account, "capabilities" | "requirements">,
): BlitzpayAchCapabilityStatus {
  const caps = account.capabilities as Record<string, StripeAccountCapabilityValue> | null | undefined
  const raw = normalizeCapabilityStatus(caps?.us_bank_account_ach_payments)
  if (raw === "active") return "active"
  if (raw === "pending") return "pending"
  if (raw === "inactive") {
    const disabled = account.requirements?.disabled_reason
    if (disabled && String(disabled).length > 0) return "restricted"
    return "inactive"
  }
  return "unrequested"
}

export function achCapabilitySnapshotFromAccount(
  account: Pick<Stripe.Account, "capabilities" | "requirements">,
): BlitzpayAchCapabilitySnapshot {
  const status = resolveAchCapabilityStatusFromAccount(account)
  return { status, achReady: status === "active" }
}

export function connectedAccountSupportsAch(account: Pick<Stripe.Account, "capabilities" | "requirements">): boolean {
  return resolveAchCapabilityStatusFromAccount(account) === "active"
}
