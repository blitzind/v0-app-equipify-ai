/**
 * BlitzPay Phase 3E — procurement & inventory finance (deterministic helpers + static guards).
 * Run: pnpm test:blitzpay-phase-3e-procurement-finance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildComplianceAuditImmutableHash } from "../lib/blitzpay/blitzpay-compliance-audit"
import {
  BLITZPAY_INVENTORY_FINANCIAL_ITEM_LIST_CAP,
  BLITZPAY_INVENTORY_MOVEMENT_LIST_CAP,
  consumeFifoLots,
  formatQuantityMilliAsNumericString,
  parseQuantityMilliFromNumericString,
  totalCostCentsFromQuantityMilli,
  weightedAverageUnitCostCents,
} from "../lib/blitzpay/blitzpay-inventory-finance"
import {
  computeInventoryAgingDaysOldest,
  computeInventoryMarginHealthScore0to100,
  hashProcurementAuditPayload,
  inventoryAgingRiskScore0to100,
  procurementTreasuryImpactScore0to100,
  purchaseOrderReconciliationVarianceCents,
} from "../lib/blitzpay/blitzpay-procurement-finance"
import {
  computeUsageVelocityMilliPerDay,
  sortForecastsDeterministic,
  treasuryImpactScoreFromReorderCents,
} from "../lib/blitzpay/blitzpay-reorder-forecasting"
import { estimateRebateAccrualCents } from "../lib/blitzpay/blitzpay-vendor-rebates"
import { hashSerializedSerialForStorage } from "../lib/blitzpay/blitzpay-procurement-finance"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

// --- FIFO ---
const fifo = consumeFifoLots(
  [
    { quantityMilli: 2000n, unitCostCents: 100n },
    { quantityMilli: 1000n, unitCostCents: 200n },
  ],
  2500n,
)
assert.equal(fifo.remainingLots.length, 1)
assert.equal(fifo.cogsCents, 300n)

// --- Weighted average (milli quantities) ---
const wa = weightedAverageUnitCostCents({
  onHandQuantityMilli: 1000n,
  onHandAverageCostCents: 100n,
  inboundQuantityMilli: 1000n,
  inboundUnitCostCents: 300n,
})
assert.equal(wa, 200n)

// --- Quantity round-trip ---
assert.equal(parseQuantityMilliFromNumericString("1.500"), 1500n)
assert.equal(formatQuantityMilliAsNumericString(1500n), "1.5")

// --- Reorder velocity & ordering ---
const vel = computeUsageVelocityMilliPerDay([
  { movementDateYmd: "2026-01-01", quantityMilli: -3000n, movementType: "work_order_usage" },
  { movementDateYmd: "2026-01-03", quantityMilli: -3000n, movementType: "work_order_usage" },
])
assert.ok(vel >= 0)
const sorted = sortForecastsDeterministic([
  { id: "a", projectedReorderDate: "2026-02-01", inventoryFinancialItemId: "b" },
  { id: "b", projectedReorderDate: "2026-01-01", inventoryFinancialItemId: "a" },
])
assert.equal(sorted[0]?.id, "b")

// --- Treasury impact ---
assert.equal(treasuryImpactScoreFromReorderCents({ projectedReorderCostCents: 50_000n, operatingCashCents: 100_000n }), 50)
assert.equal(procurementTreasuryImpactScore0to100({ reorderExposureCents: 10_000n, operatingCashCents: 50_000n }), 20)

// --- Aging ---
const agingDays = computeInventoryAgingDaysOldest(
  [{ movementType: "purchase", movementDateYmd: "2026-01-01", totalCostCents: 0n, quantityMilli: 0n }],
  "2026-01-11",
)
assert.equal(agingDays, 10)
assert.equal(inventoryAgingRiskScore0to100(3650), 100)

// --- Rebate accrual ---
assert.equal(estimateRebateAccrualCents({ rebateType: "percentage", rebateBasisPoints: 500, basisAmountCents: 10_000n, rebateThresholdCents: 0n }), 500n)
assert.equal(estimateRebateAccrualCents({ rebateType: "fixed", rebateBasisPoints: 250, basisAmountCents: 1000n, rebateThresholdCents: 0n }), 250n)

// --- Margin health ---
const mh = computeInventoryMarginHealthScore0to100([
  {
    movementType: "invoice_sale",
    movementDateYmd: "2026-05-01",
    totalCostCents: 400n,
    quantityMilli: 0n,
    metadata: { invoice_line_revenue_cents: 1000 },
  },
])
assert.ok(mh > 50)

// --- Reconciliation ---
assert.equal(purchaseOrderReconciliationVarianceCents({ purchaseOrderExpectedCostCents: 1000n, vendorBillLinkedCostCents: 950n }), -50n)

// --- Serialized hash (stable for same input) ---
const h1 = hashSerializedSerialForStorage("SN-12345")
const h2 = hashSerializedSerialForStorage("SN-12345")
assert.equal(h1, h2)
assert.ok(!h1.includes("SN"))

// --- Audit hash ---
const ph = hashProcurementAuditPayload({ a: 1, z: 2, summary: "proc" })
assert.equal(ph, buildComplianceAuditImmutableHash({ z: 2, a: 1, summary: "proc" }))

// --- Total cost ---
assert.equal(totalCostCentsFromQuantityMilli(2500n, 400n), 1000n)

// --- Caps exported ---
assert.ok(BLITZPAY_INVENTORY_FINANCIAL_ITEM_LIST_CAP > 0)
assert.ok(BLITZPAY_INVENTORY_MOVEMENT_LIST_CAP > 0)

// --- Migration append-only audit ---
const mig = readUtf8("supabase/migrations/20261015120000_blitzpay_phase_3e_procurement_inventory_finance.sql")
assert.match(mig, /blitzpay_procurement_audit_block_mutation/)
assert.match(mig, /blitzpay_inventory_financial_items/)

// --- API gates ---
for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/procurement/inventory-items/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/inventory-movements/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/valuation/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/reorder-forecasts/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/vendor-rebates/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/serialized-assets/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/procurement/health/route.ts",
]) {
  const src = readUtf8(rel)
  assert.match(src, /requireAnyOrgPermission/)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
}

// --- Schema health lists new tables ---
const schemaSrc = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
assert.match(schemaSrc, /blitzpay_inventory_financial_items/)
assert.match(schemaSrc, /blitzpay_procurement_audit_log/)

console.log("blitzpay phase 3e procurement finance tests passed")
