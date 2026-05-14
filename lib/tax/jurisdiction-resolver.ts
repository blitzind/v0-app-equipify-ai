import type { MatchedTaxComponent, TaxAddressInput, TaxJurisdictionRow, TaxRateAppliesTo, TaxRateRow } from "@/lib/tax/types"

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase()
}

function zip5(postal: string | null | undefined): string | null {
  const z = (postal ?? "").replace(/\D/g, "").slice(0, 5)
  return z.length === 5 ? z : null
}

function rowMatchesAddress(j: TaxJurisdictionRow, addr: TaxAddressInput): boolean {
  if (!j.active) return false
  if (norm(j.country_code) !== norm(addr.countryCode)) return false
  if (norm(j.region_code) !== norm(addr.regionCode)) return false

  const jZip = j.postal_code?.trim() || null
  const aZip = zip5(addr.postalCode)
  if (jZip) {
    if (!aZip || norm(jZip) !== aZip) return false
  }

  const jCounty = j.county_name?.trim() || null
  if (jCounty) {
    const aCounty = addr.countyName?.trim() || null
    if (!aCounty || norm(jCounty) !== norm(aCounty)) return false
  }

  const jCity = j.city_name?.trim() || null
  if (jCity) {
    const aCity = addr.cityName?.trim() || null
    if (!aCity || norm(jCity) !== norm(aCity)) return false
  }

  return true
}

function rateEffectiveOn(r: TaxRateRow, asOfYmd: string): boolean {
  if (!r.active) return false
  const start = r.effective_start.slice(0, 10)
  const end = r.effective_end ? r.effective_end.slice(0, 10) : null
  if (asOfYmd < start) return false
  if (end && asOfYmd > end) return false
  return true
}

/**
 * Deterministic match: every jurisdiction row whose non-null geographic fields
 * all match the address qualifies; multiple rows stack (state + district ZIP, etc.).
 */
export function resolveStackedTaxComponents(args: {
  jurisdictions: TaxJurisdictionRow[]
  rates: TaxRateRow[]
  address: TaxAddressInput
  asOfYmd: string
}): MatchedTaxComponent[] {
  const { jurisdictions, rates, address, asOfYmd } = args
  const rateByJurisdiction = new Map<string, TaxRateRow[]>()
  for (const r of rates) {
    if (!rateEffectiveOn(r, asOfYmd)) continue
    const list = rateByJurisdiction.get(r.jurisdiction_id) ?? []
    list.push(r)
    rateByJurisdiction.set(r.jurisdiction_id, list)
  }

  const matched: MatchedTaxComponent[] = []
  for (const j of jurisdictions) {
    if (!rowMatchesAddress(j, address)) continue
    const rs = rateByJurisdiction.get(j.id)
    if (!rs?.length) continue
    // Deterministic: lowest rate id wins if multiple active rates same day (should not happen).
    const picked = [...rs].sort((a, b) => a.id.localeCompare(b.id))[0]
    matched.push({
      jurisdictionId: j.id,
      jurisdictionCode: j.code,
      jurisdictionType: j.jurisdiction_type,
      displayName: j.display_name,
      rateId: picked.id,
      ratePercent: Number(picked.rate_percent),
      appliesTo: (picked.applies_to as TaxRateAppliesTo) || "all",
      source: picked.source,
    })
  }

  // Stable order: state → county → city → district → special → other
  const order: Record<string, number> = {
    country: 0,
    state: 1,
    county: 2,
    city: 3,
    district: 4,
    special: 5,
  }
  matched.sort((a, b) => {
    const da = order[a.jurisdictionType] ?? 9
    const db = order[b.jurisdictionType] ?? 9
    if (da !== db) return da - db
    return a.jurisdictionCode.localeCompare(b.jurisdictionCode)
  })

  return matched
}
