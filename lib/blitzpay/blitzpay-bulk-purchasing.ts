export type BulkOpportunityRow = {
  estimated_savings_cents: number | null
  estimated_total_volume_cents: number | null
  opportunity_status: string
  id?: string
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/** Sum estimated savings cents for active opportunities (deterministic row order). */
export function sumActiveBulkPurchaseSavingsCents(rows: ReadonlyArray<BulkOpportunityRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let sum = 0
  for (const r of sorted) {
    if (String(r.opportunity_status) !== "active") continue
    sum += Math.max(0, Math.round(Number(r.estimated_savings_cents ?? 0)))
  }
  return sum
}

/** Sum volume cents for active opportunities (bounded aggregation). */
export function sumActiveBulkPurchaseVolumeCents(rows: ReadonlyArray<BulkOpportunityRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let sum = 0
  for (const r of sorted) {
    if (String(r.opportunity_status) !== "active") continue
    sum += Math.max(0, Math.round(Number(r.estimated_total_volume_cents ?? 0)))
  }
  return sum
}

export type PreferredProgramRow = {
  estimated_savings_basis_points: number | null
  minimum_volume_cents: number | null
  program_status: string
  id?: string
}

/**
 * Informational upper-bound opportunity cents: basis_points * min_volume / 10000 per active program.
 * Capped per row to avoid runaway estimates.
 */
export function sumPreferredPricingOpportunityCents(rows: ReadonlyArray<PreferredProgramRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  const PER_ROW_CAP = 50_000_000
  let sum = 0
  for (const r of sorted) {
    if (String(r.program_status) !== "active") continue
    const bps = Math.max(0, Math.round(Number(r.estimated_savings_basis_points ?? 0)))
    const vol = Math.max(0, Math.round(Number(r.minimum_volume_cents ?? 0)))
    const raw = Math.round((vol * bps) / 10_000)
    sum += Math.min(PER_ROW_CAP, raw)
  }
  return sum
}
