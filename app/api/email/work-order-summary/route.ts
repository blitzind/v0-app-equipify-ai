import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import {
  buildAppointmentConfirmationEmailContent,
  buildWorkOrderSummaryEmailContent,
} from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { canAccessAssignedWorkResource } from "@/lib/permissions/technician-scope"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { logCommunicationEvent } from "@/lib/notifications/log-event"

type Variant = "summary" | "appointment_confirmation"

type Body = {
  organizationId?: string
  workOrderId?: string
  to?: string
  message?: string
  /**
   * Phase: Scheduling Field-Speed Polish — switch the email body between the
   * post-completion summary (default) and a pre-service appointment
   * confirmation. Both share permissions, send infrastructure, and
   * communication-log shape; only the template differs.
   */
  variant?: Variant
}

function isVariant(v: unknown): v is Variant {
  return v === "summary" || v === "appointment_confirmation"
}

function formatScheduledDate(ymd: string | null | undefined): string | null {
  if (!ymd) return null
  // Use noon to avoid TZ midnight rollovers in tabular UIs.
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatScheduledTime(hhmm: string | null | undefined): string | null {
  if (!hhmm || typeof hhmm !== "string") return null
  const [hStr, mStr] = hhmm.split(":")
  const h = Number.parseInt(hStr ?? "", 10)
  const m = Number.parseInt(mStr ?? "0", 10)
  if (!Number.isFinite(h)) return null
  const d = new Date()
  d.setHours(h, Number.isFinite(m) ? m : 0, 0, 0)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function workOrderStatusLabel(db: string): string {
  switch (db) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "completed_pending_signature":
      return "Completed (pending signature)"
    case "invoiced":
      return "Invoiced"
    default:
      return db.replace(/_/g, " ")
  }
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = parseUuid(body.organizationId)
  const workOrderId = parseUuid(body.workOrderId)
  const to = typeof body.to === "string" ? body.to.trim() : ""
  const variant: Variant = isVariant(body.variant) ? body.variant : "summary"

  if (!organizationId || !workOrderId) {
    return NextResponse.json({ error: "invalid_payload", message: "organizationId and workOrderId are required." }, { status: 400 })
  }
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "invalid_recipient", message: "Enter a valid recipient email address." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to send email." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "You do not have access to this organization." }, { status: 403 })
  }

  // Phase 2 (Permissions): allow staff that can edit work orders OR manage
  // dispatch to send the summary email. Viewers stay read-only.
  const capGate = await requireAnyOrgPermission(organizationId, [
    "canEditWorkOrders",
    "canManageDispatch",
  ])
  if ("error" in capGate) return capGate.error

  let woSel = await supabase
    .from("work_orders")
    .select(
      "id, customer_id, equipment_id, title, status, completed_at, notes, work_order_number, scheduled_on, scheduled_time, assigned_user_id",
    )
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
    woSel = await supabase
      .from("work_orders")
      .select(
        "id, customer_id, equipment_id, title, status, completed_at, notes, scheduled_on, scheduled_time, assigned_user_id",
      )
      .eq("id", workOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle()
  }

  type WoRow = {
    id: string
    customer_id: string
    equipment_id: string | null
    title: string
    status: string
    completed_at: string | null
    notes: string | null
    work_order_number?: number | null
    scheduled_on?: string | null
    scheduled_time?: string | null
    assigned_user_id?: string | null
  }

  const wo = woSel.data as WoRow | null

  if (woSel.error || !wo) {
    return NextResponse.json({ error: "not_found", message: "Work order not found." }, { status: 404 })
  }
  const allowedWorkOrder = await canAccessAssignedWorkResource(supabase, {
    organizationId,
    userId: user.id,
    permissions: capGate.permissions,
    resource: { workOrderId },
  })
  if (!allowedWorkOrder) {
    return NextResponse.json({ error: "not_found", message: "Work order not found." }, { status: 404 })
  }

  const [{ data: org }, { data: cust }, { data: equip }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", wo.customer_id)
      .maybeSingle(),
    wo.equipment_id
      ? supabase
          .from("equipment")
          .select("name")
          .eq("organization_id", organizationId)
          .eq("id", wo.equipment_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"
  const equipmentName = (equip as { name?: string } | null)?.name?.trim() || "Service visit"

  const woLabel = getWorkOrderDisplay({
    id: wo.id,
    workOrderNumber: wo.work_order_number ?? undefined,
  })

  const completedAtLabel =
    wo.completed_at ?
      new Date(wo.completed_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  const locationLine = wo.notes?.trim() ? `Notes on file: ${wo.notes.trim().slice(0, 160)}` : null

  const messagePlain = typeof body.message === "string" ? body.message : undefined

  let technicianLabel: string | null = null
  if (variant === "appointment_confirmation" && wo.assigned_user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", wo.assigned_user_id)
      .maybeSingle()
    const profRow = prof as { full_name?: string | null; email?: string | null } | null
    technicianLabel =
      (profRow?.full_name && profRow.full_name.trim()) ||
      (profRow?.email && profRow.email.trim()) ||
      null
  }

  const { subject, html, text } =
    variant === "appointment_confirmation"
      ? buildAppointmentConfirmationEmailContent({
          organizationName,
          customerName,
          equipmentName,
          workOrderLabel: woLabel,
          scheduledDateLabel:
            formatScheduledDate(wo.scheduled_on ?? null) ?? "Date to be confirmed",
          scheduledTimeLabel: formatScheduledTime(wo.scheduled_time ?? null),
          technicianLabel,
          locationLine,
          messagePlain,
        })
      : buildWorkOrderSummaryEmailContent({
          organizationName,
          customerName,
          equipmentName,
          workOrderLabel: woLabel,
          statusLabel: workOrderStatusLabel(wo.status),
          locationLine,
          completedAtLabel,
          messagePlain,
        })

  const sendResult = await sendEmail({
    to,
    subject,
    html,
    text,
    category: variant === "appointment_confirmation" ? "work_order_appointment_confirmation" : "work_order_summary",
    organizationId,
  })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

  const sentAt = new Date().toISOString()

  const isConfirmation = variant === "appointment_confirmation"
  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "email",
    eventType: isConfirmation
      ? "appointment_confirmation_email"
      : "work_order_summary_email",
    title: `${isConfirmation ? "Appointment confirmation" : "Work order summary"} emailed: ${woLabel}`,
    summary: `To ${to}`,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: wo.customer_id,
    recipientAddress: to,
    relatedEntityType: "work_order",
    relatedEntityId: workOrderId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: user.id,
  })

  return NextResponse.json({ ok: true, emailId: sendResult.id, sentAt, variant })
}
