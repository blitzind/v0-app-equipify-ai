/** Protection plan exposure — operational tracking math only (integer cents). */

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

export type ProtectionPlanRow = {
  id?: string
  plan_status: string
  monthly_price_cents?: number | string | null
  estimated_exposure_cents?: number | string | null
}

export function sumActiveMonthlyPriceCents(rows: ReadonlyArray<ProtectionPlanRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let s = 0
  for (const r of sorted) {
    if (String(r.plan_status) !== "active") continue
    s += Math.max(0, Math.round(Number(r.monthly_price_cents ?? 0)))
  }
  return s
}

/** Annualized recurring proxy: 12 × sum of active monthly prices (bounded per-row in callers). */
export function protectionPlanAnnualizedRecurringCents(rows: ReadonlyArray<ProtectionPlanRow>): number {
  return Math.min(500_000_000, sumActiveMonthlyPriceCents(rows) * 12)
}

export function sumActiveEstimatedExposureCents(rows: ReadonlyArray<ProtectionPlanRow>): number {
  const sorted = [...rows].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  let s = 0
  for (const r of sorted) {
    if (String(r.plan_status) !== "active") continue
    s += Math.max(0, Math.round(Number(r.estimated_exposure_cents ?? 0)))
  }
  return Math.min(500_000_000, s)
}

/** 0–100 “coverage rate” from active plan count (cap at 12 plans for scale). */
export function protectionPlanCoverageRate0to100(activePlanCount: number): number {
  return clampInt(activePlanCount * 9, 0, 100)
}
