/**
 * Equipify native sales tax types (provider-neutral; future Stripe Tax / Avalara hooks).
 */

export type TaxSourcingMode = "origin" | "destination"

export type TaxCalculationMode =
  | "manual"
  | "exempt"
  | "provider_pending"
  | "provider_calculated"
  | "automated"

export type TaxBasis = "service_location" | "billing_address" | "manual"

export type TaxRateAppliesTo = "all" | "labor" | "parts" | "services"

export type TaxJurisdictionRow = {
  id: string
  organization_id: string | null
  country_code: string
  region_code: string
  county_name: string | null
  city_name: string | null
  postal_code: string | null
  jurisdiction_type: string
  code: string
  display_name: string
  active: boolean
  source: string
  metadata: Record<string, unknown>
}

export type TaxRateRow = {
  id: string
  jurisdiction_id: string
  rate_percent: number
  applies_to: TaxRateAppliesTo
  effective_start: string
  effective_end: string | null
  active: boolean
  source: string
  metadata: Record<string, unknown>
}

export type OrganizationTaxSettingsRow = {
  organization_id: string
  auto_tax_enabled: boolean
  fallback_tax_rate_percent: number
  taxable_labor_default: boolean
  taxable_parts_default: boolean
  sourcing_mode: TaxSourcingMode
  manual_override_allowed: boolean
  primary_provider: string
}

export type CustomerTaxOverrideRow = {
  organization_id: string
  customer_id: string
  fixed_combined_rate_percent: number | null
  force_tax_exempt: boolean
  notes: string | null
}

export type TaxAddressInput = {
  countryCode: string
  regionCode: string
  countyName?: string | null
  cityName?: string | null
  postalCode?: string | null
}

export type TaxLineClassification = "labor" | "parts" | "services" | "other"

export type TaxableLineForEngine = {
  qty: number
  unit: number
  taxable?: boolean | null
  tax_category?: string | null
  source_ref?: string | null
}

export type MatchedTaxComponent = {
  jurisdictionId: string
  jurisdictionCode: string
  jurisdictionType: string
  displayName: string
  rateId: string
  ratePercent: number
  appliesTo: TaxRateAppliesTo
  source: string
}

export type SalesTaxCalculationResult = {
  status: "success" | "exempt" | "fallback" | "skipped" | "error"
  taxableSubtotal: number
  nonTaxableSubtotal: number
  taxAmount: number
  combinedRatePercent: number
  components: MatchedTaxComponent[]
  jurisdictionSummary: string
  taxBasis: TaxBasis
  provider: "equipify_native"
  /** Persisted on invoices / quotes as tax_snapshot_json */
  snapshot: Record<string, unknown>
}
