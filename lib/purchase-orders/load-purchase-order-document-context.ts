import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { splitLineItemDescription } from "@/lib/documents/document-address"
import { loadCustomerDocumentFields } from "@/lib/documents/load-customer-document-fields"
import { getOrganizationDocumentBranding } from "@/lib/organization/document-branding"
import type {
  PurchaseOrderDocumentContext,
  PurchaseOrderDocumentLineItem,
} from "@/lib/purchase-orders/purchase-order-document-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"

function formatDateLabel(isoDate: string | null | undefined, fallback: string): string {
  if (!isoDate) return fallback
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function poStatusDbToUi(status: string): string {
  switch (String(status || "").toLowerCase()) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "approved":
      return "Approved"
    case "ordered":
      return "Ordered"
    case "partially_received":
      return "Partially Received"
    case "received":
      return "Received"
    case "closed":
      return "Closed"
    default:
      return status || "Draft"
  }
}

function parsePurchaseOrderLineItems(raw: unknown): PurchaseOrderDocumentLineItem[] {
  if (!Array.isArray(raw)) return []
  const out: PurchaseOrderDocumentLineItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const qty =
      typeof row.quantity === "number"
        ? row.quantity
        : typeof row.qty === "number"
          ? row.qty
          : Number(row.quantity ?? row.qty ?? 0)
    const unitCostCents =
      typeof row.unitCostCents === "number"
        ? row.unitCostCents
        : typeof row.unit_cost_cents === "number"
          ? Number(row.unit_cost_cents)
          : typeof row.unitCost === "number"
            ? Math.round(Number(row.unitCost) * 100)
            : typeof row.unit_cost === "number"
              ? Math.round(Number(row.unit_cost) * 100)
              : Math.round(Number(row.unitCost ?? row.unit_cost ?? 0) * 100)
    const lineTotalCents =
      typeof row.lineTotalCents === "number"
        ? row.lineTotalCents
        : typeof row.line_total_cents === "number"
          ? Number(row.line_total_cents)
          : Math.round(qty * unitCostCents)
    const description = String(row.description ?? "").trim() || "Line item"
    const split = splitLineItemDescription(description)
    const line: PurchaseOrderDocumentLineItem = {
      description,
      itemName: split.title,
      detailNotes: split.detail,
      qty,
      unitUsd: unitCostCents / 100,
      lineTotalUsd: lineTotalCents / 100,
    }
    const sku =
      typeof row.skuSnapshot === "string"
        ? row.skuSnapshot
        : typeof row.sku_snapshot === "string"
          ? row.sku_snapshot
          : typeof row.sku === "string"
            ? row.sku
            : null
    if (sku?.trim()) line.sku = sku.trim()
    out.push(line)
  }
  return out
}

export type LoadPurchaseOrderDocumentContextOptions = {
  staffDocumentExport?: boolean
}

export async function loadPurchaseOrderDocumentContext(
  supabase: SupabaseClient,
  organizationId: string,
  purchaseOrderId: string,
  opts?: LoadPurchaseOrderDocumentContextOptions,
): Promise<PurchaseOrderDocumentContext | null> {
  const { data: row, error } = await supabase
    .from("org_purchase_orders")
    .select(
      [
        "id",
        "organization_id",
        "purchase_order_number",
        "vendor",
        "vendor_id",
        "vendor_email",
        "vendor_phone",
        "vendor_contact_name",
        "status",
        "order_date",
        "expected_date",
        "total_cents",
        "line_items",
        "notes",
        "customer_id",
        "work_order_id",
        "ship_to",
        "bill_to",
        "archived_at",
      ].join(", "),
    )
    .eq("id", purchaseOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !row) return null

  const po = row as unknown as {
    id: string
    purchase_order_number?: string | null
    vendor?: string | null
    vendor_email?: string | null
    vendor_phone?: string | null
    vendor_contact_name?: string | null
    status?: string | null
    order_date?: string | null
    expected_date?: string | null
    total_cents?: number | null
    line_items?: unknown
    notes?: string | null
    customer_id?: string | null
    work_order_id?: string | null
    ship_to?: string | null
    bill_to?: string | null
    archived_at?: string | null
  }

  if (!opts?.staffDocumentExport && po.archived_at) return null

  const [branding, customerFields] = await Promise.all([
    getOrganizationDocumentBranding(supabase, organizationId),
    po.customer_id
      ? loadCustomerDocumentFields(supabase, organizationId, po.customer_id)
      : Promise.resolve(null),
  ])

  let workOrderLabel: string | null = null
  if (po.work_order_id) {
    let woSel = await supabase
      .from("work_orders")
      .select("id, work_order_number")
      .eq("id", po.work_order_id)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
      woSel = await supabase
        .from("work_orders")
        .select("id")
        .eq("id", po.work_order_id)
        .eq("organization_id", organizationId)
        .maybeSingle()
    }
    const wo = woSel.data as { id: string; work_order_number?: number | null } | null
    if (!woSel.error && wo) {
      workOrderLabel = getWorkOrderDisplay({ id: wo.id, workOrderNumber: wo.work_order_number ?? undefined })
    }
  }

  const lineItems = parsePurchaseOrderLineItems(po.line_items)
  const computedTotal = lineItems.reduce((sum, li) => sum + Math.round(li.lineTotalUsd * 100), 0)
  const totalCents = Math.max(0, Math.round(Number(po.total_cents ?? computedTotal)))

  return {
    organizationId,
    purchaseOrderId: po.id,
    organizationName: branding.organizationName,
    documentLogoUrl: branding.documentLogoUrl,
    logoUrl: branding.appLogoUrl,
    companyAddress: branding.companyAddress,
    companyPhone: branding.companyPhone,
    companyWebsite: branding.companyWebsite,
    companyEmail: branding.companyEmail,
    purchaseOrderNumberLabel: String(po.purchase_order_number ?? "").trim() || "Purchase Order",
    statusDisplay: poStatusDbToUi(String(po.status || "")),
    orderDateLabel: formatDateLabel(po.order_date, "—"),
    expectedDateLabel: formatDateLabel(po.expected_date, "—"),
    vendorName: po.vendor?.trim() || "Vendor",
    vendorEmail: po.vendor_email?.trim() || null,
    vendorPhone: po.vendor_phone?.trim() || null,
    vendorContactName: po.vendor_contact_name?.trim() || null,
    customerCompanyName: customerFields?.customerCompanyName ?? null,
    customerPhone: customerFields?.customerPhone ?? null,
    customerEmail: customerFields?.customerEmail ?? null,
    shipToBlock: po.ship_to?.trim() || null,
    billToBlock: po.bill_to?.trim() || null,
    workOrderLabel,
    lineItems,
    notes: po.notes?.trim() || null,
    totalCents,
  }
}
