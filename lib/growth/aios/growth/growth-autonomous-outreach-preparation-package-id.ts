/**
 * GE-AIOS-AUTONOMY-1H — Outreach prep package ID helpers (client-safe).
 */

export const GROWTH_AIOS_AUTONOMY_1H_QA_MARKER =
  "ge-aios-autonomy-1h-durable-approval-package-payload-v1" as const

/** Parse outreach-prep:{leadId}:{isoGeneratedAt} minted by Growth 5F. */
export function parseOutreachPrepPackageId(packageId: string): {
  leadId: string
  generatedAt: string
} | null {
  const prefix = "outreach-prep:"
  if (!packageId.startsWith(prefix)) return null
  const rest = packageId.slice(prefix.length)
  const sep = rest.indexOf(":")
  if (sep <= 0) return null
  const leadId = rest.slice(0, sep)
  const generatedAt = rest.slice(sep + 1)
  if (!leadId || !generatedAt || Number.isNaN(Date.parse(generatedAt))) return null
  return { leadId, generatedAt }
}

export function buildOutreachPrepPackageId(leadId: string, generatedAt: string): string {
  return `outreach-prep:${leadId}:${generatedAt}`
}
