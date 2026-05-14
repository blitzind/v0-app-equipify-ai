import type { TaxAddressInput, TaxBasis } from "@/lib/tax/types"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import type { SalesTaxCalculationResult } from "@/lib/tax/types"
import type { TaxCalculationMode } from "@/lib/billing/tax-framework"

export function billingAddressFromCustomerLike(c: {
  billing_country?: string | null
  billing_state?: string | null
  billing_city?: string | null
  billing_postal_code?: string | null
}): TaxAddressInput {
  return {
    countryCode: (c.billing_country ?? "US").trim().slice(0, 2).toUpperCase() || "US",
    regionCode: (c.billing_state ?? "").trim().slice(0, 2).toUpperCase(),
    cityName: c.billing_city?.trim() || null,
    postalCode: c.billing_postal_code?.trim() || null,
    countyName: null,
  }
}

export function taxBasisFromCustomerDefault(raw: string | null | undefined): TaxBasis {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "service_location") return "service_location"
  if (v === "manual") return "manual"
  return "billing_address"
}

export function mapSalesTaxToInvoiceInsertFields(args: {
  resolution: SalesTaxCalculationResult
  /** When user chose manual mode in UI, never persist automated. */
  uiMode: TaxCalculationMode
}): {
  taxCalculationMode: TaxCalculationMode
  taxBasis: TaxBasis
  taxJurisdictionLabel: string | null
  taxRatePercent: number | null
  taxAmount: number | null
  taxableSubtotal: number | null
  nonTaxableSubtotal: number | null
  taxExemptionApplied: boolean
  taxExemptionReason: string | null
  taxProvider: string | null
  taxProviderReference: string | null
  taxSnapshotJson: unknown
} {
  const { resolution, uiMode } = args
  if (uiMode === "exempt" || resolution.status === "exempt") {
    return {
      taxCalculationMode: "exempt",
      taxBasis: resolution.taxBasis,
      taxJurisdictionLabel: resolution.jurisdictionSummary,
      taxRatePercent: 0,
      taxAmount: 0,
      taxableSubtotal: resolution.taxableSubtotal,
      nonTaxableSubtotal: resolution.nonTaxableSubtotal,
      taxExemptionApplied: true,
      taxExemptionReason: null,
      taxProvider: "equipify_native",
      taxProviderReference: null,
      taxSnapshotJson: resolution.snapshot,
    }
  }
  if (uiMode === "automated" && resolution.status === "skipped") {
    return {
      taxCalculationMode: "manual",
      taxBasis: resolution.taxBasis,
      taxJurisdictionLabel: "Automatic tax unavailable — configure workspace tax settings or use manual estimate.",
      taxRatePercent: null,
      taxAmount: null,
      taxableSubtotal: null,
      nonTaxableSubtotal: null,
      taxExemptionApplied: false,
      taxExemptionReason: null,
      taxProvider: "equipify_native",
      taxProviderReference: "auto_tax_skipped",
      taxSnapshotJson: resolution.snapshot,
    }
  }
  if (uiMode === "automated" && resolution.status !== "skipped") {
    return {
      taxCalculationMode: "automated",
      taxBasis: resolution.taxBasis,
      taxJurisdictionLabel: resolution.jurisdictionSummary,
      taxRatePercent: resolution.combinedRatePercent,
      taxAmount: resolution.taxAmount,
      taxableSubtotal: resolution.taxableSubtotal,
      nonTaxableSubtotal: resolution.nonTaxableSubtotal,
      taxExemptionApplied: false,
      taxExemptionReason: null,
      taxProvider: "equipify_native",
      taxProviderReference: resolution.status === "fallback" ? "fallback_rate" : null,
      taxSnapshotJson: resolution.snapshot,
    }
  }
  return {
    taxCalculationMode: uiMode,
    taxBasis: resolution.taxBasis,
    taxJurisdictionLabel: null,
    taxRatePercent: null,
    taxAmount: null,
    taxableSubtotal: null,
    nonTaxableSubtotal: null,
    taxExemptionApplied: false,
    taxExemptionReason: null,
    taxProvider: null,
    taxProviderReference: null,
    taxSnapshotJson: null,
  }
}

export function lineItemsForTaxEngine(lines: LineItemJson[]): Array<{
  qty: number
  unit: number
  taxable?: boolean | null
  tax_category?: string | null
  source_ref?: string | null
}> {
  return lines.map((li) => ({
    qty: li.qty,
    unit: li.unit,
    taxable: li.taxable,
    tax_category: li.tax_category ?? null,
    source_ref: li.source_ref ?? null,
  }))
}
