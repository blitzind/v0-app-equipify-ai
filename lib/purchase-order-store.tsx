"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"

// ─── Types ────────────────────────────────────────────────────────────────────

export type POStatus =
  | "Draft"
  | "Sent"
  | "Approved"
  | "Ordered"
  | "Partially Received"
  | "Received"
  | "Closed"

export interface POLineItem {
  description: string
  quantity: number
  unitCostCents: number
  lineTotalCents: number
}

export interface PurchaseOrder {
  id: string
  purchaseOrderNumber: string
  vendorId?: string
  vendor: string
  vendorEmail?: string
  vendorPhone?: string
  vendorContactName?: string
  shipTo: string
  billTo: string
  status: POStatus
  orderedDate: string
  eta: string
  amount: number
  workOrderId?: string
  customerId?: string
  equipmentId?: string
  customerName?: string
  notes: string
  lineItems: POLineItem[]
  attachments: string[]
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface POContextValue {
  orders: PurchaseOrder[]
  loading: boolean
  error: string | null
  refreshOrders: () => Promise<void>
  addOrder: (payload: {
    vendorId?: string
    vendor: string
    vendorEmail?: string
    vendorPhone?: string
    vendorContactName?: string
    shipTo: string
    billTo: string
    status: POStatus
    orderedDate: string
    eta: string
    notes: string
    customerId?: string
    equipmentId?: string
    workOrderId?: string
    lineItems: POLineItem[]
  }) => Promise<{ id?: string; error?: string }>
  updateOrder: (id: string, payload: Partial<PurchaseOrder>) => Promise<{ error?: string }>
  archiveOrder: (id: string) => Promise<{ error?: string }>
}

const POContext = createContext<POContextValue | null>(null)

type OrgPurchaseOrderRow = {
  id: string
  purchase_order_number: string
  vendor: string
  vendor_id: string | null
  vendor_email: string | null
  vendor_phone: string | null
  vendor_contact_name: string | null
  ship_to: string | null
  bill_to: string | null
  status: string
  order_date: string | null
  expected_date: string | null
  total_cents: number
  line_items: unknown
  notes: string | null
  customer_id: string | null
  equipment_id: string | null
  work_order_id: string | null
}

function parseLineItems(raw: unknown): POLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const quantity =
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
            : Math.round(quantity * unitCostCents)
      return {
        description: String(row.description ?? ""),
        quantity,
        unitCostCents,
        lineTotalCents,
      }
    })
    .filter((item): item is POLineItem => Boolean(item))
}

function toUiStatus(status: string): POStatus {
  switch (status) {
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
      return "Draft"
  }
}

function toDbStatus(status: POStatus): string {
  const map: Record<POStatus, string> = {
    Draft: "draft",
    Sent: "sent",
    Approved: "approved",
    Ordered: "ordered",
    "Partially Received": "partially_received",
    Received: "received",
    Closed: "closed",
  }
  return map[status] ?? "draft"
}

function mapRowToPurchaseOrder(row: OrgPurchaseOrderRow): PurchaseOrder {
  const lineItems = parseLineItems(row.line_items)
  const amount = Math.round(row.total_cents) / 100
  return {
    id: row.id,
    purchaseOrderNumber: row.purchase_order_number,
    vendorId: row.vendor_id ?? undefined,
    vendor: row.vendor,
    vendorEmail: row.vendor_email ?? undefined,
    vendorPhone: row.vendor_phone ?? undefined,
    vendorContactName: row.vendor_contact_name ?? undefined,
    shipTo: row.ship_to ?? "",
    billTo: row.bill_to ?? "",
    status: toUiStatus(row.status),
    orderedDate: row.order_date ?? "",
    eta: row.expected_date ?? "",
    amount,
    workOrderId: row.work_order_id ?? undefined,
    customerId: row.customer_id ?? undefined,
    equipmentId: row.equipment_id ?? undefined,
    customerName: "",
    notes: row.notes ?? "",
    lineItems,
    attachments: [],
  }
}

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const activeOrg = useActiveOrganization()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshOrders = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from("org_purchase_orders")
      .select("*")
      .eq("organization_id", activeOrg.organizationId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as OrgPurchaseOrderRow[]
    const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[]
    const customerNames = new Map<string, string>()
    if (custIds.length > 0) {
      const { data: custRows } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", activeOrg.organizationId)
        .in("id", custIds)
      for (const c of (custRows ?? []) as Array<{ id: string; company_name: string }>) {
        customerNames.set(c.id, c.company_name)
      }
    }
    setOrders(
      rows.map((row) => {
        const order = mapRowToPurchaseOrder(row)
        if (row.customer_id) {
          order.customerName = customerNames.get(row.customer_id) ?? ""
        }
        return order
      }),
    )
    setLoading(false)
  }, [activeOrg.status, activeOrg.organizationId])

  useEffect(() => {
    void refreshOrders()
  }, [refreshOrders])

  const addOrder = useCallback(
    async (payload: Parameters<POContextValue["addOrder"]>[0]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const total = Math.round(
        payload.lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
      )
      const supabase = createBrowserSupabaseClient()
      const { data, error: insertError } = await supabase
        .from("org_purchase_orders")
        .insert({
          organization_id: activeOrg.organizationId,
          vendor_id: payload.vendorId || null,
          vendor: payload.vendor.trim() || "Vendor",
          vendor_email: payload.vendorEmail?.trim() ? payload.vendorEmail.trim() : null,
          vendor_phone: payload.vendorPhone?.trim() ? payload.vendorPhone.trim() : null,
          vendor_contact_name: payload.vendorContactName?.trim() ? payload.vendorContactName.trim() : null,
          ship_to: payload.shipTo.trim() || null,
          bill_to: payload.billTo.trim() || null,
          status: toDbStatus(payload.status),
          order_date: payload.orderedDate || null,
          expected_date: payload.eta || null,
          total_cents: total,
          line_items: payload.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitCostCents: item.unitCostCents,
            lineTotalCents: item.lineTotalCents,
          })),
          notes: payload.notes.trim() || null,
          customer_id: payload.customerId || null,
          equipment_id: payload.equipmentId || null,
          work_order_id: payload.workOrderId || null,
        })
        .select("id")
        .maybeSingle()
      if (insertError) return { error: insertError.message }
      await refreshOrders()
      return { id: (data as { id: string } | null)?.id }
    },
    [activeOrg.organizationId, refreshOrders],
  )

  const updateOrder = useCallback(
    async (id: string, payload: Partial<PurchaseOrder>) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const update: Record<string, unknown> = {}
      if (payload.vendor !== undefined) update.vendor = payload.vendor.trim() || "Vendor"
      if (payload.vendorId !== undefined) update.vendor_id = payload.vendorId || null
      if (payload.vendorEmail !== undefined)
        update.vendor_email = payload.vendorEmail?.trim() ? payload.vendorEmail.trim() : null
      if (payload.vendorPhone !== undefined)
        update.vendor_phone = payload.vendorPhone?.trim() ? payload.vendorPhone.trim() : null
      if (payload.vendorContactName !== undefined)
        update.vendor_contact_name = payload.vendorContactName?.trim()
          ? payload.vendorContactName.trim()
          : null
      if (payload.shipTo !== undefined) update.ship_to = payload.shipTo.trim() || null
      if (payload.billTo !== undefined) update.bill_to = payload.billTo.trim() || null
      if (payload.status !== undefined) update.status = toDbStatus(payload.status)
      if (payload.orderedDate !== undefined) update.order_date = payload.orderedDate || null
      if (payload.eta !== undefined) update.expected_date = payload.eta || null
      if (payload.notes !== undefined) update.notes = payload.notes.trim() || null
      if (payload.customerId !== undefined) update.customer_id = payload.customerId || null
      if (payload.equipmentId !== undefined) update.equipment_id = payload.equipmentId || null
      if (payload.workOrderId !== undefined) update.work_order_id = payload.workOrderId || null
      if (payload.lineItems !== undefined) {
        update.line_items = payload.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents,
          lineTotalCents: item.lineTotalCents,
        }))
        update.total_cents = payload.lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0)
      } else if (payload.amount !== undefined) {
        update.total_cents = Math.round(payload.amount * 100)
      }
      if (Object.keys(update).length === 0) return {}
      const supabase = createBrowserSupabaseClient()
      const { error: updateError } = await supabase
        .from("org_purchase_orders")
        .update(update)
        .eq("id", id)
        .eq("organization_id", activeOrg.organizationId)
      if (updateError) return { error: updateError.message }
      await refreshOrders()
      return {}
    },
    [activeOrg.organizationId, refreshOrders],
  )

  const archiveOrder = useCallback(
    async (id: string) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const { error: archiveError } = await supabase
        .from("org_purchase_orders")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", activeOrg.organizationId)
      if (archiveError) return { error: archiveError.message }
      await refreshOrders()
      return {}
    },
    [activeOrg.organizationId, refreshOrders],
  )

  return (
    <POContext.Provider
      value={{ orders, loading, error, refreshOrders, addOrder, updateOrder, archiveOrder }}
    >
      {children}
    </POContext.Provider>
  )
}

export function usePurchaseOrders() {
  const ctx = useContext(POContext)
  if (!ctx) throw new Error("usePurchaseOrders must be inside PurchaseOrderProvider")
  return ctx
}
