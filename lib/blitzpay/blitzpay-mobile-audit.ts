import { createHash } from "node:crypto"

const PEPPER = process.env.BLITZPAY_MOBILE_AUDIT_PEPPER ?? "blitzpay_mobile_audit_pepper_dev_only"

export function hashBlitzpayMobileAudit(parts: Record<string, unknown>): string {
  const keys = Object.keys(parts).sort((a, b) => a.localeCompare(b))
  const body = keys.map((k) => `${k}:${JSON.stringify(parts[k])}`).join("|")
  return createHash("sha256").update(PEPPER).update("|").update(body).digest("hex")
}
