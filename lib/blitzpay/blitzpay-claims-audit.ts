import { createHash } from "node:crypto"

const PEPPER = process.env.BLITZPAY_CLAIMS_AUDIT_PEPPER ?? "blitzpay_claims_audit_pepper_dev_only"

export function hashBlitzpayClaimsAudit(parts: Record<string, unknown>): string {
  const keys = Object.keys(parts).sort((a, b) => a.localeCompare(b))
  const body = keys.map((k) => `${k}:${JSON.stringify(parts[k])}`).join("|")
  return createHash("sha256").update(PEPPER).update("|").update(body).digest("hex")
}

/** Opaque reference for payout tracking rows (no external payment identifiers). */
export function hashBlitzpayClaimPayoutReference(parts: { organizationId: string; claimId: string; amountCents: number; createdAtIso: string }): string {
  return hashBlitzpayClaimsAudit({
    kind: "payout_tracking_ref",
    organization_id: parts.organizationId,
    claim_id: parts.claimId,
    amount_cents: parts.amountCents,
    created_at: parts.createdAtIso,
  })
}
