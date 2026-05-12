import type { BulkInvoiceCompletedWorkOrdersPreview } from "@/lib/aiden/actions/resolvers/bulk-invoice-completed-work-orders-types"
import type { CreateInvoiceFromWorkOrderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parseSinglePreview(
  prev: Record<string, unknown>,
):
  | { ok: true; preview: CreateInvoiceFromWorkOrderPreviewPayload }
  | { ok: false; message: string } {
  const customer = prev.customer
  const workOrder = prev.workOrder
  const lineItemsRaw = prev.lineItems
  if (!isRecord(customer) || !isRecord(workOrder) || !Array.isArray(lineItemsRaw)) {
    return { ok: false, message: "Batch item preview is missing customer, workOrder, or lineItems." }
  }

  const customerId = typeof customer.id === "string" ? customer.id : ""
  const workOrderId = typeof workOrder.id === "string" ? workOrder.id : ""
  if (!UUID_RE.test(customerId) || !UUID_RE.test(workOrderId)) {
    return { ok: false, message: "Batch item preview ids are invalid." }
  }

  const lineItems: CreateInvoiceFromWorkOrderPreviewPayload["lineItems"] = []
  for (const raw of lineItemsRaw) {
    if (!isRecord(raw)) continue
    const kind = raw.kind
    const description = typeof raw.description === "string" ? raw.description : ""
    const quantity = typeof raw.quantity === "number" ? raw.quantity : 0
    const unitCents = typeof raw.unitCents === "number" ? raw.unitCents : NaN
    const lineTotalCents = typeof raw.lineTotalCents === "number" ? raw.lineTotalCents : NaN
    if (
      kind !== "labor" &&
      kind !== "parts" &&
      kind !== "materials" &&
      kind !== "fee" &&
      kind !== "manual"
    ) {
      return { ok: false, message: "Batch preview line item has invalid kind." }
    }
    if (!Number.isFinite(unitCents) || !Number.isFinite(lineTotalCents)) {
      return { ok: false, message: "Batch preview line item is missing cents fields." }
    }
    const sourceRaw = raw.source
    const source: CreateInvoiceFromWorkOrderPreviewPayload["lineItems"][number]["source"] =
      sourceRaw === "work_order_line_items"
        ? "work_order_line_items"
        : sourceRaw === "manual"
          ? "manual"
          : "work_order_totals"
    lineItems.push({
      kind,
      description,
      quantity,
      unitCents,
      lineTotalCents,
      source,
    })
  }

  if (lineItems.length === 0) {
    return { ok: false, message: "Batch item preview has no line items." }
  }

  const subtotal = typeof prev.subtotal === "number" ? prev.subtotal : NaN
  const total = typeof prev.total === "number" ? prev.total : NaN
  const taxEstimate = prev.taxEstimate === null ? null : typeof prev.taxEstimate === "number" ? prev.taxEstimate : NaN

  if (!Number.isFinite(subtotal) || !Number.isFinite(total)) {
    return { ok: false, message: "Batch item preview subtotal or total is missing." }
  }

  const notes = typeof prev.notes === "string" ? prev.notes : ""
  const recommendedInvoiceTitle =
    typeof prev.recommendedInvoiceTitle === "string" ? prev.recommendedInvoiceTitle : "Invoice"
  const sourceSummary = typeof prev.sourceSummary === "string" ? prev.sourceSummary : ""

  const warnings: string[] = []
  if (Array.isArray(prev.warnings)) {
    for (const w of prev.warnings) {
      if (typeof w === "string" && w.trim()) warnings.push(w.trim())
    }
  }

  const preview: CreateInvoiceFromWorkOrderPreviewPayload = {
    customer: {
      id: customerId,
      companyName: typeof customer.companyName === "string" ? customer.companyName : "",
      billingName: typeof customer.billingName === "string" || customer.billingName === null ? customer.billingName : null,
      billingContactName:
        typeof customer.billingContactName === "string" || customer.billingContactName === null ?
          customer.billingContactName
        : null,
      billingEmail: typeof customer.billingEmail === "string" || customer.billingEmail === null ? customer.billingEmail : null,
      billingContactPhone:
        typeof customer.billingContactPhone === "string" || customer.billingContactPhone === null ?
          customer.billingContactPhone
        : null,
      billingAddressLine1:
        typeof customer.billingAddressLine1 === "string" || customer.billingAddressLine1 === null ?
          customer.billingAddressLine1
        : null,
      billingAddressLine2:
        typeof customer.billingAddressLine2 === "string" || customer.billingAddressLine2 === null ?
          customer.billingAddressLine2
        : null,
      billingCity: typeof customer.billingCity === "string" || customer.billingCity === null ? customer.billingCity : null,
      billingState: typeof customer.billingState === "string" || customer.billingState === null ? customer.billingState : null,
      billingPostalCode:
        typeof customer.billingPostalCode === "string" || customer.billingPostalCode === null ?
          customer.billingPostalCode
        : null,
      billingCountry:
        typeof customer.billingCountry === "string" || customer.billingCountry === null ? customer.billingCountry : null,
      taxExempt: typeof customer.taxExempt === "boolean" ? customer.taxExempt : null,
      defaultTaxBasis:
        typeof customer.defaultTaxBasis === "string" || customer.defaultTaxBasis === null ? customer.defaultTaxBasis : null,
      defaultTaxCategory:
        typeof customer.defaultTaxCategory === "string" || customer.defaultTaxCategory === null ?
          customer.defaultTaxCategory
        : null,
    },
    workOrder: {
      id: workOrderId,
      workOrderNumber: typeof workOrder.workOrderNumber === "number" ? workOrder.workOrderNumber : null,
      title: typeof workOrder.title === "string" ? workOrder.title : "",
      status: typeof workOrder.status === "string" ? workOrder.status : "",
      completedAt: typeof workOrder.completedAt === "string" || workOrder.completedAt === null ? workOrder.completedAt : null,
      billingState: typeof workOrder.billingState === "string" || workOrder.billingState === null ? workOrder.billingState : null,
      totalLaborCents: typeof workOrder.totalLaborCents === "number" ? workOrder.totalLaborCents : 0,
      totalPartsCents: typeof workOrder.totalPartsCents === "number" ? workOrder.totalPartsCents : 0,
    },
    lineItems,
    subtotal,
    taxEstimate: taxEstimate === null || Number.isFinite(taxEstimate) ? taxEstimate : null,
    total,
    notes,
    warnings,
    recommendedInvoiceTitle,
    sourceSummary,
  }

  return { ok: true, preview }
}

export function parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(
  previewPayload: Record<string, unknown>,
):
  | { ok: true; preview: BulkInvoiceCompletedWorkOrdersPreview }
  | { ok: false; message: string } {
  const root = previewPayload.preview
  if (!isRecord(root)) {
    return { ok: false, message: "Missing or invalid preview payload (expected preview object)." }
  }

  const itemsRaw = root.items
  const dateRange = root.dateRange
  if (!Array.isArray(itemsRaw) || !isRecord(dateRange)) {
    return { ok: false, message: "Preview is missing items or dateRange." }
  }

  const startIso = typeof dateRange.startIso === "string" ? dateRange.startIso : ""
  const endIso = typeof dateRange.endIso === "string" ? dateRange.endIso : ""
  const label = typeof dateRange.label === "string" ? dateRange.label : ""
  if (!startIso || !endIso || !label) {
    return { ok: false, message: "Preview dateRange is incomplete." }
  }

  const excludedRaw = root.excludedWorkOrderIds
  const excludedWorkOrderIds: string[] = []
  if (Array.isArray(excludedRaw)) {
    for (const x of excludedRaw) {
      if (typeof x === "string" && UUID_RE.test(x)) excludedWorkOrderIds.push(x)
    }
  }

  const batchWarnings: string[] = []
  if (Array.isArray(root.batchWarnings)) {
    for (const w of root.batchWarnings) {
      if (typeof w === "string" && w.trim()) batchWarnings.push(w.trim())
    }
  }

  const items: BulkInvoiceCompletedWorkOrdersPreview["items"] = []
  for (const raw of itemsRaw) {
    if (!isRecord(raw)) continue
    const workOrderId = typeof raw.workOrderId === "string" ? raw.workOrderId : ""
    const customerId = typeof raw.customerId === "string" ? raw.customerId : ""
    if (!UUID_RE.test(workOrderId) || !UUID_RE.test(customerId)) continue

    const inv = raw.invoicePreview
    if (!isRecord(inv)) continue

    const parsedOne = parseSinglePreview(inv)
    if (!parsedOne.ok) return { ok: false, message: parsedOne.message }
    if (parsedOne.preview.workOrder.id !== workOrderId) {
      return { ok: false, message: "Preview work order id mismatch in batch item." }
    }
    if (parsedOne.preview.customer.id !== customerId) {
      return { ok: false, message: "Preview customer id mismatch in batch item." }
    }

    const woNum = typeof raw.workOrderNumber === "number" ? raw.workOrderNumber : null
    const customerLabel = typeof raw.customerLabel === "string" ? raw.customerLabel : ""
    const completedAt = typeof raw.completedAt === "string" || raw.completedAt === null ? raw.completedAt : null
    const anomalies: BulkInvoiceCompletedWorkOrdersPreview["items"][number]["anomalies"] = []
    if (Array.isArray(raw.anomalies)) {
      for (const a of raw.anomalies) {
        if (typeof a === "string") anomalies.push(a as (typeof anomalies)[number])
      }
    }

    items.push({
      workOrderId,
      workOrderNumber: woNum,
      customerId,
      customerLabel: customerLabel || "Customer",
      completedAt,
      anomalies: [...new Set(anomalies)],
      invoicePreview: parsedOne.preview,
    })
  }

  if (items.length === 0) {
    return { ok: false, message: "Preview has no batch line items." }
  }

  let includedCount = 0
  let estimatedTotal = 0
  const ex = new Set(excludedWorkOrderIds)
  for (const it of items) {
    if (ex.has(it.workOrderId)) continue
    includedCount += 1
    estimatedTotal += it.invoicePreview.total
  }

  const preview: BulkInvoiceCompletedWorkOrdersPreview = {
    dateRange: { startIso, endIso, label },
    items,
    excludedWorkOrderIds,
    batchWarnings: [...new Set(batchWarnings)],
    summary: {
      candidateCount: items.length,
      includedCount,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    },
  }

  return { ok: true, preview }
}
