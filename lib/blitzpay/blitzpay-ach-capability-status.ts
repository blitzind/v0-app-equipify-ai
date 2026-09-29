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

function capabilityStatus(
  cap: Stripe.Account.Capability | undefined,
): Stripe.Account.Capability.Status | "unrequested" {
  if (!cap) return "unrequested"
  return cap.status ?? "unrequested"
}

export function resolveAchCapabilityStatusFromAccount(
  account: Pick<Stripe.Account, "capabilities" | "requirements">,
): BlitzpayAchCapabilityStatus {
  const raw = capabilityStatus(account.capabilities?.us_bank_account_ach_payments)
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
