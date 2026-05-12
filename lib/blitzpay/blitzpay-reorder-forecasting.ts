/**
 * BlitzPay Phase 3E — deterministic reorder / velocity forecasting (planning only).
 */

import { BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP, QUANTITY_MILLI_SCALE, divTowardZero } from "@/lib/blitzpay/blitzpay-inventory-finance"

export type MovementSample = {
  movementDateYmd: string
  quantityMilli: bigint
  movementType: string
}

function ymdToEpochDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = Date.UTC(y, mo - 1, d)
  if (!Number.isFinite(t)) return null
  return Math.floor(t / 86400000)
}

/** Milli-units consumed per calendar day (trunc toward zero), from bounded recent movements. */
export function computeUsageVelocityMilliPerDay(movements: readonly MovementSample[], cap = BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP): number {
  const rows = movements.slice(0, cap)
  let usageMilli = 0n
  let minDay: number | null = null
  let maxDay: number | null = null
  for (const r of rows) {
    const day = ymdToEpochDay(r.movementDateYmd)
    if (day == null) continue
    if (minDay == null || day < minDay) minDay = day
    if (maxDay == null || day > maxDay) maxDay = day
    const q = r.quantityMilli
    if (r.movementType === "work_order_usage" || r.movementType === "invoice_sale" || r.movementType === "writeoff") {
      if (q < 0n) usageMilli += -q
      else usageMilli += q
    }
  }
  if (minDay == null || maxDay == null) return 0
  const span = Math.max(1, maxDay - minDay + 1)
  const v = divTowardZero(usageMilli * QUANTITY_MILLI_SCALE, BigInt(span) * QUANTITY_MILLI_SCALE)
  const n = Number(v > 2147483647n ? 2147483647n : v < -2147483648n ? -2147483648n : v)
  return Number.isFinite(n) ? n : 0
}

export function forecastConfidenceFromSampleCount(sampleCount: number): number {
  const n = Math.max(0, Math.min(100, sampleCount))
  return Math.min(100, n * 10)
}

export function treasuryImpactScoreFromReorderCents(params: {
  projectedReorderCostCents: bigint
  operatingCashCents: bigint
}): number {
  const cost = params.projectedReorderCostCents < 0n ? 0n : params.projectedReorderCostCents
  const cash = params.operatingCashCents < 0n ? 0n : params.operatingCashCents
  if (cash <= 0n) return cost > 0n ? 100 : 0
  const ratioBps = divTowardZero(cost * 10000n, cash)
  const r = Number(ratioBps > 10000n ? 10000n : ratioBps)
  return Math.min(100, Math.max(0, Math.round(r / 100)))
}

export function projectedReorderDateYmd(params: {
  todayYmd: string
  onHandQuantityMilli: bigint
  safetyStockMilli: bigint
  velocityMilliPerDay: number
  leadTimeDays: number
}): string | null {
  const today = ymdToEpochDay(params.todayYmd)
  if (today == null) return null
  const v = Math.max(0, params.velocityMilliPerDay)
  if (v === 0) return null
  const oh = params.onHandQuantityMilli < 0n ? 0n : params.onHandQuantityMilli
  const safety = params.safetyStockMilli < 0n ? 0n : params.safetyStockMilli
  if (oh <= safety) {
    const lead = Math.max(0, Math.min(3650, Math.round(params.leadTimeDays)))
    return epochDayToYmd(today + lead)
  }
  const excess = oh - safety
  const vBig = BigInt(Math.max(0, Math.min(1_000_000_000, v)))
  if (vBig === 0n) return null
  const daysToDeplete = Number(divTowardZero(excess, vBig))
  const capped = Math.min(3650, Math.max(0, daysToDeplete))
  const lead = Math.max(0, Math.min(3650, Math.round(params.leadTimeDays)))
  return epochDayToYmd(today + capped + lead)
}

function epochDayToYmd(epochDay: number): string {
  const t = epochDay * 86400000
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function sortForecastsDeterministic<T extends { id: string; projectedReorderDate: string | null; inventoryFinancialItemId: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ad = a.projectedReorderDate ?? "9999-12-31"
    const bd = b.projectedReorderDate ?? "9999-12-31"
    if (ad !== bd) return ad.localeCompare(bd)
    return a.inventoryFinancialItemId.localeCompare(b.inventoryFinancialItemId)
  })
}
