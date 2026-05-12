/** Pure warranty reserve math — integer cents / deterministic scores only. */

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/** Basis points 0–10000 from balance vs projected exposure (higher = more utilized). */
export function reserveUtilizationBasisPoints(balanceCents: number, projectedExposureCents: number | null): number | null {
  const b = Math.max(0, Math.round(balanceCents))
  const p = projectedExposureCents == null ? null : Math.max(0, Math.round(projectedExposureCents))
  if (p == null || p === 0) return b > 0 ? 0 : null
  return clampInt(Math.round((b * 10_000) / p), 0, 10_000)
}

export function reserveUtilizationScore0to100(balanceCents: number, projectedExposureCents: number | null): number {
  const bps = reserveUtilizationBasisPoints(balanceCents, projectedExposureCents)
  if (bps == null) return 0
  return clampInt(Math.round(bps / 100), 0, 100)
}

export type WarrantyReserveRow = {
  id?: string
  reserve_status: string
  reserve_balance_cents: number | string
  projected_exposure_cents?: number | string | null
}

export function sumActiveReserveBalanceCents(rows: ReadonlyArray<WarrantyReserveRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let s = 0
  for (const r of sorted) {
    if (String(r.reserve_status) !== "active") continue
    s += Math.max(0, Math.round(Number(r.reserve_balance_cents ?? 0)))
  }
  return s
}

export function sumActiveProjectedExposureCents(rows: ReadonlyArray<WarrantyReserveRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let s = 0
  for (const r of sorted) {
    if (String(r.reserve_status) !== "active") continue
    const p = r.projected_exposure_cents
    if (p == null) continue
    s += Math.max(0, Math.round(Number(p)))
  }
  return s
}

/** Upper-bound “warranty reserve exposure” cents: prefer summed projected exposure when present, else balances. */
export function warrantyReserveExposureCents(rows: ReadonlyArray<WarrantyReserveRow>): number {
  const exp = sumActiveProjectedExposureCents(rows)
  if (exp > 0) return exp
  return sumActiveReserveBalanceCents(rows)
}

/** Coverage score 0–100: reserves vs open claims exposure (deterministic). */
export function claimsReserveCoverageScore0to100(reserveCents: number, openClaimsExposureCents: number): number {
  const r = Math.max(0, Math.round(reserveCents))
  const c = Math.max(0, Math.round(openClaimsExposureCents))
  if (c === 0) return r > 0 ? 100 : 0
  return clampInt(Math.round((r * 100) / c), 0, 100)
}

/** 0–100 advisory: higher when projected exposure exceeds tracked balance (no auto-posting). */
export function reserveReplenishmentIndicator0to100(balanceCents: number, projectedExposureCents: number | null): number {
  const b = Math.max(0, Math.round(balanceCents))
  const p = projectedExposureCents == null ? null : Math.max(0, Math.round(projectedExposureCents))
  if (p == null || p === 0) return 0
  const gap = p - b
  if (gap <= 0) return 0
  return clampInt(Math.round((gap * 100) / p), 0, 100)
}
