import type { SupabaseClient } from "@supabase/supabase-js"
import type { LoadedWorkOrderDetail } from "@/lib/work-orders/detail-load"
import type { Part } from "@/lib/mock-data"

export type CustomerProductivitySnapshot = {
  customer: {
    id: string
    companyName: string
    status: string | null
    joinedAt: string | null
    notesExcerpt: string | null
    isArchived: boolean
  }
  recentWorkOrders: Array<{
    id: string
    title: string | null
    status: string
    type: string | null
    priority: string | null
    scheduledOn: string | null
    completedAt: string | null
    updatedAt: string | null
    workOrderNumber: number | null
  }>
  openWorkOrders: Array<{
    id: string
    title: string | null
    status: string
    scheduledOn: string | null
  }>
}

function excerpt(text: string | null | undefined, max = 1200): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const OPEN_STATUSES = new Set(["open", "scheduled", "in_progress", "completed_pending_signature"])

export async function loadCustomerProductivitySnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ ok: true; snapshot: CustomerProductivitySnapshot } | { ok: false; notFound: true }> {
  const { data: cRow, error: cErr } = await supabase
    .from("customers")
    .select("id, company_name, status, joined_at, notes, archived_at")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (cErr || !cRow) {
    return { ok: false, notFound: true }
  }

  const c = cRow as {
    id: string
    company_name: string | null
    status: string | null
    joined_at: string | null
    notes: string | null
    archived_at: string | null
  }

  const { data: woRows, error: woErr } = await supabase
    .from("work_orders")
    .select(
      "id, title, status, type, priority, scheduled_on, completed_at, updated_at, work_order_number, archived_at",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(25)

  const rows =
    !woErr ?
      (woRows ?? []) as Array<{
        id: string
        title: string | null
        status: string
        type: string | null
        priority: string | null
        scheduled_on: string | null
        completed_at: string | null
        updated_at: string | null
        work_order_number: number | null
      }>
    : []

  if (woErr && process.env.NODE_ENV === "development") {
    console.warn("[aiden] customer work order list failed", woErr.message)
  }

  const recentWorkOrders = rows.map((w) => ({
    id: w.id,
    title: w.title?.trim() || null,
    status: w.status,
    type: w.type,
    priority: w.priority,
    scheduledOn: w.scheduled_on,
    completedAt: w.completed_at,
    updatedAt: w.updated_at,
    workOrderNumber: w.work_order_number,
  }))

  const openWorkOrders = rows
    .filter((w) => OPEN_STATUSES.has(w.status))
    .slice(0, 15)
    .map((w) => ({
      id: w.id,
      title: w.title?.trim() || null,
      status: w.status,
      scheduledOn: w.scheduled_on,
    }))

  return {
    ok: true,
    snapshot: {
      customer: {
        id: c.id,
        companyName: (c.company_name ?? "").trim() || "Customer",
        status: c.status,
        joinedAt: c.joined_at,
        notesExcerpt: excerpt(c.notes),
        isArchived: Boolean(c.archived_at),
      },
      recentWorkOrders,
      openWorkOrders,
    },
  }
}

function partsForSnapshot(parts: Part[]) {
  return parts.map((p) => ({
    name: p.name?.trim() || "Part",
    partNumber: p.partNumber?.trim() || undefined,
    quantity: p.quantity,
  }))
}

/** Strip attachment URLs and financial totals — suggestions only. */
export function workOrderDetailToProductivitySnapshot(detail: LoadedWorkOrderDetail): Record<string, unknown> {
  const wo = detail.workOrder
  const rl = wo.repairLog
  const tasks = (rl.tasks ?? []).map((t) => ({
    label: t.label,
    done: t.done,
    description: t.description?.trim() || undefined,
  }))
  const parts = detail.usesPartsLineItems ? partsForSnapshot(rl.partsUsed ?? []) : partsForSnapshot(rl.partsUsed ?? [])

  return {
    workOrder: {
      id: wo.id,
      workOrderNumber: wo.workOrderNumber ?? null,
      title: wo.description?.trim() || "",
      status: wo.status,
      type: wo.type,
      priority: wo.priority,
      scheduledDate: wo.scheduledDate || null,
      scheduledTime: wo.scheduledTime || null,
      completedDate: wo.completedDate || null,
      customerName: wo.customerName,
      equipmentName: wo.equipmentName,
      equipmentLocation: wo.location || null,
      equipmentCategory: wo.equipmentCategory || null,
      equipmentCode: wo.equipmentCode || null,
      serialNumber: wo.equipmentSerialNumber || null,
      technicianName: wo.technicianName,
      problemReported: rl.problemReported?.trim() || "",
      diagnosis: rl.diagnosis?.trim() || "",
      technicianNotes: rl.technicianNotes?.trim() || "",
      maintenancePlanName: wo.maintenancePlanName || null,
      invoiceNumber: wo.invoiceNumber?.trim() || null,
      billingState: wo.billingState || null,
      warrantyReviewRequired: wo.warrantyReviewRequired,
      calibrationTemplateId: wo.calibrationTemplateId || null,
      photoCount: detail.photoGallery.length,
      documentCount: detail.documentAttachments.length,
      tasks,
      parts,
      usesTasksTable: detail.usesTasksTable,
      usesPartsLineItems: detail.usesPartsLineItems,
    },
    internalNotes: detail.notes?.trim() || "",
    equipmentAssets: detail.equipmentAssets.map((a) => ({
      name: a.name,
      equipmentCode: a.equipmentCode,
      serialNumber: a.serialNumber,
      category: a.category,
      locationLabel: a.locationLabel,
      typeLabel: a.typeLabel,
      priorityLabel: a.priorityLabel,
      certificateStatus: a.certificateStatus,
      isPrimary: a.isPrimary,
    })),
  }
}

export async function loadDraftSnapshot(args: {
  supabase: SupabaseClient
  organizationId: string
  workOrderId?: string | null
  customerId?: string | null
}): Promise<
  | { ok: true; snapshot: Record<string, unknown>; label: string }
  | { ok: false; notFound: true }
> {
  const { supabase, organizationId } = args
  const workOrderId = args.workOrderId?.trim() || null
  const customerId = args.customerId?.trim() || null

  if (workOrderId) {
    const { loadWorkOrderDetailForOrg } = await import("@/lib/work-orders/detail-load")
    const loaded = await loadWorkOrderDetailForOrg(supabase, organizationId, workOrderId)
    if (!loaded.ok || !loaded.data) {
      return { ok: false, notFound: true }
    }
    return {
      ok: true,
      snapshot: workOrderDetailToProductivitySnapshot(loaded.data),
      label: "work_order",
    }
  }

  if (customerId) {
    const cust = await loadCustomerProductivitySnapshot(supabase, organizationId, customerId)
    if (!cust.ok) {
      return { ok: false, notFound: true }
    }
    return {
      ok: true,
      snapshot: { customerContext: cust.snapshot },
      label: "customer",
    }
  }

  return { ok: false, notFound: true }
}
