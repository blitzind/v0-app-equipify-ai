/** BlitzPay Phase 3D — deterministic marketplace orchestration (integer cents / bps; bounded). */

export const BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP = 80
export const BLITZPAY_FINANCING_APPLICATION_LIST_CAP = 100
export const BLITZPAY_FINANCING_OFFER_LIST_CAP = 120
export const BLITZPAY_FINANCING_MATCH_LIST_CAP = 80
export const BLITZPAY_FINANCING_AUDIT_LIST_CAP = 100
export const BLITZPAY_CONTRACTOR_ADVANCE_MODEL_LIST_CAP = 60

export type MarketplaceProviderRowInput = {
  id: string
  organization_id: string | null
  provider_name: string
  provider_status: string
  provider_type: string
  minimum_amount_cents: number | null
  maximum_amount_cents: number | null
  supported_products: unknown
}

/** Parse supported_products JSON array of strings; deterministic order. */
export function parseSupportedProducts(metadataProducts: unknown): string[] {
  if (!Array.isArray(metadataProducts)) return []
  const out = metadataProducts.map((x) => String(x).trim()).filter(Boolean)
  return [...new Set(out)].sort((a, b) => a.localeCompare(b))
}

/** Compatibility 0–100: amount in range + type alignment + product tag overlap. */
export function computeProviderCompatibilityScore0to100(input: {
  applicationType: string
  requestedAmountCents: number
  provider: Pick<
    MarketplaceProviderRowInput,
    "provider_type" | "minimum_amount_cents" | "maximum_amount_cents" | "supported_products"
  >
}): { score: number; reason: string } {
  const amt = Math.max(0, Math.round(input.requestedAmountCents))
  const min = input.provider.minimum_amount_cents != null ? Math.round(Number(input.provider.minimum_amount_cents)) : 0
  const max =
    input.provider.maximum_amount_cents != null ? Math.round(Number(input.provider.maximum_amount_cents)) : Number.MAX_SAFE_INTEGER
  let score = 40
  if (amt < min) score -= 25
  if (amt > max) score -= 35
  const pt = input.provider.provider_type
  const at = input.applicationType
  if (pt === "hybrid") score += 10
  else if (at === "membership" && pt === "membership_financing") score += 25
  else if (at === "equipment_purchase" && pt === "equipment_financing") score += 25
  else if (at === "contractor_advance" && pt === "contractor_advance") score += 25
  else if (at === "revenue_share" && pt === "revenue_share") score += 25
  else if (at === "customer_service" && pt === "customer_financing") score += 25
  else score += 5
  const prods = parseSupportedProducts(input.provider.supported_products)
  if (prods.length) score += Math.min(15, prods.length * 3)
  const reasonParts: string[] = []
  if (amt < min || amt > max) reasonParts.push("amount_range")
  reasonParts.push(`type:${pt}`)
  if (prods.length) reasonParts.push(`products:${prods.slice(0, 3).join(",")}`)
  return { score: Math.max(0, Math.min(100, score)), reason: reasonParts.join("|") }
}

/** Sort providers for deterministic matching: compatibility desc, name asc, id asc. */
export function sortProviderMatchesDeterministic<T extends { providerId: string; score: number; providerName: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const n = a.providerName.localeCompare(b.providerName)
    if (n !== 0) return n
    return a.providerId.localeCompare(b.providerId)
  })
}

/** Sort offers for comparison: lower estimated APR bps first (nulls last), then higher amount, then id. */
export function sortFinancingOffersForComparison<
  T extends {
    id: string
    offer_amount_cents: number
    estimated_apr_basis_points: number | null
    estimated_payment_cents: number | null
    estimated_term_months: number | null
  },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aApr = a.estimated_apr_basis_points
    const bApr = b.estimated_apr_basis_points
    if (aApr != null && bApr != null && aApr !== bApr) return aApr - bApr
    if (aApr == null && bApr != null) return 1
    if (aApr != null && bApr == null) return -1
    const amt = b.offer_amount_cents - a.offer_amount_cents
    if (amt !== 0) return amt
    return a.id.localeCompare(b.id)
  })
}

/** Treasury impact 0–100 from coverage bps (higher coverage → lower financing stress). */
export function treasuryImpactScoreFromCoverageBps(treasuryCoverageBps: number): number {
  const b = Math.max(0, Math.min(1_000_000, Math.round(treasuryCoverageBps)))
  return Math.max(0, Math.min(100, Math.round((b * 100) / 1_000_000)))
}

/** Days until expiration from YMD; null if no expiration. */
export function daysUntilExpirationYmd(expirationYmd: string | null, asOfYmd: string): number | null {
  if (!expirationYmd) return null
  const a = new Date(`${asOfYmd}T12:00:00Z`).getTime()
  const e = new Date(`${expirationYmd.slice(0, 10)}T12:00:00Z`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(e)) return null
  return Math.round((e - a) / 86_400_000)
}
