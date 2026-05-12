/**
 * Bounded employer-side payroll tax estimation (orchestration only — not remittance).
 * Integer cents; uses basis points on gross payroll liability proxy.
 */

export const BLITZPAY_DEFAULT_EMPLOYER_PAYROLL_TAX_BPS = 765

export function estimateEmployerPayrollTaxCents(grossPayrollLiabilityCents: number, employerRateBps: number = BLITZPAY_DEFAULT_EMPLOYER_PAYROLL_TAX_BPS): number {
  const g = Math.max(0, Math.round(grossPayrollLiabilityCents))
  const bps = Math.max(0, Math.min(50_000, Math.round(employerRateBps)))
  return Math.min(g, Math.round((g * bps) / 10_000))
}
