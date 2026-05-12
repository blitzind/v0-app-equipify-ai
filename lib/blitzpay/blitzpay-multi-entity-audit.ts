import { createHash } from "node:crypto"

const AUDIT_PEPPER = process.env.BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER ?? "blitzpay_multi_entity_audit_pepper_dev_only"

export function hashBlitzpayMultiEntityAudit(parts: Record<string, unknown>): string {
  const keys = Object.keys(parts).sort((a, b) => a.localeCompare(b))
  const body = keys.map((k) => `${k}:${JSON.stringify(parts[k])}`).join("|")
  return createHash("sha256").update(AUDIT_PEPPER).update("|").update(body).digest("hex")
}
