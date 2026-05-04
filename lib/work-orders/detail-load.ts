import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"
import { WO_DETAIL_SELECT, WO_DETAIL_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.includes("T") ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5)
  return t || ""
}

function mapDbStatus(status: string): WorkOrderStatus {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbPriority(priority: string): WorkOrderPriority {
  switch (priority) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return "Normal"
  }
}

function mapDbType(type: string): WorkOrderType {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

type WoRow = {
  id: string
  work_order_number?: number | null
  organization_id: string
  customer_id: string
  equipment_id: string
  title: string
  status: string
  priority: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  completed_at: string | null
  assigned_user_id: string | null
  created_at: string
  invoice_number: string | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  repair_log: unknown
  maintenance_plan_id: string | null
}

export type LoadedWorkOrderDetail = {
  organizationId: string
  workOrder: WorkOrder
  notes: string
  planServices: unknown[] | null
}

export async function loadWorkOrderDetailForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<
  | { ok: true; data: LoadedWorkOrderDetail }
  | { ok: false; notFound?: boolean; message?: string }
> {
  let woRes = await supabase
    .from("work_orders")
    .select(WO_DETAIL_SELECT_WITH_NUM)
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .maybeSingle()

  if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
    woRes = await supabase
      .from("work_orders")
      .select(WO_DETAIL_SELECT)
      .eq("id", workOrderId)
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .maybeSingle()
  }

  const { data: row, error } = woRes
  if (error) return { ok: false, message: error.message }
  if (!row) return { ok: false, notFound: true }

  const w = row as WoRow

  const [{ data: cust }, { data: eq }, { data: assigneeProf }, planRes] = await Promise.all([
    supabase
      .from("customers")
      .select("company_name")
      .eq("id", w.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("equipment")
      .select("name, location_label, equipment_code, serial_number, category")
      .eq("id", w.equipment_id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    w.assigned_user_id
      ? supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", w.assigned_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    w.maintenance_plan_id
      ? supabase
          .from("maintenance_plans")
          .select("name, services")
          .eq("id", w.maintenance_plan_id)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const customerName = (cust as { company_name: string } | null)?.company_name ?? "Unknown Customer"
  const eqRow = eq as {
    name: string
    location_label: string | null
    equipment_code: string | null
    serial_number: string | null
    category: string | null
  } | null
  const equipmentName = eqRow
    ? getEquipmentDisplayPrimary({
        id: w.equipment_id,
        name: eqRow.name,
        equipment_code: eqRow.equipment_code,
        serial_number: eqRow.serial_number,
        category: eqRow.category,
      })
    : "Equipment"
  const location = eqRow?.location_label ?? ""
  const ap = assigneeProf as { full_name: string | null; email: string | null } | null
  const techName = w.assigned_user_id
    ? (ap?.full_name && ap.full_name.trim()) || (ap?.email && ap.email.trim()) || "Unknown"
    : "Unassigned"
  const techId = w.assigned_user_id ?? "unassigned"

  const planRow = planRes.data as { name: string; services: unknown } | null
  const planName = w.maintenance_plan_id ? (planRow?.name ?? null) : null
  let planServices: unknown[] | null = null
  if (w.maintenance_plan_id && planRow && Array.isArray(planRow.services)) {
    planServices = planRow.services
  }

  const mapped: WorkOrder = {
    id: w.id,
    workOrderNumber: w.work_order_number ?? undefined,
    customerId: w.customer_id,
    customerName,
    equipmentId: w.equipment_id,
    equipmentName,
    location,
    type: mapDbType(w.type),
    status: mapDbStatus(w.status),
    priority: mapDbPriority(w.priority),
    technicianId: techId,
    technicianName: techName,
    scheduledDate: w.scheduled_on ?? "",
    scheduledTime: formatScheduledTime(w.scheduled_time),
    completedDate: w.completed_at ? w.completed_at.slice(0, 10) : "",
    createdAt: w.created_at,
    createdBy: "",
    description: w.title,
    repairLog: parseRepairLog(w.repair_log),
    totalLaborCost: w.total_labor_cents / 100,
    totalPartsCost: w.total_parts_cents / 100,
    invoiceNumber: w.invoice_number ?? "",
    maintenancePlanId: w.maintenance_plan_id,
    maintenancePlanName: planName,
  }

  return {
    ok: true,
    data: {
      organizationId,
      workOrder: mapped,
      notes: w.notes ?? "",
      planServices,
    },
  }
}
