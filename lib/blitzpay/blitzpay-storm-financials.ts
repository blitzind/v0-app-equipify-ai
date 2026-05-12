/** Storm-event financial orchestration — forecasting scores only (no automation). */

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

export type StormEventRow = {
  id?: string
  event_status: string
  estimated_claim_exposure_cents?: number | string | null
  estimated_treasury_pressure?: number | string | null
  estimated_response_cost_cents?: number | string | null
}

const ACTIVE_STORM = new Set(["active", "monitoring"])

export function maxStormTreasuryPressure0to100(rows: ReadonlyArray<StormEventRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let m = 0
  for (const r of sorted) {
    if (!ACTIVE_STORM.has(String(r.event_status))) continue
    const p = r.estimated_treasury_pressure == null ? 0 : clampInt(Number(r.estimated_treasury_pressure), 0, 100)
    m = Math.max(m, p)
  }
  return m
}

export function sumStormClaimExposureCents(rows: ReadonlyArray<StormEventRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let s = 0
  for (const r of sorted) {
    if (!ACTIVE_STORM.has(String(r.event_status))) continue
    s += Math.max(0, Math.round(Number(r.estimated_claim_exposure_cents ?? 0)))
  }
  return Math.min(500_000_000, s)
}
