import "server-only"

import { getStripe } from "@/lib/stripe"
import { retrieveConnectAccount } from "@/lib/blitzpay/connect-stripe"
import {
  achCapabilitySnapshotFromAccount,
  resolveAchCapabilityStatusFromAccount,
  type BlitzpayAchCapabilitySnapshot,
  type BlitzpayAchCapabilityStatus,
} from "@/lib/blitzpay/blitzpay-ach-capability-status"

export type { BlitzpayAchCapabilitySnapshot, BlitzpayAchCapabilityStatus }

export {
  achCapabilitySnapshotFromAccount,
  connectedAccountSupportsAch,
  resolveAchCapabilityStatusFromAccount,
} from "@/lib/blitzpay/blitzpay-ach-capability-status"

export type EnsureBlitzpayAchCapabilityResult =
  | { ok: true; status: BlitzpayAchCapabilityStatus; requested: boolean }
  | { ok: false; status: BlitzpayAchCapabilityStatus; code: string; message: string }

/**
 * Request ACH Direct Debit capability on an existing Connect account when workspace ACH is enabled.
 * Idempotent: does not re-request when status is already active or pending.
 */
export async function ensureBlitzpayAchCapabilityRequested(
  stripeConnectAccountId: string,
): Promise<EnsureBlitzpayAchCapabilityResult> {
  const accountId = stripeConnectAccountId.trim()
  if (!accountId) {
    return {
      ok: false,
      status: "unrequested",
      code: "no_connect_account",
      message: "No Stripe Connect account is linked.",
    }
  }

  let account = await retrieveConnectAccount(accountId)
  let status = resolveAchCapabilityStatusFromAccount(account)
  if (status === "active") {
    return { ok: true, status, requested: false }
  }
  if (status === "pending") {
    return { ok: true, status, requested: false }
  }

  const cap = account.capabilities?.us_bank_account_ach_payments
  const alreadyRequested = cap?.requested === true
  if (alreadyRequested && (status === "inactive" || status === "restricted")) {
    return { ok: true, status, requested: false }
  }

  if (status === "unrequested" || status === "inactive") {
    const stripe = getStripe()
    try {
      account = await stripe.accounts.update(accountId, {
        capabilities: { us_bank_account_ach_payments: { requested: true } },
      })
      status = resolveAchCapabilityStatusFromAccount(account)
      return { ok: true, status, requested: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        status,
        code: "stripe_capability_request_failed",
        message: msg.slice(0, 240),
      }
    }
  }

  return { ok: true, status, requested: false }
}

export async function fetchBlitzpayAchCapabilitySnapshot(
  stripeConnectAccountId: string | null | undefined,
): Promise<BlitzpayAchCapabilitySnapshot | null> {
  const accountId = String(stripeConnectAccountId ?? "").trim()
  if (!accountId) return null
  try {
    const account = await retrieveConnectAccount(accountId)
    return achCapabilitySnapshotFromAccount(account)
  } catch {
    return null
  }
}
