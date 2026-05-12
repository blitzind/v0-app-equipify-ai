import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildComplianceAuditImmutableHash } from "@/lib/blitzpay/blitzpay-compliance-audit"
import { ensureBlitzpayDefaultChartOfAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { BLITZPAY_INVENTORY_COA_EXTENSION, normalBalanceForAccountType } from "@/lib/blitzpay/blitzpay-general-ledger"
import {
  BLITZPAY_INVENTORY_FINANCIAL_ITEM_LIST_CAP,
  BLITZPAY_INVENTORY_MOVEMENT_LIST_CAP,
  BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP,
  BLITZPAY_PROCUREMENT_AUDIT_LIST_CAP,
  BLITZPAY_REORDER_FORECAST_LIST_CAP,
  BLITZPAY_SERIALIZED_ASSET_LIST_CAP,
  BLITZPAY_VENDOR_REBATE_PROGRAM_LIST_CAP,
  formatQuantityMilliAsNumericString,
  parseQuantityMilliFromNumericString,
  totalCostCentsFromQuantityMilli,
  weightedAverageUnitCostCents,
} from "@/lib/blitzpay/blitzpay-inventory-finance"
import {
  computeUsageVelocityMilliPerDay,
  forecastConfidenceFromSampleCount,
  projectedReorderDateYmd,
  treasuryImpactScoreFromReorderCents,
  type MovementSample,
} from "@/lib/blitzpay/blitzpay-reorder-forecasting"
import {
  computeInventoryAgingDaysOldest,
  computeInventoryMarginHealthScore0to100,
  exposureFromSerializedAssetsCents,
  inventoryAgingRiskScore0to100,
  inventoryTurnoverScore0to100,
  procurementTreasuryImpactScore0to100,
  type ProcurementMovementLite,
} from "@/lib/blitzpay/blitzpay-procurement-finance"
import { estimateRebateAccrualCents, sumEstimatedAnnualRebateCents } from "@/lib/blitzpay/blitzpay-vendor-rebates"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BlitzpayProcurementReportingFields = {
  totalInventoryValueCents: number
  inventoryWriteoffExposure: number
  inventoryTurnoverScore: number
  reorderExposureCents: number
  rebateOpportunityCents: number
  serializedAssetExposure: number
  procurementTreasuryImpactScore: number
  inventoryMarginHealthScore: number
}

export async function ensureBlitzpayDefaultInventoryAccounts(admin: SupabaseClient, organizationId: string): Promise<{ created: number }> {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  let created = 0
  for (const row of BLITZPAY_INVENTORY_COA_EXTENSION) {
    const normal = normalBalanceForAccountType(row.type)
    const { data: existing } = await admin
      .from("blitzpay_chart_of_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("account_code", row.code)
      .maybeSingle()
    if (existing) continue
    const { error } = await admin.from("blitzpay_chart_of_accounts").insert({
      organization_id: organizationId,
      account_code: row.code,
      account_name: row.name,
      account_type: row.type,
      parent_account_id: null,
      is_system_account: true,
      is_active: true,
      normal_balance: normal,
      reporting_category: "system_seed_phase_3e",
      currency: "usd",
      metadata: { seed: "blitzpay_phase_3e_inventory" },
    })
    if (error) throw new Error(error.message)
    created += 1
  }
  return { created }
}

export async function insertProcurementAuditEntry(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    auditType: string
    actorType: "system" | "admin" | "user"
    actorId?: string | null
    relatedEntityType?: string | null
    relatedEntityId?: string | null
    auditSummary: string
    metadata?: Record<string, unknown>
  },
): Promise<{ id: string; immutableHash: string }> {
  assertUuid(organizationId, "organizationId")
  const meta = input.metadata ?? {}
  const hashPayload: Record<string, unknown> = {
    organization_id: organizationId,
    audit_type: input.auditType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    audit_summary: input.auditSummary,
    metadata: meta,
    at: new Date().toISOString().slice(0, 19),
  }
  const immutableHash = buildComplianceAuditImmutableHash(hashPayload)
  const { data, error } = await admin
    .from("blitzpay_procurement_audit_log")
    .insert({
      organization_id: organizationId,
      audit_type: input.auditType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      audit_summary: input.auditSummary,
      immutable_hash: immutableHash,
      metadata: meta,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id, immutableHash }
}

function toBigIntCents(v: unknown): bigint {
  if (typeof v === "bigint") return v
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.round(v))
  if (typeof v === "string" && v.trim()) {
    try {
      return BigInt(v.trim())
    } catch {
      return 0n
    }
  }
  return 0n
}

function numericStringFromDb(v: unknown): string {
  if (v == null) return "0"
  return String(v).trim() || "0"
}

export async function listInventoryFinancialItems(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_inventory_financial_items")
    .select(
      "id, organization_id, inventory_item_id, sku, item_name, item_status, valuation_method, unit_cost_cents, average_cost_cents, replacement_cost_cents, inventory_asset_account_id, cogs_account_id, revenue_account_id, serialized_tracking_enabled, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("item_name", { ascending: true })
    .limit(BLITZPAY_INVENTORY_FINANCIAL_ITEM_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInventoryFinancialItem(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    itemName: string
    sku?: string | null
    inventoryItemId?: string | null
    valuationMethod?: string
    unitCostCents?: number
    averageCostCents?: number | null
    replacementCostCents?: number | null
    serializedTrackingEnabled?: boolean
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultInventoryAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_inventory_financial_items")
    .insert({
      organization_id: organizationId,
      inventory_item_id: input.inventoryItemId?.trim() || null,
      sku: input.sku?.trim() || null,
      item_name: String(input.itemName || "").trim() || "Inventory item",
      valuation_method: input.valuationMethod ?? "weighted_average",
      unit_cost_cents: Math.max(0, Math.round(Number(input.unitCostCents ?? 0))),
      average_cost_cents: input.averageCostCents == null ? null : Math.max(0, Math.round(Number(input.averageCostCents))),
      replacement_cost_cents: input.replacementCostCents == null ? null : Math.max(0, Math.round(Number(input.replacementCostCents))),
      serialized_tracking_enabled: Boolean(input.serializedTrackingEnabled),
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await admin.from("blitzpay_reorder_forecasts").upsert(
    {
      organization_id: organizationId,
      inventory_financial_item_id: id,
      forecast_status: "active",
      projected_reorder_date: null,
      projected_reorder_quantity: null,
      projected_reorder_cost_cents: null,
      forecast_confidence_score: null,
      treasury_impact_score: null,
      usage_velocity: null,
      lead_time_days: 14,
      metadata: {},
    },
    { onConflict: "organization_id,inventory_financial_item_id" },
  )
  await insertProcurementAuditEntry(admin, organizationId, {
    auditType: "manual_override",
    actorType: input.actorUserId ? "user" : "system",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "inventory_financial_item",
    relatedEntityId: id,
    auditSummary: "Inventory financial item created",
    metadata: { inventory_financial_item_id: id },
  })
  return { id }
}

export async function listInventoryFinancialMovements(admin: SupabaseClient, organizationId: string, itemId?: string | null) {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_inventory_financial_movements")
    .select(
      "id, organization_id, inventory_financial_item_id, movement_type, quantity_delta, unit_cost_cents, total_cost_cents, linked_vendor_bill_id, linked_work_order_id, linked_invoice_id, linked_purchase_order_id, movement_date, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_INVENTORY_MOVEMENT_LIST_CAP)
  if (itemId && UUID_RE.test(itemId)) q = q.eq("inventory_financial_item_id", itemId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInventoryFinancialMovement(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    inventoryFinancialItemId: string
    movementType: string
    quantityMilli: bigint
    unitCostCents: number
    movementDateYmd: string
    linkedVendorBillId?: string | null
    linkedWorkOrderId?: string | null
    linkedInvoiceId?: string | null
    linkedPurchaseOrderId?: string | null
    metadata?: Record<string, unknown>
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  if (!UUID_RE.test(input.inventoryFinancialItemId)) throw new Error("invalid_item")
  await ensureBlitzpayDefaultInventoryAccounts(admin, organizationId)
  const unit = BigInt(Math.max(0, Math.round(Number(input.unitCostCents))))
  const qtyStr = formatQuantityMilliAsNumericString(input.quantityMilli)
  const total = totalCostCentsFromQuantityMilli(input.quantityMilli, unit)
  const { data, error } = await admin
    .from("blitzpay_inventory_financial_movements")
    .insert({
      organization_id: organizationId,
      inventory_financial_item_id: input.inventoryFinancialItemId,
      movement_type: input.movementType,
      quantity_delta: qtyStr,
      unit_cost_cents: Number(unit),
      total_cost_cents: Number(total),
      linked_vendor_bill_id: input.linkedVendorBillId && UUID_RE.test(input.linkedVendorBillId) ? input.linkedVendorBillId : null,
      linked_work_order_id: input.linkedWorkOrderId && UUID_RE.test(input.linkedWorkOrderId) ? input.linkedWorkOrderId : null,
      linked_invoice_id: input.linkedInvoiceId && UUID_RE.test(input.linkedInvoiceId) ? input.linkedInvoiceId : null,
      linked_purchase_order_id:
        input.linkedPurchaseOrderId && UUID_RE.test(input.linkedPurchaseOrderId) ? input.linkedPurchaseOrderId : null,
      movement_date: input.movementDateYmd,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id

  if (input.movementType === "purchase" && input.quantityMilli > 0n) {
    const { data: itemRow, error: iErr } = await admin
      .from("blitzpay_inventory_financial_items")
      .select("valuation_method, average_cost_cents, metadata")
      .eq("organization_id", organizationId)
      .eq("id", input.inventoryFinancialItemId)
      .maybeSingle()
    if (!iErr && itemRow && (itemRow as { valuation_method: string }).valuation_method === "weighted_average") {
      const meta = ((itemRow as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>
      const onHandMilli = toBigIntCents(meta.on_hand_quantity_milli)
      const newAvg = weightedAverageUnitCostCents({
        onHandQuantityMilli: onHandMilli,
        onHandAverageCostCents:
          (itemRow as { average_cost_cents?: number | null }).average_cost_cents == null
            ? null
            : BigInt(Math.round(Number((itemRow as { average_cost_cents?: number | null }).average_cost_cents))),
        inboundQuantityMilli: input.quantityMilli,
        inboundUnitCostCents: unit,
      })
      const nextOnHand = onHandMilli + input.quantityMilli
      await admin
        .from("blitzpay_inventory_financial_items")
        .update({
          average_cost_cents: Number(newAvg),
          metadata: { ...meta, on_hand_quantity_milli: nextOnHand.toString() },
        })
        .eq("id", input.inventoryFinancialItemId)
        .eq("organization_id", organizationId)
    }
  }

  await insertProcurementAuditEntry(admin, organizationId, {
    auditType: "inventory_reconciled",
    actorType: input.actorUserId ? "user" : "system",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "inventory_financial_movement",
    relatedEntityId: id,
    auditSummary: `Inventory movement recorded (${input.movementType})`,
    metadata: { movement_id: id, item_id: input.inventoryFinancialItemId },
  })

  await refreshReorderForecastForItem(admin, organizationId, input.inventoryFinancialItemId)
  return { id }
}

async function refreshReorderForecastForItem(admin: SupabaseClient, organizationId: string, itemId: string) {
  const { data: movs, error } = await admin
    .from("blitzpay_inventory_financial_movements")
    .select("movement_type, movement_date, quantity_delta")
    .eq("organization_id", organizationId)
    .eq("inventory_financial_item_id", itemId)
    .order("movement_date", { ascending: false })
    .limit(BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP)
  if (error) throw new Error(error.message)
  const samples: MovementSample[] = (movs ?? []).map((r) => ({
    movementType: String((r as { movement_type: string }).movement_type),
    movementDateYmd: String((r as { movement_date: string }).movement_date).slice(0, 10),
    quantityMilli: parseQuantityMilliFromNumericString(numericStringFromDb((r as { quantity_delta: unknown }).quantity_delta)) ?? 0n,
  }))
  const velocity = computeUsageVelocityMilliPerDay(samples)
  const confidence = forecastConfidenceFromSampleCount(samples.length)

  const { data: item } = await admin
    .from("blitzpay_inventory_financial_items")
    .select("replacement_cost_cents, unit_cost_cents, metadata")
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle()
  const rep = (item as { replacement_cost_cents?: number | null; unit_cost_cents?: number } | null)?.replacement_cost_cents
  const uc = (item as { unit_cost_cents?: number } | null)?.unit_cost_cents ?? 0
  const unitCost = BigInt(Math.max(0, Math.round(Number(rep ?? uc))))
  const meta = ((item as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>
  const leadRaw = meta.lead_time_days
  const leadTimeDays =
    typeof leadRaw === "number" && Number.isFinite(leadRaw) ? Math.max(0, Math.min(3650, Math.round(leadRaw))) : 14
  const safetyRaw = meta.safety_stock_milli
  const safetyMilli =
    typeof safetyRaw === "string"
      ? parseQuantityMilliFromNumericString(safetyRaw) ?? 0n
      : typeof safetyRaw === "number" && Number.isFinite(safetyRaw)
        ? BigInt(Math.round(safetyRaw))
        : 0n
  const onHandMilli = toBigIntCents(meta.on_hand_quantity_milli)

  const todayYmd = new Date().toISOString().slice(0, 10)
  const projDate = projectedReorderDateYmd({
    todayYmd,
    onHandQuantityMilli: onHandMilli,
    safetyStockMilli: safetyMilli,
    velocityMilliPerDay: velocity,
    leadTimeDays,
  })
  const thirtyDayMilli = BigInt(Math.max(0, Math.min(1_000_000_000, velocity))) * 30n
  const projCost = totalCostCentsFromQuantityMilli(thirtyDayMilli, unitCost)
  const treas = treasuryImpactScoreFromReorderCents({ projectedReorderCostCents: projCost, operatingCashCents: 0n })

  await admin.from("blitzpay_reorder_forecasts").upsert(
    {
      organization_id: organizationId,
      inventory_financial_item_id: itemId,
      forecast_status: "active",
      projected_reorder_date: projDate,
      projected_reorder_quantity: formatQuantityMilliAsNumericString(thirtyDayMilli),
      projected_reorder_cost_cents: Number(projCost),
      forecast_confidence_score: confidence,
      treasury_impact_score: treas,
      usage_velocity: velocity,
      lead_time_days: leadTimeDays,
      metadata: { refreshed_at: todayYmd },
    },
    { onConflict: "organization_id,inventory_financial_item_id" },
  )

  await insertProcurementAuditEntry(admin, organizationId, {
    auditType: "reorder_forecast_updated",
    actorType: "system",
    auditSummary: "Reorder forecast refreshed from movement history",
    metadata: { inventory_financial_item_id: itemId },
  })
}

export async function fetchValuationOverview(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data: snap } = await admin
    .from("blitzpay_inventory_valuation_snapshots")
    .select(
      "id, snapshot_date, total_inventory_value_cents, total_serialized_asset_value_cents, total_writeoff_exposure_cents, total_reorder_exposure_cents, inventory_health_score, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const items = await listInventoryFinancialItems(admin, organizationId)
  let liveValue = 0n
  for (const row of items as Array<{ metadata?: Record<string, unknown> | null; unit_cost_cents?: number | string }>) {
    const meta = row.metadata ?? {}
    const qm = toBigIntCents(meta.on_hand_quantity_milli)
    const uc = BigInt(Math.max(0, Math.round(Number(row.unit_cost_cents ?? 0))))
    liveValue += totalCostCentsFromQuantityMilli(qm, uc)
  }

  return {
    latestSnapshot: snap ?? null,
    liveInventoryValueCents: Number(liveValue > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : liveValue),
    trackedItems: items.length,
  }
}

export async function listReorderForecasts(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_reorder_forecasts")
    .select(
      "id, organization_id, inventory_financial_item_id, forecast_status, projected_reorder_date, projected_reorder_quantity, projected_reorder_cost_cents, forecast_confidence_score, treasury_impact_score, usage_velocity, lead_time_days, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("projected_reorder_date", { ascending: true, nullsFirst: false })
    .limit(BLITZPAY_REORDER_FORECAST_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listVendorRebatePrograms(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_vendor_rebate_programs")
    .select(
      "id, organization_id, vendor_id, program_name, rebate_status, rebate_type, rebate_basis_points, rebate_threshold_cents, estimated_annual_rebate_cents, effective_start_date, effective_end_date, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("program_name", { ascending: true })
    .limit(BLITZPAY_VENDOR_REBATE_PROGRAM_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createVendorRebateProgram(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    vendorId: string
    programName: string
    rebateType?: string
    rebateStatus?: string
    rebateBasisPoints?: number | null
    rebateThresholdCents?: number | null
    estimatedAnnualRebateCents?: number | null
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  if (!UUID_RE.test(input.vendorId)) throw new Error("invalid_vendor")
  await ensureBlitzpayDefaultInventoryAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_vendor_rebate_programs")
    .insert({
      organization_id: organizationId,
      vendor_id: input.vendorId,
      program_name: String(input.programName || "").trim() || "Rebate program",
      rebate_status: input.rebateStatus ?? "active",
      rebate_type: input.rebateType ?? "percentage",
      rebate_basis_points: input.rebateBasisPoints ?? null,
      rebate_threshold_cents: input.rebateThresholdCents ?? null,
      estimated_annual_rebate_cents: input.estimatedAnnualRebateCents ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertProcurementAuditEntry(admin, organizationId, {
    auditType: "procurement_review",
    actorType: input.actorUserId ? "user" : "system",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "vendor_rebate_program",
    relatedEntityId: id,
    auditSummary: "Vendor rebate program recorded",
    metadata: { vendor_rebate_program_id: id },
  })
  return { id }
}

export async function createVendorRebateAccrual(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    vendorRebateProgramId: string
    accruedAmountCents: number
    accrualDateYmd: string
    accrualStatus?: string
    linkedVendorBillId?: string | null
    basisAmountCents?: number
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  if (!UUID_RE.test(input.vendorRebateProgramId)) throw new Error("invalid_program")
  const { data: prog, error: pErr } = await admin
    .from("blitzpay_vendor_rebate_programs")
    .select("id, rebate_type, rebate_basis_points, rebate_threshold_cents")
    .eq("organization_id", organizationId)
    .eq("id", input.vendorRebateProgramId)
    .maybeSingle()
  if (pErr) throw new Error(pErr.message)
  if (!prog) throw new Error("program_not_found")
  const basis = BigInt(Math.max(0, Math.round(Number(input.basisAmountCents ?? input.accruedAmountCents))))
  const est = estimateRebateAccrualCents({
    rebateType: (prog as { rebate_type: "percentage" }).rebate_type,
    rebateBasisPoints: (prog as { rebate_basis_points: number | null }).rebate_basis_points,
    basisAmountCents: basis,
    rebateThresholdCents:
      (prog as { rebate_threshold_cents: number | string | null }).rebate_threshold_cents == null
        ? null
        : BigInt(Math.max(0, Math.round(Number((prog as { rebate_threshold_cents: number | null }).rebate_threshold_cents)))),
  })
  const amount = Number(est > 0n ? est : BigInt(Math.max(0, Math.round(Number(input.accruedAmountCents)))))
  const { data, error } = await admin
    .from("blitzpay_vendor_rebate_accruals")
    .insert({
      organization_id: organizationId,
      vendor_rebate_program_id: input.vendorRebateProgramId,
      accrual_status: input.accrualStatus ?? "estimated",
      accrued_amount_cents: amount,
      linked_vendor_bill_id: input.linkedVendorBillId && UUID_RE.test(input.linkedVendorBillId) ? input.linkedVendorBillId : null,
      accrual_date: input.accrualDateYmd,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertProcurementAuditEntry(admin, organizationId, {
    auditType: "rebate_accrued",
    actorType: input.actorUserId ? "user" : "system",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "vendor_rebate_accrual",
    relatedEntityId: id,
    auditSummary: "Vendor rebate accrual recorded",
    metadata: { vendor_rebate_accrual_id: id },
  })
  return { id, accruedAmountCents: amount }
}

export async function listSerializedAssetFinancials(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_serialized_asset_financials")
    .select(
      "id, organization_id, inventory_financial_item_id, serial_number_hash, acquisition_cost_cents, estimated_current_value_cents, depreciation_cents, linked_equipment_id, linked_work_order_id, asset_status, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_SERIALIZED_ASSET_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchProcurementHealthDashboard(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const reporting = await fetchProcurementReportingFields(admin, organizationId)
  const { data: audits, error: aErr } = await admin
    .from("blitzpay_procurement_audit_log")
    .select("id, audit_type, actor_type, audit_summary, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_PROCUREMENT_AUDIT_LIST_CAP)
  if (aErr) throw new Error(aErr.message)
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Forecasting and valuation tools are operational estimates and may differ from finalized accounting or inventory counts.",
    pipeline: {
      trackedInventorySignals: reporting.totalInventoryValueCents >= 0 ? 1 : 0,
      reorderExposureCents: reporting.reorderExposureCents,
      rebateOpportunityCents: reporting.rebateOpportunityCents,
    },
    reporting,
    recentAudit: audits ?? [],
  }
}

export async function fetchProcurementReportingFields(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayProcurementReportingFields> {
  assertUuid(organizationId, "organizationId")
  const { data: snap } = await admin
    .from("blitzpay_inventory_valuation_snapshots")
    .select(
      "total_inventory_value_cents, total_writeoff_exposure_cents, total_reorder_exposure_cents, inventory_health_score",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const items = await listInventoryFinancialItems(admin, organizationId)
  let inventoryValue = 0n
  for (const row of items as Array<{ metadata?: Record<string, unknown> | null; unit_cost_cents?: number | string }>) {
    const meta = row.metadata ?? {}
    const qm = toBigIntCents(meta.on_hand_quantity_milli)
    const uc = BigInt(Math.max(0, Math.round(Number(row.unit_cost_cents ?? 0))))
    inventoryValue += totalCostCentsFromQuantityMilli(qm, uc)
  }

  const { data: movRows } = await admin
    .from("blitzpay_inventory_financial_movements")
    .select("movement_type, movement_date, total_cost_cents, quantity_delta, metadata")
    .eq("organization_id", organizationId)
    .order("movement_date", { ascending: false })
    .limit(BLITZPAY_INVENTORY_MOVEMENT_SCAN_CAP)

  const lite: ProcurementMovementLite[] = (movRows ?? []).map((r) => ({
    movementType: String((r as { movement_type: string }).movement_type),
    movementDateYmd: String((r as { movement_date: string }).movement_date).slice(0, 10),
    totalCostCents: toBigIntCents((r as { total_cost_cents: unknown }).total_cost_cents),
    quantityMilli: parseQuantityMilliFromNumericString(numericStringFromDb((r as { quantity_delta: unknown }).quantity_delta)) ?? 0n,
    metadata: (r as { metadata?: Record<string, unknown> | null }).metadata,
  }))

  let writeoff = 0n
  let usageCost = 0n
  for (const m of lite) {
    if (m.movementType === "writeoff") {
      const t = m.totalCostCents < 0n ? -m.totalCostCents : m.totalCostCents
      writeoff += t
    }
    if (m.movementType === "work_order_usage" || m.movementType === "invoice_sale") {
      const t = m.totalCostCents < 0n ? -m.totalCostCents : m.totalCostCents
      usageCost += t
    }
  }

  const { data: forecasts } = await admin
    .from("blitzpay_reorder_forecasts")
    .select("projected_reorder_cost_cents")
    .eq("organization_id", organizationId)
    .eq("forecast_status", "active")
    .limit(BLITZPAY_REORDER_FORECAST_LIST_CAP)
  let reorderExposure = 0n
  for (const f of forecasts ?? []) {
    const c = toBigIntCents((f as { projected_reorder_cost_cents: unknown }).projected_reorder_cost_cents)
    reorderExposure += c
  }

  const programs = await listVendorRebatePrograms(admin, organizationId)
  const rebateOpp = sumEstimatedAnnualRebateCents(
    (programs as Array<{ estimated_annual_rebate_cents?: number | null }>).map((p) => ({
      estimatedAnnualRebateCents: p.estimated_annual_rebate_cents ?? null,
    })),
    BLITZPAY_VENDOR_REBATE_PROGRAM_LIST_CAP,
  )

  const serialized = await listSerializedAssetFinancials(admin, organizationId)
  const serExposure = exposureFromSerializedAssetsCents(
    (serialized as Array<{ estimated_current_value_cents: unknown; asset_status: string }>).map((r) => ({
      estimatedCurrentValueCents: toBigIntCents(r.estimated_current_value_cents),
      assetStatus: r.asset_status,
    })),
    BLITZPAY_SERIALIZED_ASSET_LIST_CAP,
  )

  const { data: cashRow } = await admin
    .from("blitzpay_org_balances")
    .select("operating_balance_cents")
    .eq("organization_id", organizationId)
    .maybeSingle()
  const operatingCash = toBigIntCents((cashRow as { operating_balance_cents?: unknown } | null)?.operating_balance_cents)

  const snapInv = snap ? toBigIntCents((snap as { total_inventory_value_cents?: unknown }).total_inventory_value_cents) : null
  const snapWo = snap ? toBigIntCents((snap as { total_writeoff_exposure_cents?: unknown }).total_writeoff_exposure_cents) : null
  const snapRe = snap ? toBigIntCents((snap as { total_reorder_exposure_cents?: unknown }).total_reorder_exposure_cents) : null

  const totalInventoryValueCents = snapInv != null && snapInv > 0n ? snapInv : inventoryValue
  const inventoryWriteoffExposure = snapWo != null && snapWo > 0n ? snapWo : writeoff
  const reorderExposureFinal = snapRe != null && snapRe > 0n ? snapRe : reorderExposure

  const turnover = inventoryTurnoverScore0to100({ usageCostCents: usageCost, inventoryValueCents: totalInventoryValueCents })
  const marginHealth = computeInventoryMarginHealthScore0to100(lite)
  const oldest = computeInventoryAgingDaysOldest(lite, new Date().toISOString().slice(0, 10))
  const agingRisk = inventoryAgingRiskScore0to100(oldest)
  const invHealthSnap = (snap as { inventory_health_score?: number | null } | null)?.inventory_health_score
  const inventoryHealthBlend = invHealthSnap != null ? Math.min(100, Math.max(0, Math.round(invHealthSnap))) : Math.max(0, 100 - agingRisk)

  const treasuryProc = procurementTreasuryImpactScore0to100({
    reorderExposureCents: reorderExposureFinal,
    operatingCashCents: operatingCash,
  })

  const n = (x: bigint) => Number(x > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : x)

  return {
    totalInventoryValueCents: n(totalInventoryValueCents),
    inventoryWriteoffExposure: n(inventoryWriteoffExposure),
    inventoryTurnoverScore: turnover,
    reorderExposureCents: n(reorderExposureFinal),
    rebateOpportunityCents: n(rebateOpp),
    serializedAssetExposure: n(serExposure),
    procurementTreasuryImpactScore: treasuryProc,
    inventoryMarginHealthScore: Math.min(100, Math.max(0, Math.round((marginHealth + inventoryHealthBlend) / 2))),
  }
}
