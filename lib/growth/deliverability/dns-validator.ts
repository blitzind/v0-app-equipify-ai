/** Stub DNS domain validation — no live DNS calls in Phase 1C. Client-safe. */

import { evaluateDnsHealth } from "@/lib/growth/deliverability/dns-health"
import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"

export type ValidateDnsDomainInput = {
  domain: string
  hints?: Partial<GrowthDnsCheckResult>
  stub_mode?: boolean
}

export type ValidateDnsDomainResult = GrowthDnsCheckResult & {
  domain: string
  dns_health_score: number
  health_tier: ReturnType<typeof evaluateDnsHealth>["health_tier"]
  warnings: string[]
  recommendations: string[]
  checked_at: string
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "")
}

export function validateDnsDomain(input: ValidateDnsDomainInput): ValidateDnsDomainResult {
  const domain = normalizeDomain(input.domain)
  const hints = input.hints ?? {}
  const stub_mode = input.stub_mode ?? true

  const check: GrowthDnsCheckResult = {
    spf_present: hints.spf_present ?? hints.spf_valid ?? false,
    spf_valid: hints.spf_valid ?? false,
    dkim_present: hints.dkim_present ?? hints.dkim_valid ?? false,
    dkim_valid: hints.dkim_valid ?? false,
    dmarc_present: hints.dmarc_present ?? hints.dmarc_valid ?? false,
    dmarc_valid: hints.dmarc_valid ?? false,
    mx_present: hints.mx_present ?? hints.mx_valid ?? false,
    mx_valid: hints.mx_valid ?? false,
    mx_provider: hints.mx_provider ?? null,
  }

  const evaluation = evaluateDnsHealth({ ...check, stub_mode })

  return {
    domain,
    ...check,
    dns_health_score: evaluation.dns_health_score,
    health_tier: evaluation.health_tier,
    warnings: evaluation.warnings,
    recommendations: evaluation.recommendations,
    checked_at: new Date().toISOString(),
  }
}
