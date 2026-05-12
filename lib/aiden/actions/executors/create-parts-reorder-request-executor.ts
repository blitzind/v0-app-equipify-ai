import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { CreatePartsReorderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { requireCanCreateRecordForOrganization } from "@/lib/billing/server-guard"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "create_parts_reorder_request"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function costToUnitCents(cost: unknown): number {
  if (cost == null) return 0
  const n = Number(cost)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

async function fetchOrgSubscriptionForTrialLocal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_ends_at, plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  return (data ?? null) as OrganizationSubscription | null
}

async function reassertPermission(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  platformAdminPlanBypass?: boolean
}): Promise<boolean> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrialLocal(args.supabase, args.organizationId)
  return canPrepareAidenActionId(
    {
      permissions: args.permissions,
      planId,
      trialActive: isTrialActive(sub),
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    },
    ACTION_ID,
  )
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: CreatePartsReorderPreviewPayload } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }

  const mode = prev.executionMode
  if (mode !== "draft_purchase_order" && mode !== "restock_requests") {
    return { ok: false, message: "Invalid execution mode." }
  }

  const linesRaw = prev.lines
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return { ok: false, message: "Preview must include at least one line." }
  }

  const lines: CreatePartsReorderPreviewPayload["lines"] = []
  for (const row of linesRaw) {
    if (!isRecord(row)) return { ok: false, message: "Invalid line row." }
    const lineKey = typeof row.lineKey === "string" ? row.lineKey.trim() : ""
    const catalogItemId = typeof row.catalogItemId === "string" ? row.catalogItemId.trim() : ""
    const partName = typeof row.partName === "string" ? row.partName.trim() : ""
    const sku = row.sku === null || row.sku === undefined ? null : typeof row.sku === "string" ? row.sku : null
    const partNumber =
      row.partNumber === null || row.partNumber === undefined ? null
      : typeof row.partNumber === "string" ?
        row.partNumber
      : null
    const currentStockAvailable =
      typeof row.currentStockAvailable === "number" && Number.isFinite(row.currentStockAvailable) ?
        row.currentStockAvailable
      : NaN
    const suggestedQuantity =
      typeof row.suggestedQuantity === "number" && Number.isFinite(row.suggestedQuantity) ?
        Math.round(row.suggestedQuantity)
      : NaN
    let vendorId: string | null = null
    if (row.vendorId === null || row.vendorId === undefined) vendorId = null
    else if (typeof row.vendorId === "string" && UUID_RE.test(row.vendorId.trim())) vendorId = row.vendorId.trim()
    else return { ok: false, message: "Invalid vendor on a line." }
    const vendorName =
      row.vendorName === null || row.vendorName === undefined ? null
      : typeof row.vendorName === "string" ?
        row.vendorName
      : null
    const inventoryLocationId =
      typeof row.inventoryLocationId === "string" ? row.inventoryLocationId.trim() : ""
    const inventoryLocationLabel =
      typeof row.inventoryLocationLabel === "string" ? row.inventoryLocationLabel.trim() : ""
    const reason = typeof row.reason === "string" ? row.reason.trim() : ""

    if (
      !UUID_RE.test(lineKey) ||
      !UUID_RE.test(catalogItemId) ||
      partName.length < 1 ||
      !UUID_RE.test(inventoryLocationId) ||
      inventoryLocationLabel.length < 1 ||
      reason.length < 1 ||
      !Number.isFinite(currentStockAvailable) ||
      !Number.isFinite(suggestedQuantity) ||
      suggestedQuantity < 1 ||
      suggestedQuantity > 1_000_000
    ) {
      return { ok: false, message: "Invalid line fields." }
    }

    lines.push({
      lineKey,
      catalogItemId,
      partName,
      sku,
      partNumber,
      currentStockAvailable,
      suggestedQuantity,
      vendorId,
      vendorName,
      inventoryLocationId,
      inventoryLocationLabel,
      reason,
    })
  }

  const source = prev.source
  if (source !== "work_order" && source !== "equipment" && source !== "low_stock_org") {
    return { ok: false, message: "Invalid preview source." }
  }

  let relatedWorkOrder: CreatePartsReorderPreviewPayload["relatedWorkOrder"] = null
  if (prev.relatedWorkOrder === null) relatedWorkOrder = null
  else if (isRecord(prev.relatedWorkOrder)) {
    const w = prev.relatedWorkOrder
    const wid = typeof w.id === "string" ? w.id.trim() : ""
    const num = typeof w.number === "number" && Number.isFinite(w.number) ? w.number : NaN
    const title = w.title === null ? null : typeof w.title === "string" ? w.title : null
    if (!UUID_RE.test(wid) || !Number.isFinite(num)) return { ok: false, message: "Invalid related work order." }
    relatedWorkOrder = { id: wid, number: num, title }
  } else return { ok: false, message: "Invalid related work order." }

  let relatedEquipment: CreatePartsReorderPreviewPayload["relatedEquipment"] = null
  if (prev.relatedEquipment === null) relatedEquipment = null
  else if (isRecord(prev.relatedEquipment)) {
    const e = prev.relatedEquipment
    const eid = typeof e.id === "string" ? e.id.trim() : ""
    const name = typeof e.name === "string" ? e.name.trim() : ""
    if (!UUID_RE.test(eid) || name.length < 1) return { ok: false, message: "Invalid related equipment." }
    relatedEquipment = { id: eid, name }
  } else return { ok: false, message: "Invalid related equipment." }

  const firstVid = lines[0]?.vendorId
  const draftEligible = Boolean(
    firstVid && UUID_RE.test(firstVid) && lines.every((l) => l.vendorId === firstVid),
  )
  if (mode === "draft_purchase_order" && !draftEligible) {
    return { ok: false, message: "Draft purchase order requires the same vendor on every line." }
  }

  const av = Array.isArray(prev.availableVendors) ? prev.availableVendors : []
  const availableVendors = av
    .filter(isRecord)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id.trim() : "",
      name: typeof v.name === "string" ? v.name.trim() : "",
    }))
    .filter((v) => UUID_RE.test(v.id) && v.name.length > 0)

  return {
    ok: true,
    preview: {
      source,
      executionMode: mode,
      draftPurchaseOrderEligible: draftEligible,
      lines,
      relatedWorkOrder,
      relatedEquipment,
      availableVendors,
      internalNotes: typeof prev.internalNotes === "string" ? prev.internalNotes : "",
    },
  }
}

export type CreatePartsReorderRequestExecutorResult =
  | {
      kind: "success"
      message: string
      purchaseOrderId?: string | null
      purchaseOrderNumber?: string | null
      restockLedgerIds?: string[]
    }
  | {
      kind: "idempotent"
      message: string
      purchaseOrderId?: string | null
      purchaseOrderNumber?: string | null
      restockLedgerIds?: string[]
    }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteCreatePartsReorderRequestArgs = {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

export async function executeCreatePartsReorderRequest(
  args: ExecuteCreatePartsReorderRequestArgs,
): Promise<CreatePartsReorderRequestExecutorResult> {
  const okPerm = await reassertPermission({
    supabase: args.userSupabase,
    organizationId: args.organizationId,
    permissions: args.permissions,
    platformAdminPlanBypass: args.platformAdminPlanBypass,
  })
  if (!okPerm) {
    return { kind: "permission_denied", message: "You do not have permission to create this reorder request." }
  }

  const execExisting = args.row.execution_payload as {
    purchaseOrderId?: string
    restockLedgerIds?: string[]
  } | null
  if (args.row.status === "completed") {
    const po = execExisting?.purchaseOrderId
    const led = execExisting?.restockLedgerIds
    if (po && UUID_RE.test(po)) {
      return {
        kind: "idempotent",
        message: "Reorder request was already completed for this prepared action.",
        purchaseOrderId: po,
      }
    }
    if (Array.isArray(led) && led.length > 0 && led.every((x) => typeof x === "string" && UUID_RE.test(x))) {
      return {
        kind: "idempotent",
        message: "Reorder request was already completed for this prepared action.",
        restockLedgerIds: led,
      }
    }
  }

  const parsed = parsePreviewPayload(args.row.preview_payload ?? {})
  if (!parsed.ok) return { kind: "validation_error", message: parsed.message }
  const preview = parsed.preview

  const activeLines = preview.lines.filter((l) => l.suggestedQuantity > 0)
  if (activeLines.length === 0) {
    return { kind: "validation_error", message: "At least one line needs a positive quantity." }
  }

  const trace = `AIDEN_PREPARED_ACTION_ID=${args.preparedActionId}`
  const traceAction = `AIDEN_PREPARED_ACTION=${ACTION_ID}`

  if (preview.executionMode === "draft_purchase_order") {
    const billing = await requireCanCreateRecordForOrganization(
      args.userSupabase,
      args.organizationId,
      "purchase_order",
    )
    if (!billing.ok) {
      if (billing.httpStatus >= 500) return { kind: "server_error", message: billing.message }
      return { kind: "permission_denied", message: billing.message }
    }

    const vendorId = activeLines[0]?.vendorId
    if (!vendorId || !activeLines.every((l) => l.vendorId === vendorId)) {
      return { kind: "validation_error", message: "Draft PO requires a single shared vendor for all lines." }
    }

    const qtyByCat = new Map<string, number>()
    for (const line of activeLines) {
      const prevQty = qtyByCat.get(line.catalogItemId) ?? 0
      qtyByCat.set(line.catalogItemId, prevQty + line.suggestedQuantity)
    }
    const catalogIds = [...qtyByCat.keys()]

    const { data: vendor, error: vErr } = await args.svc
      .from("org_vendors")
      .select("id, name, email, phone, contact_name, shipping_address, billing_address")
      .eq("organization_id", args.organizationId)
      .eq("id", vendorId)
      .maybeSingle()
    if (vErr) return { kind: "server_error", message: vErr.message }
    if (!vendor) return { kind: "validation_error", message: "Vendor not found." }

    const { data: catRows, error: cErr } = await args.svc
      .from("catalog_items")
      .select("id, name, part_number, sku, unit, item_type, vendor_id, cost")
      .eq("organization_id", args.organizationId)
      .in("id", catalogIds)
    if (cErr) return { kind: "server_error", message: cErr.message }
    const catMap = new Map((catRows ?? []).map((c) => [c.id as string, c]))
    for (const cid of catalogIds) {
      const row = catMap.get(cid) as { vendor_id?: string } | undefined
      if (!row) return { kind: "validation_error", message: `Catalog item ${cid} not found.` }
      if (row.vendor_id !== vendorId) {
        return {
          kind: "validation_error",
          message: "Each catalog line must use the vendor assigned on the catalog item for a draft PO.",
        }
      }
    }

    let totalCents = 0
    const lineItemsJson = catalogIds.map((cid) => {
      const cat = catMap.get(cid) as Record<string, unknown>
      const qty = Math.round(Number(qtyByCat.get(cid) ?? 0))
      const unitCostCents = costToUnitCents(cat.cost)
      const lineTotalCents = Math.round(qty * unitCostCents)
      totalCents += lineTotalCents
      const name = String(cat.name ?? "").trim()
      const pn = String(cat.part_number ?? "").trim()
      const description = pn ? `${pn} — ${name}` : name || "Catalog item"
      return {
        description,
        quantity: qty,
        unitCostCents,
        lineTotalCents,
        catalog_item_id: cid,
        sku_snapshot: typeof cat.sku === "string" ? cat.sku : null,
        item_type_snapshot: typeof cat.item_type === "string" ? cat.item_type : null,
        unit_label_snapshot: typeof cat.unit === "string" ? cat.unit : null,
      }
    })

    const notesCombined = [`Draft from AIden prepared reorder — not sent.`, trace, traceAction].join("\n")

    const { data: inserted, error: insErr } = await args.svc
      .from("org_purchase_orders")
      .insert({
        organization_id: args.organizationId,
        vendor_id: vendorId,
        vendor: String((vendor as { name?: string }).name ?? "Vendor").trim() || "Vendor",
        vendor_email: (vendor as { email?: string | null }).email ?? null,
        vendor_phone: (vendor as { phone?: string | null }).phone ?? null,
        vendor_contact_name: (vendor as { contact_name?: string | null }).contact_name ?? null,
        ship_to: String((vendor as { shipping_address?: string | null }).shipping_address ?? "").trim() || null,
        bill_to: String((vendor as { billing_address?: string | null }).billing_address ?? "").trim() || null,
        status: "draft",
        total_cents: totalCents,
        line_items: lineItemsJson,
        notes: notesCombined.slice(0, 4000),
      })
      .select("id, purchase_order_number")
      .maybeSingle()

    if (insErr) return { kind: "server_error", message: insErr.message }
    const id = (inserted as { id?: string } | null)?.id
    const purchase_order_number = (inserted as { purchase_order_number?: string | null } | null)?.purchase_order_number
    if (!id) return { kind: "server_error", message: "Insert did not return a purchase order id." }

    return {
      kind: "success",
      message:
        "Draft purchase order created internally. Review it under Purchasing — nothing is transmitted to the vendor from this step.",
      purchaseOrderId: id,
      purchaseOrderNumber: purchase_order_number ?? null,
    }
  }

  const restockLedgerIds: string[] = []
  for (const line of activeLines) {
    const notes = [trace, traceAction, line.reason, `Part: ${line.partName}`].filter(Boolean).join("\n").slice(0, 500)
    const correlationId = args.preparedActionId
    const { data: ins, error: ledErr } = await args.svc
      .from("inventory_transactions")
      .insert({
        organization_id: args.organizationId,
        catalog_item_id: line.catalogItemId,
        location_id: line.inventoryLocationId,
        transaction_type: "reorder_recorded",
        quantity: line.suggestedQuantity,
        delta_on_hand: 0,
        delta_allocated: 0,
        correlation_id: correlationId,
        work_order_id: preview.relatedWorkOrder?.id && UUID_RE.test(preview.relatedWorkOrder.id) ?
          preview.relatedWorkOrder.id
        : null,
        notes,
        metadata: {
          restock_request: true,
          requested_quantity: line.suggestedQuantity,
          quantity_was_unspecified: false,
          aiden_prepared_action: true,
          prepared_action_id: args.preparedActionId,
        },
        created_by: args.userId,
      })
      .select("id")
      .maybeSingle()
    if (ledErr) return { kind: "server_error", message: ledErr.message }
    const lid = (ins as { id?: string } | null)?.id
    if (lid) restockLedgerIds.push(lid)
  }

  return {
    kind: "success",
    message:
      "Restock / reorder signals were written to the inventory ledger. Review the reorder center — no external purchase was submitted.",
    restockLedgerIds,
  }
}
