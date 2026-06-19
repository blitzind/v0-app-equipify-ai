/** GE-MAIL-1D — Domain deliverability DNS setup instructions (client-safe). */

import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"

export const GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER =
  "growth-domain-deliverability-setup-1d-v1" as const

export const GROWTH_DOMAIN_DNS_RECORD_KINDS = ["mx", "spf", "dkim", "dmarc"] as const
export type GrowthDomainDnsRecordKind = (typeof GROWTH_DOMAIN_DNS_RECORD_KINDS)[number]

export const GROWTH_DOMAIN_DNS_RECORD_STATUSES = ["valid", "missing", "invalid", "pending"] as const
export type GrowthDomainDnsRecordStatus = (typeof GROWTH_DOMAIN_DNS_RECORD_STATUSES)[number]

export const GROWTH_DOMAIN_DELIVERABILITY_HEALTH_LABELS = ["Healthy", "Warning", "At Risk"] as const
export type GrowthDomainDeliverabilityHealthLabel =
  (typeof GROWTH_DOMAIN_DELIVERABILITY_HEALTH_LABELS)[number]

export const GROWTH_DOMAIN_DNS_RECORD_POINT_WEIGHT = 25 as const

export type GrowthDomainDnsRecordEntry = {
  record_type: "MX" | "TXT" | "CNAME"
  host: string
  value: string
  priority?: number
  ttl?: number
}

export type GrowthDomainDnsRecordSection = {
  kind: GrowthDomainDnsRecordKind
  title: string
  purpose: string
  records: GrowthDomainDnsRecordEntry[]
  operator_instructions: string | null
  status: GrowthDomainDnsRecordStatus
  points: number
  verified_at: string | null
}

export type GrowthDomainDeliverabilityScoreBreakdown = {
  spf: number
  dkim: number
  dmarc: number
  mx: number
  total: number
}

export type GrowthDomainCopySetupCandidate = {
  domain_id: string
  domain: string
  deliverability_score: number
  is_google_workspace: boolean
}

export type GrowthDomainDeliverabilitySetupInstructions = {
  qa_marker: typeof GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER
  domain_id: string
  domain: string
  is_google_workspace: boolean
  mx_provider: string | null
  deliverability_score: number
  health_label: GrowthDomainDeliverabilityHealthLabel
  score_breakdown: GrowthDomainDeliverabilityScoreBreakdown
  sections: GrowthDomainDnsRecordSection[]
  last_verified_at: string | null
  live_dns_enabled: boolean
  copy_setup_candidates: GrowthDomainCopySetupCandidate[]
  copied_from_domain_id: string | null
  copied_from_domain: string | null
}

export const GOOGLE_WORKSPACE_MX_RECORDS: ReadonlyArray<{
  exchange: string
  priority: number
}> = [
  { exchange: "ASPMX.L.GOOGLE.COM", priority: 1 },
  { exchange: "ALT1.ASPMX.L.GOOGLE.COM", priority: 5 },
  { exchange: "ALT2.ASPMX.L.GOOGLE.COM", priority: 5 },
  { exchange: "ALT3.ASPMX.L.GOOGLE.COM", priority: 10 },
  { exchange: "ALT4.ASPMX.L.GOOGLE.COM", priority: 10 },
]

export function buildGoogleWorkspaceSpfRecord(): string {
  return "v=spf1 include:_spf.google.com ~all"
}

export function buildRecommendedDmarcRecord(domain: string): string {
  const normalized = domain.trim().toLowerCase()
  return `v=DMARC1; p=none; rua=mailto:dmarc@${normalized}; pct=100; adkim=s; aspf=s`
}

export function recordStatusFromCheck(
  present: boolean,
  valid: boolean,
): GrowthDomainDnsRecordStatus {
  if (present && valid) return "valid"
  if (!present) return "missing"
  return "invalid"
}

export function pointsForRecordStatus(status: GrowthDomainDnsRecordStatus): number {
  return status === "valid" ? GROWTH_DOMAIN_DNS_RECORD_POINT_WEIGHT : 0
}

export function computeEqualWeightDeliverabilityBreakdown(
  check: GrowthDnsCheckResult,
): GrowthDomainDeliverabilityScoreBreakdown {
  const spf = pointsForRecordStatus(recordStatusFromCheck(check.spf_present, check.spf_valid))
  const dkim = pointsForRecordStatus(recordStatusFromCheck(check.dkim_present, check.dkim_valid))
  const dmarc = pointsForRecordStatus(recordStatusFromCheck(check.dmarc_present, check.dmarc_valid))
  const mx = pointsForRecordStatus(recordStatusFromCheck(check.mx_present, check.mx_valid))
  return {
    spf,
    dkim,
    dmarc,
    mx,
    total: spf + dkim + dmarc + mx,
  }
}

export function deliverabilitySetupHealthLabel(
  score: number,
): GrowthDomainDeliverabilityHealthLabel {
  if (score >= 100) return "Healthy"
  if (score >= 50) return "Warning"
  return "At Risk"
}

export function growthDomainDnsRecordStatusLabel(status: GrowthDomainDnsRecordStatus): string {
  switch (status) {
    case "valid":
      return "Verified"
    case "missing":
      return "Missing"
    case "invalid":
      return "Invalid"
    case "pending":
      return "Pending"
  }
}
