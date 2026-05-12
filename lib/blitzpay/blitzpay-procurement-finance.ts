/**
 * BlitzPay Phase 3E — procurement finance helpers (margin signals, aging, reconciliation scoring).
 */

import { buildComplianceAuditImmutableHash } from "@/lib/blitzpay/blitzpay-compliance-audit"
import { hashAccountingSourceReference } from "@/lib/blitzpay/blitzpay-general-ledger"
import { BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP, divTowardZero, totalCostCentsFromQuantityMilli } from "@/lib/blitzpay/blitzpay-inventory-finance"

export type ProcurementMovementLite = {
  movementType: string
  movementDateYmd: string
  totalCostCents: bigint
  quantityMilli: bigint
  metadata?: Record<string, unknown> | null
}

export function hashProcurementAuditPayload(parts: Record<string, unknown>): string {
  return buildComplianceAuditImmutableHash(parts)
}

/** 0–100 where higher means healthier margin proxy (bounded; metadata-driven). */
export function computeInventoryMarginHealthScore0to100(movements: readonly ProcurementMovementLite[], cap = BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP): number {
  const rows = movements.slice(0, cap)
  let revenue = 0n
  let cogs = 0n
  for (const r of rows) {
    if (r.movementType === "invoice_sale") {
      const rc = readOptionalCents(r.metadata, "invoice_line_revenue_cents")
      if (rc != null) revenue += rc > 0n ? rc : 0n
      const tc = r.totalCostCents < 0n ? -r.totalCostCents : r.totalCostCents
      cogs += tc
    }
    if (r.movementType === "work_order_usage") {
      const tc = r.totalCostCents < 0n ? -r.totalCostCents : r.totalCostCents
      cogs += tc
    }
  }
  if (revenue <= 0n) return 50
  const margin = revenue - cogs
  const bps = divTowardZero(margin * 10000n, revenue)
  const x = Number(bps > 10000n ? 10000n : bps < 0n ? 0n : bps)
  return Math.min(100, Math.max(0, Math.round(x / 100)))
}

function readOptionalCents(meta: Record<string, unknown> | null | undefined, key: string): bigint | null {
  if (!meta || typeof meta !== "object") return null
  const v = meta[key]
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.round(v))
  if (typeof v === "string" && v.trim()) {
    try {
      return BigInt(v.trim())
    } catch {
      return null
    }
  }
  return null
}

/** Age of oldest qualifying movement in days (bounded list; YYYY-MM-DD strings). */
export function computeInventoryAgingDaysOldest(movements: readonly ProcurementMovementLite[], todayYmd: string, cap = BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP): number {
  const today = parseYmdToNumber(todayYmd)
  if (today == null) return 0
  let oldest: number | null = null
  let i = 0
  for (const r of movements) {
    if (i++ >= cap) break
    const d = parseYmdToNumber(r.movementDateYmd)
    if (d == null) continue
    if (oldest == null || d < oldest) oldest = d
  }
  if (oldest == null) return 0
  return Math.min(3650, Math.max(0, today - oldest))
}

function parseYmdToNumber(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1]) * 372 + Number(m[2]) * 31 + Number(m[3])
  return Number.isFinite(y) ? y : null
}

/** 0–100 risk-style score from aging (higher = more aging pressure). */
export function inventoryAgingRiskScore0to100(oldestAgeDays: number): number {
  const d = Math.max(0, Math.min(3650, oldestAgeDays))
  return Math.min(100, Math.round(d / 36.5))
}

export function purchaseOrderReconciliationVarianceCents(params: {
  purchaseOrderExpectedCostCents: bigint
  vendorBillLinkedCostCents: bigint
}): bigint {
  return params.vendorBillLinkedCostCents - params.purchaseOrderExpectedCostCents
}

export function inventoryTurnoverScore0to100(params: {
  /** Sum of absolute usage cost in window (cents). */
  usageCostCents: bigint
  /** Inventory value (cents). */
  inventoryValueCents: bigint
}): number {
  const u = params.usageCostCents < 0n ? 0n : params.usageCostCents
  const inv = params.inventoryValueCents < 0n ? 0n : params.inventoryValueCents
  if (inv <= 0n) return 0
  const ratioBps = divTowardZero(u * 10000n, inv)
  const x = Number(ratioBps > 100000n ? 100000n : ratioBps)
  return Math.min(100, Math.max(0, Math.round(x / 1000)))
}

export function procurementTreasuryImpactScore0to100(params: {
  reorderExposureCents: bigint
  operatingCashCents: bigint
}): number {
  const cost = params.reorderExposureCents < 0n ? 0n : params.reorderExposureCents
  const cash = params.operatingCashCents < 0n ? 0n : params.operatingCashCents
  if (cash <= 0n) return cost > 0n ? 100 : 0
  const bps = divTowardZero(cost * 10000n, cash)
  const r = Number(bps > 10000n ? 10000n : bps)
  return Math.min(100, Math.max(0, Math.round(r / 100)))
}

export function exposureFromSerializedAssetsCents(rows: readonly { estimatedCurrentValueCents: bigint; assetStatus: string }[], cap: number): bigint {
  let s = 0n
  let i = 0
  for (const r of rows) {
    if (i++ >= cap) break
    if (r.assetStatus !== "in_stock" && r.assetStatus !== "deployed") continue
    const v = r.estimatedCurrentValueCents < 0n ? 0n : r.estimatedCurrentValueCents
    s += v
  }
  return s
}

export function hashSerializedSerialForStorage(rawSerial: string): string {
  return hashAccountingSourceReference(`serialized_inventory|${rawSerial.trim()}`)
}

export { totalCostCentsFromQuantityMilli }
