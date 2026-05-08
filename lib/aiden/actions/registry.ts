import { z } from "zod"
import type { AidenActionType } from "@/lib/permissions/aiden-actions"
import type { AidenActionDefinition } from "@/lib/aiden/actions/types"

const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable()

const createCustomerSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const createEquipmentSchema = z.object({
  customerId: uuid,
  name: z.string().trim().min(1).max(160),
  manufacturer: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  locationLabel: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const createWorkOrderSchema = z.object({
  customerId: uuid,
  equipmentId: uuid,
  title: z.string().trim().min(1).max(180),
  problemReported: z.string().trim().max(1000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  type: z.enum(["repair", "pm", "inspection", "install", "emergency"]).default("repair"),
  scheduledOn: date.optional().nullable(),
  scheduledTime: time,
  assignedUserId: uuid.optional().nullable(),
})

const createMaintenancePlanSchema = z.object({
  customerId: uuid,
  equipmentId: uuid,
  name: z.string().trim().min(1).max(180),
  intervalValue: z.number().int().positive().max(60).default(1),
  intervalUnit: z.enum(["day", "week", "month", "year"]).default("month"),
  nextDueDate: date.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const createInvoiceSchema = z.object({
  customerId: uuid,
  equipmentId: uuid.optional().nullable(),
  title: z.string().trim().min(1).max(180),
  amountCents: z.number().int().min(0).default(0),
  issuedAt: date.optional().nullable(),
})

const createQuoteSchema = z.object({
  customerId: uuid,
  title: z.string().trim().min(1).max(180),
  amountCents: z.number().int().min(0).default(0),
})

const scheduleWorkOrderSchema = z.object({
  workOrderId: uuid,
  scheduledOn: date,
  scheduledTime: time,
  assignedUserId: uuid.optional().nullable(),
})

const assignTechnicianSchema = z.object({
  workOrderId: uuid,
  assignedUserId: uuid,
})

function nullableTrim(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const AIDEN_ACTION_REGISTRY: Record<AidenActionType, AidenActionDefinition> = {
  create_customer: {
    type: "create_customer",
    label: "Create Customer",
    description: "Create a customer record and optional primary contact.",
    schema: createCustomerSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createCustomerSchema>
      const { data: customer, error } = await ctx.supabase
        .from("customers")
        .insert({
          organization_id: ctx.organizationId,
          company_name: p.companyName.trim(),
          status: "active",
          notes: nullableTrim(p.notes),
          created_by: ctx.userId,
        })
        .select("id")
        .single()
      if (error || !customer?.id) throw new Error(error?.message ?? "Could not create customer.")

      if (p.contactName?.trim()) {
        const parts = p.contactName.trim().split(/\s+/)
        await ctx.supabase.from("customer_contacts").insert({
          organization_id: ctx.organizationId,
          customer_id: customer.id,
          full_name: p.contactName.trim(),
          first_name: parts[0] ?? null,
          last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
          email: nullableTrim(p.email),
          phone: nullableTrim(p.phone),
          is_primary: true,
        })
      }

      return { id: customer.id, label: p.companyName, href: `/customers/${customer.id}`, message: "Customer created." }
    },
  },
  create_equipment: {
    type: "create_equipment",
    label: "Create Equipment",
    description: "Create an equipment asset for an existing customer.",
    schema: createEquipmentSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createEquipmentSchema>
      const { data, error } = await ctx.supabase
        .from("equipment")
        .insert({
          organization_id: ctx.organizationId,
          customer_id: p.customerId,
          name: p.name.trim(),
          manufacturer: nullableTrim(p.manufacturer),
          category: nullableTrim(p.category),
          serial_number: nullableTrim(p.serialNumber),
          location_label: nullableTrim(p.locationLabel),
          notes: nullableTrim(p.notes),
          status: "active",
        })
        .select("id")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not create equipment.")
      return { id: data.id, label: p.name, href: `/equipment/${data.id}`, message: "Equipment created." }
    },
  },
  create_work_order: {
    type: "create_work_order",
    label: "Create Work Order",
    description: "Create a work order for an existing customer and equipment record.",
    schema: createWorkOrderSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createWorkOrderSchema>
      const { data, error } = await ctx.supabase
        .from("work_orders")
        .insert({
          organization_id: ctx.organizationId,
          customer_id: p.customerId,
          equipment_id: p.equipmentId,
          title: p.title.trim(),
          status: p.scheduledOn ? "scheduled" : "open",
          priority: p.priority,
          type: p.type,
          scheduled_on: p.scheduledOn ?? null,
          scheduled_time: p.scheduledTime ?? null,
          assigned_user_id: p.assignedUserId ?? null,
          problem_reported: nullableTrim(p.problemReported),
          repair_log: { problemReported: nullableTrim(p.problemReported) ?? "", photos: [], partsUsed: [] },
        })
        .select("id")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not create work order.")
      return { id: data.id, label: p.title, href: `/work-orders/${data.id}`, message: "Work order created." }
    },
  },
  create_maintenance_plan: {
    type: "create_maintenance_plan",
    label: "Create Maintenance Plan",
    description: "Create a recurring preventive maintenance plan.",
    schema: createMaintenancePlanSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createMaintenancePlanSchema>
      const { data, error } = await ctx.supabase
        .from("maintenance_plans")
        .insert({
          organization_id: ctx.organizationId,
          customer_id: p.customerId,
          equipment_id: p.equipmentId,
          name: p.name.trim(),
          status: "active",
          priority: "normal",
          interval_value: p.intervalValue,
          interval_unit: p.intervalUnit,
          next_due_date: p.nextDueDate ?? null,
          notes: nullableTrim(p.notes),
          services: [],
          notification_rules: [],
        })
        .select("id")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not create maintenance plan.")
      return { id: data.id, label: p.name, href: "/maintenance-plans", message: "Maintenance plan created." }
    },
  },
  create_invoice: {
    type: "create_invoice",
    label: "Create Invoice",
    description: "Create a draft invoice. This does not send email or collect payment.",
    schema: createInvoiceSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createInvoiceSchema>
      const { data, error } = await ctx.supabase
        .from("org_invoices")
        .insert({
          organization_id: ctx.organizationId,
          customer_id: p.customerId,
          equipment_id: p.equipmentId ?? null,
          seed_key: `aiden-${crypto.randomUUID()}`,
          title: p.title.trim(),
          amount_cents: p.amountCents,
          status: "draft",
          issued_at: p.issuedAt ?? new Date().toISOString().slice(0, 10),
          created_by: ctx.userId,
        })
        .select("id")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not create invoice.")
      return { id: data.id, label: p.title, href: "/invoices", message: "Draft invoice created." }
    },
  },
  create_quote: {
    type: "create_quote",
    label: "Create Quote",
    description: "Create a draft quote. This does not send it to the customer.",
    schema: createQuoteSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof createQuoteSchema>
      const { data, error } = await ctx.supabase
        .from("org_quotes")
        .insert({
          organization_id: ctx.organizationId,
          customer_id: p.customerId,
          seed_key: `aiden-${crypto.randomUUID()}`,
          title: p.title.trim(),
          amount_cents: p.amountCents,
          status: "draft",
          created_by: ctx.userId,
        })
        .select("id")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not create quote.")
      return { id: data.id, label: p.title, href: "/quotes", message: "Draft quote created." }
    },
  },
  schedule_work_order: {
    type: "schedule_work_order",
    label: "Schedule Work Order",
    description: "Schedule an existing work order.",
    schema: scheduleWorkOrderSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof scheduleWorkOrderSchema>
      const { data, error } = await ctx.supabase
        .from("work_orders")
        .update({
          scheduled_on: p.scheduledOn,
          scheduled_time: p.scheduledTime ?? null,
          assigned_user_id: p.assignedUserId ?? null,
          status: "scheduled",
        })
        .eq("organization_id", ctx.organizationId)
        .eq("id", p.workOrderId)
        .select("id, title")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not schedule work order.")
      return { id: data.id, label: data.title ?? "Work order", href: `/work-orders/${data.id}`, message: "Work order scheduled." }
    },
  },
  assign_technician: {
    type: "assign_technician",
    label: "Assign Technician",
    description: "Assign a technician to an existing work order.",
    schema: assignTechnicianSchema,
    async execute(ctx, payload) {
      const p = payload as z.infer<typeof assignTechnicianSchema>
      const { data, error } = await ctx.supabase
        .from("work_orders")
        .update({ assigned_user_id: p.assignedUserId })
        .eq("organization_id", ctx.organizationId)
        .eq("id", p.workOrderId)
        .select("id, title")
        .single()
      if (error || !data?.id) throw new Error(error?.message ?? "Could not assign technician.")
      return { id: data.id, label: data.title ?? "Work order", href: `/work-orders/${data.id}`, message: "Technician assigned." }
    },
  },
}

export function getAidenActionDefinition(type: AidenActionType): AidenActionDefinition | null {
  return AIDEN_ACTION_REGISTRY[type] ?? null
}
