import { createHash } from "node:crypto"

const PEPPER = process.env.BLITZPAY_GL_SOURCE_PEPPER ?? "blitzpay_gl_source_pepper_dev_only"

/** Shallow sorted JSON for stable hashing (no nested reorder beyond JSON.stringify). */
export function canonicalizeForComplianceAudit(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    out[k] = input[k]
  }
  return JSON.stringify(out)
}

export function buildComplianceAuditImmutableHash(parts: Record<string, unknown>): string {
  const body = canonicalizeForComplianceAudit(parts)
  return createHash("sha256").update(PEPPER).update("|").update(body).digest("hex")
}
