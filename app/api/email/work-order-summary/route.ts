import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildWorkOrderSummaryEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"

type Body = {
  organizationId?: string
  workOrderId?: string
  to?: string
  message?: string
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

  let woSel = await supabase
    .from("work_orders")
    .select("id, customer_id, equipment_id, title, status, completed_at, notes, work_order_number")
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
    woSel = await supabase
      .from("work_orders")
      .select("id, customer_id, equipment_id, title, status, completed_at, notes")
      .eq("id", workOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle()
  }

  type WoRow = {
    id: string
    customer_id: string
    equipment_id: string
    title: string
    status: string
    completed_at: string | null
    notes: string | null
    work_order_number?: number | null
  }

  const wo = woSel.data as WoRow | null

  if (woSel.error || !wo) {
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
    supabase
      .from("equipment")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", wo.equipment_id)
      .maybeSingle(),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"
  const equipmentName = (equip as { name?: string } | null)?.name?.trim() || "Equipment"

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

  const { subject, html, text } = buildWorkOrderSummaryEmailContent({
    organizationName,
    customerName,
    equipmentName,
    workOrderLabel: woLabel,
    statusLabel: workOrderStatusLabel(wo.status),
    locationLine,
    completedAtLabel,
    messagePlain,
  })

  const sendResult = await sendEmail({ to, subject, html, text })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

  return NextResponse.json({ ok: true, emailId: sendResult.id })
}
