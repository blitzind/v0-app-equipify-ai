/** Deterministic DNS recommendations. Client-safe. */

import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"

export function generateDnsRecommendations(input: GrowthDnsCheckResult): string[] {
  const recommendations: string[] = []

  if (!input.spf_present || !input.spf_valid) {
    recommendations.push("Add SPF authentication")
  }
  if (!input.dkim_present || !input.dkim_valid) {
    recommendations.push("Configure DKIM signing")
  }
  if (!input.dmarc_present || !input.dmarc_valid) {
    recommendations.push("Add DMARC enforcement")
  }
  if (!input.mx_present || !input.mx_valid) {
    recommendations.push("Verify mail routing")
  }

  return recommendations
}

export function generateDnsWarnings(input: GrowthDnsCheckResult & { stub_mode?: boolean }): string[] {
  const warnings: string[] = []

  if (input.stub_mode) {
    warnings.push("Live DNS validation not enabled — stub infrastructure check only.")
  }
  if (!input.spf_present || !input.spf_valid) warnings.push("SPF record missing or invalid")
  if (!input.dkim_present || !input.dkim_valid) warnings.push("DKIM record missing or invalid")
  if (!input.dmarc_present || !input.dmarc_valid) warnings.push("DMARC record missing or invalid")
  if (!input.mx_present || !input.mx_valid) warnings.push("MX record missing or invalid — critical routing risk")

  return warnings
}
