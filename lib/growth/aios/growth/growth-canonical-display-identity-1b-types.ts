/** GE-AIOS-INSTITUTIONAL-LEARNING-1B — Canonical display identity types (client-safe). */

export const GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER =
  "ge-aios-institutional-learning-1b-canonical-display-identity-v1" as const

export const CANONICAL_IDENTITY_PRECEDENCE = [
  "verified_company_identity",
  "official_website_branding",
  "canonical_crm_record",
  "prospect_research",
  "operator_override",
  "original_source",
] as const

export type GrowthCanonicalIdentitySource = (typeof CANONICAL_IDENTITY_PRECEDENCE)[number]

export type GrowthCanonicalIdentityKind =
  | "company"
  | "organization"
  | "product"
  | "person"
  | "brand"

export type GrowthCanonicalIdentityEntity = {
  kind: GrowthCanonicalIdentityKind
  canonical: string
  source: GrowthCanonicalIdentitySource
  /** Lowercase or degraded spellings that must be replaced or rejected in copy. */
  degradedForms: string[]
}

export type GrowthCanonicalDisplayIdentity = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER
  company: GrowthCanonicalIdentityEntity
  sellerCompany: GrowthCanonicalIdentityEntity | null
  products: GrowthCanonicalIdentityEntity[]
  people: GrowthCanonicalIdentityEntity[]
  brands: GrowthCanonicalIdentityEntity[]
  /** Operator-approved overrides for this package only — never overwritten on refresh. */
  operatorOverrides: Partial<Record<GrowthCanonicalIdentityKind, string>>
}
