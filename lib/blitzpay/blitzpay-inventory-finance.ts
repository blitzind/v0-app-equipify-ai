/**
 * BlitzPay Phase 3E — inventory valuation helpers (integer math; deterministic; bounded).
 */

export const BLITZPAY_INVENTORY_FINANCIAL_ITEM_LIST_CAP = 100
export const BLITZPAY_INVENTORY_MOVEMENT_LIST_CAP = 120
export const BLITZPAY_INVENTORY_SNAPSHOT_LIST_CAP = 31
export const BLITZPAY_VENDOR_REBATE_PROGRAM_LIST_CAP = 80
export const BLITZPAY_VENDOR_REBATE_ACCRUAL_LIST_CAP = 120
export const BLITZPAY_REORDER_FORECAST_LIST_CAP = 100
export const BLITZPAY_SERIALIZED_ASSET_LIST_CAP = 100
export const BLITZPAY_PROCUREMENT_AUDIT_LIST_CAP = 80
export const BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP = 240
export const BLITZPAY_INVENTORY_FIFO_LOT_CAP = 64

/** Quantity precision: thousandths of a unit (matches numeric(24,6) canonical milli layer). */
export const QUANTITY_MILLI_SCALE = 1000n

export type InventoryFifoLot = { quantityMilli: bigint; unitCostCents: bigint }

function clampNonNegativeInt(n: bigint): bigint {
  return n < 0n ? 0n : n
}

/** Truncating division toward zero (bigint). */
export function divTowardZero(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n
  return a / b
}

export function totalCostCentsFromQuantityMilli(quantityMilli: bigint, unitCostCents: bigint): bigint {
  return divTowardZero(quantityMilli * unitCostCents, QUANTITY_MILLI_SCALE)
}

/**
 * FIFO consumption: consumes positive lots in order; returns remaining lots and COGS cents.
 * Deterministic: lots processed in array order.
 */
export function consumeFifoLots(
  lots: readonly InventoryFifoLot[],
  consumeQuantityMilli: bigint,
): { remainingLots: InventoryFifoLot[]; cogsCents: bigint } {
  let remaining = consumeQuantityMilli < 0n ? 0n : consumeQuantityMilli
  let cogs = 0n
  const out: InventoryFifoLot[] = []
  let capped = 0
  for (const lot of lots) {
    if (capped++ > BLITZPAY_INVENTORY_FIFO_LOT_CAP) break
    const q = clampNonNegativeInt(lot.quantityMilli)
    const uc = clampNonNegativeInt(lot.unitCostCents)
    if (remaining <= 0n) {
      if (q > 0n) out.push({ quantityMilli: q, unitCostCents: uc })
      continue
    }
    if (q <= 0n) continue
    const take = q <= remaining ? q : remaining
    cogs += totalCostCentsFromQuantityMilli(take, uc)
    remaining -= take
    const left = q - take
    if (left > 0n) out.push({ quantityMilli: left, unitCostCents: uc })
  }
  return { remainingLots: out, cogsCents: cogs }
}

/** Weighted-average unit cost (cents per whole unit) after inbound receipt (quantities in milli-units). */
export function weightedAverageUnitCostCents(params: {
  onHandQuantityMilli: bigint
  onHandAverageCostCents: bigint | null
  inboundQuantityMilli: bigint
  inboundUnitCostCents: bigint
}): bigint {
  const q0 = clampNonNegativeInt(params.onHandQuantityMilli)
  const c0 = params.onHandAverageCostCents == null ? 0n : clampNonNegativeInt(params.onHandAverageCostCents)
  const q1 = clampNonNegativeInt(params.inboundQuantityMilli)
  const c1 = clampNonNegativeInt(params.inboundUnitCostCents)
  const denom = q0 + q1
  if (denom <= 0n) return c1
  const valueCents = divTowardZero(q0 * c0 + q1 * c1, QUANTITY_MILLI_SCALE)
  return divTowardZero(valueCents * QUANTITY_MILLI_SCALE, denom)
}

export function parseQuantityMilliFromNumericString(raw: string): bigint | null {
  const s = raw.trim()
  if (!s) return null
  const neg = s.startsWith("-")
  const body = neg ? s.slice(1) : s
  const parts = body.split(".")
  if (parts.length > 2) return null
  const whole = parts[0]!.replace(/^0+(?=\d)/, "") || "0"
  const fracRaw = parts[1] ?? ""
  if (!/^\d*$/u.test(whole) || !/^\d*$/u.test(fracRaw)) return null
  const frac = (fracRaw + "000").slice(0, 3)
  if (frac.length !== 3) return null
  try {
    const w = BigInt(whole)
    const f = BigInt(frac)
    const v = w * QUANTITY_MILLI_SCALE + f
    return neg ? -v : v
  } catch {
    return null
  }
}

export function formatQuantityMilliAsNumericString(quantityMilli: bigint): string {
  const neg = quantityMilli < 0n
  const v = neg ? -quantityMilli : quantityMilli
  const whole = v / QUANTITY_MILLI_SCALE
  const frac = v % QUANTITY_MILLI_SCALE
  const fracStr = String(frac).padStart(3, "0").replace(/0+$/u, "")
  const core = fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`
  return neg ? `-${core}` : core
}
