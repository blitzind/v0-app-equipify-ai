import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildCertificateEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

type Body = {
  organizationId?: string
  workOrderId?: string
  to?: string
  equipmentId?: string
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
  const equipmentScopeId = typeof body.equipmentId === "string" ? parseUuid(body.equipmentId) : null
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
    .select("id, customer_id, equipment_id, title, work_order_number")
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
    woSel = await supabase
      .from("work_orders")
      .select("id, customer_id, equipment_id, title")
      .eq("id", workOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle()
  }

  const wo = woSel.data as
    | {
        id: string
        customer_id: string
        equipment_id: string
        title: string
        work_order_number?: number | null
      }
    | null

  if (woSel.error || !wo) {
    return NextResponse.json({ error: "not_found", message: "Work order not found." }, { status: 404 })
  }

  const targetEquipmentId = equipmentScopeId ?? wo.equipment_id
  const { data: rec } = await supabase
    .from("calibration_records")
    .select("id, template_id")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .eq("equipment_id", targetEquipmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!rec) {
    return NextResponse.json(
      {
        error: "no_certificate",
        message: "Save a certificate record on this work order before emailing.",
      },
      { status: 400 },
    )
  }

  let templateName: string | null = null
  if (rec.template_id) {
    const { data: tmpl } = await supabase
      .from("calibration_templates")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", rec.template_id as string)
      .maybeSingle()
    templateName = (tmpl as { name?: string } | null)?.name ?? null
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
      .eq("id", targetEquipmentId)
      .maybeSingle(),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"
  const equipmentName = (equip as { name?: string } | null)?.name?.trim() || "Equipment"

  const woLabel = getWorkOrderDisplay({
    id: wo.id,
    workOrderNumber: wo.work_order_number ?? undefined,
  })

  const recordHint = `Certificate record ${String((rec as { id: string }).id).slice(0, 8)}…`

  const { subject, html, text } = buildCertificateEmailContent({
    organizationName,
    customerName,
    equipmentName,
    workOrderLabel: woLabel,
    templateName,
    recordHint,
  })

  const sendResult = await sendEmail({ to, subject, html, text })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

  return NextResponse.json({ ok: true, emailId: sendResult.id })
}
