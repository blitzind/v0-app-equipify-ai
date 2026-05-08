export type TaxCalculationMode = "manual" | "exempt" | "provider_pending" | "provider_calculated"
export type TaxBasis = "service_location" | "billing_address" | "manual"
export type TaxJurisdictionLevel = "state" | "county" | "city" | "district" | "special" | "other"

export type TaxableLineInput = {
  qty: number
  unit: number
  taxable?: boolean | null
}

export type TaxJurisdictionComponent = {
  level: TaxJurisdictionLevel
  name: string
  providerCode?: string | null
}

export function calculateTaxSubtotals(lines: TaxableLineInput[]): {
  taxableSubtotal: number
  nonTaxableSubtotal: number
} {
  return lines.reduce(
    (acc, line) => {
      const amount = Math.max(0, (Number(line.qty) || 0) * (Number(line.unit) || 0))
      if (line.taxable === false) acc.nonTaxableSubtotal += amount
      else acc.taxableSubtotal += amount
      return acc
    },
    { taxableSubtotal: 0, nonTaxableSubtotal: 0 },
  )
}

export function calculateManualTaxAmount(
  taxableSubtotal: number,
  ratePercent: number,
): number {
  const rate = Number.isFinite(ratePercent) ? Math.max(0, ratePercent) : 0
  return Math.round(taxableSubtotal * (rate / 100) * 100) / 100
}

export function formatTaxBasisLabel(basis: TaxBasis | string | null | undefined): string {
  switch (basis) {
    case "service_location":
      return "Service location"
    case "billing_address":
      return "Billing address"
    case "manual":
      return "Manual"
    default:
      return "Not set"
  }
}

export function formatTaxModeLabel(mode: TaxCalculationMode | string | null | undefined): string {
  switch (mode) {
    case "manual":
      return "Manual tax estimate"
    case "exempt":
      return "Tax exempt"
    case "provider_pending":
      return "Provider pending"
    case "provider_calculated":
      return "Provider calculated"
    default:
      return "Manual tax estimate"
  }
}

export function formatJurisdictionTaxLabel(label: string | null | undefined): string {
  return label?.trim() || "US jurisdiction-based tax"
}

export function normalizeBooleanImport(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (["true", "yes", "y", "1", "exempt"].includes(v)) return true
  if (["false", "no", "n", "0", "taxable", "not exempt"].includes(v)) return false
  return null
}

export function buildProviderTaxRequestDraft(args: {
  provider: "stripe_tax" | "avalara" | "taxjar" | "manual"
  basis: TaxBasis
  jurisdictionLabel?: string | null
  jurisdictionComponents?: TaxJurisdictionComponent[]
  lines: Array<{ description: string; amount: number; taxable: boolean; taxCategory?: string | null }>
}) {
  return {
    provider: args.provider,
    basis: args.basis,
    country: "US",
    jurisdictionLabel: args.jurisdictionLabel ?? null,
    jurisdictionComponents: args.jurisdictionComponents ?? [],
    lines: args.lines,
  }
}
