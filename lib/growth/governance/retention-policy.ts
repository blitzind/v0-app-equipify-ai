import type { GrowthGovernanceRetentionPolicy } from "@/lib/growth/governance/governance-types"

export function evaluateRetentionEligible(
  recordedAt: string,
  retentionDays: number,
  legalHold: boolean,
): { eligible: boolean; blockedByLegalHold: boolean } {
  if (legalHold) return { eligible: false, blockedByLegalHold: true }
  const ageMs = Date.now() - new Date(recordedAt).getTime()
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000
  return { eligible: ageMs >= maxAgeMs, blockedByLegalHold: false }
}

export function pickEffectiveRetentionPolicy(
  policies: GrowthGovernanceRetentionPolicy[],
  scope: GrowthGovernanceRetentionPolicy["scope"],
): GrowthGovernanceRetentionPolicy | null {
  const active = policies.filter((policy) => policy.status === "active" && policy.scope === scope)
  if (active.length === 0) return null
  return active.sort((a, b) => b.retentionDays - a.retentionDays)[0] ?? null
}

export function retentionSummaryLabel(policy: GrowthGovernanceRetentionPolicy): string {
  const hold = policy.legalHold ? " · legal hold" : ""
  return `${policy.scope}: ${policy.retentionDays} days${hold}`
}
