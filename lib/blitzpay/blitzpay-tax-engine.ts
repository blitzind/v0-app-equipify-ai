/** BlitzPay Phase 3C — deterministic tax & convenience-fee helpers (integer cents / bps only). */

export const BLITZPAY_TAX_RULE_LIST_CAP = 80
export const BLITZPAY_TAX_CALCULATION_LIST_CAP = 120
export const BLITZPAY_TAX_JURISDICTION_LIST_CAP = 60
export const BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP = 100
export const BLITZPAY_ACH_AUTH_LIST_CAP = 80
export const BLITZPAY_VENDOR_TAX_PROFILE_LIST_CAP = 100

export type BlitzpayJurisdictionType =
  | "federal"
  | "state"
  | "county"
  | "city"
  | "district"
  | "international"

/** Higher = more local (applied first in rule stacks). */
export function jurisdictionTypePrecedenceRank(t: string): number {
  switch (t) {
    case "international":
      return 0
    case "federal":
      return 1
    case "state":
      return 2
    case "county":
      return 3
    case "city":
      return 4
    case "district":
      return 5
    default:
      return 0
  }
}

export type TaxRuleRowInput = {
  id: string
  jurisdiction_id: string
  jurisdiction_type: string
  tax_rule_type: string
  calculation_method: string
  rate_basis_points: number | null
  flat_amount_cents: number | null
  threshold_amount_cents: number | null
  applies_to: string
  effective_start_date: string
  effective_end_date: string | null
  compliance_status: string
}

/** Active rules for `appliesTo` on `asOfYmd`, deterministic order (locality → start date → id). */
export function resolveActiveTaxRulesForAppliesTo(
  rules: TaxRuleRowInput[],
  appliesTo: string,
  asOfYmd: string,
): TaxRuleRowInput[] {
  const day = asOfYmd.slice(0, 10)
  const filtered = rules.filter((r) => {
    if (r.applies_to !== appliesTo) return false
    if (r.compliance_status !== "active" && r.compliance_status !== "pending_review") return false
    if (r.effective_start_date > day) return false
    if (r.effective_end_date && r.effective_end_date < day) return false
    return true
  })
  return [...filtered].sort((a, b) => {
    const jr = jurisdictionTypePrecedenceRank(b.jurisdiction_type) - jurisdictionTypePrecedenceRank(a.jurisdiction_type)
    if (jr !== 0) return jr
    const sd = b.effective_start_date.localeCompare(a.effective_start_date)
    if (sd !== 0) return sd
    return a.id.localeCompare(b.id)
  })
}

export function calculateTaxCentsFromRule(
  taxableCents: number,
  rule: Pick<
    TaxRuleRowInput,
    "calculation_method" | "rate_basis_points" | "flat_amount_cents" | "threshold_amount_cents"
  >,
): { taxCents: number; effectiveBps: number | null } {
  const base = Math.max(0, Math.round(taxableCents))
  const method = rule.calculation_method
  if (method === "flat") {
    const flat = Math.max(0, Math.round(Number(rule.flat_amount_cents ?? 0)))
    return { taxCents: flat, effectiveBps: base > 0 ? Math.min(1_000_000, Math.round((flat * 10_000) / base)) : null }
  }
  if (method === "threshold") {
    const th = Math.max(0, Math.round(Number(rule.threshold_amount_cents ?? 0)))
    const bps = Math.max(0, Math.round(Number(rule.rate_basis_points ?? 0)))
    if (base <= th) return { taxCents: 0, effectiveBps: 0 }
    const over = base - th
    const tax = Math.min(base, Math.round((over * bps) / 10_000))
    return { taxCents: tax, effectiveBps: base > 0 ? Math.min(1_000_000, Math.round((tax * 10_000) / base)) : null }
  }
  if (method === "tiered") {
    /** Phase 3C: tiered not fully expanded — return 0 tax with null bps (caller may use separate rows). */
    return { taxCents: 0, effectiveBps: null }
  }
  /** percentage */
  const bps = Math.max(0, Math.round(Number(rule.rate_basis_points ?? 0)))
  const tax = Math.min(base, Math.round((base * bps) / 10_000))
  return { taxCents: tax, effectiveBps: bps }
}

export type ConvenienceFeePolicy = "allowed" | "prohibited" | "conditional"

export function parseConvenienceFeePolicyFromRuleMetadata(metadata: Record<string, unknown> | null | undefined): ConvenienceFeePolicy {
  const raw = String((metadata as { convenience_fee_policy?: string } | null)?.convenience_fee_policy ?? "allowed")
    .toLowerCase()
    .trim()
  if (raw === "prohibited" || raw === "conditional" || raw === "allowed") return raw
  return "allowed"
}

export function evaluateConvenienceFeeEligibility(
  policy: ConvenienceFeePolicy,
  context: { disclosureAcknowledged?: boolean },
): { permitted: boolean; warningCode: string | null; warningMessage: string | null } {
  if (policy === "prohibited") {
    return {
      permitted: false,
      warningCode: "convenience_fee_prohibited",
      warningMessage: "Your saved rules flag convenience fees as not allowed for this jurisdiction pattern — double-check before charging.",
    }
  }
  if (policy === "conditional") {
    if (!context.disclosureAcknowledged) {
      return {
        permitted: false,
        warningCode: "convenience_fee_conditional",
        warningMessage: "Conditional convenience fee: confirm customer-facing disclosure is in place before enabling pass-through.",
      }
    }
    return { permitted: true, warningCode: null, warningMessage: null }
  }
  return { permitted: true, warningCode: null, warningMessage: null }
}

export function computeFilingReadinessScore0to100(input: {
  jurisdictionsConfigured: number
  activeTaxRules: number
  vendor1099ReadinessPct: number
  achCoveragePct: number
}): number {
  const j = Math.min(30, input.jurisdictionsConfigured * 6)
  const r = Math.min(35, input.activeTaxRules * 3)
  const v = Math.min(20, Math.round((input.vendor1099ReadinessPct * 20) / 100))
  const a = Math.min(15, Math.round((input.achCoveragePct * 15) / 100))
  return Math.max(0, Math.min(100, j + r + v + a))
}

export function computeComplianceRiskScore0to100(input: {
  convenienceFeeExposureRisk: number
  overdueComplianceFlags: number
  voidedCalculationRatioPct: number
}): number {
  const fee = Math.min(45, Math.round((input.convenienceFeeExposureRisk * 45) / 100))
  const flags = Math.min(35, input.overdueComplianceFlags * 7)
  const voided = Math.min(20, Math.round((input.voidedCalculationRatioPct * 20) / 100))
  return Math.max(0, Math.min(100, fee + flags + voided))
}

export function computeVendor1099Readiness0to100(requires1099: boolean, profile: { tax_profile_status: string; w9_received_at: string | null; tin_reference_hash: string | null } | null): number {
  if (!requires1099) return 100
  if (!profile) return 0
  let s = 0
  if (profile.tin_reference_hash) s += 40
  if (profile.w9_received_at) s += 40
  if (profile.tax_profile_status === "complete") s += 20
  if (profile.tax_profile_status === "flagged") s = Math.max(0, s - 25)
  return Math.max(0, Math.min(100, s))
}

export function computeConvenienceFeeExposureRisk0to100(
  policy: ConvenienceFeePolicy,
  hasActiveConvenienceFeeRules: boolean,
): number {
  if (policy === "prohibited" && hasActiveConvenienceFeeRules) return 85
  if (policy === "conditional") return 45
  if (policy === "prohibited") return 70
  return hasActiveConvenienceFeeRules ? 25 : 10
}

export function isAchAuthorizationRetained(input: {
  authorization_status: string
  expires_at: string | null
  revoked_at: string | null
  nowMs?: number
}): boolean {
  if (input.authorization_status !== "active") return false
  if (input.revoked_at) return false
  const now = input.nowMs ?? Date.now()
  if (input.expires_at) {
    const ex = new Date(input.expires_at).getTime()
    if (Number.isFinite(ex) && ex < now) return false
  }
  return true
}
