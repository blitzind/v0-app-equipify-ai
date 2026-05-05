import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceCustomerEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import {
  isCalibrationRecordComplete,
  listCalibrationTemplates,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"

type Body = {
  organizationId?: string
  invoiceId?: string
  to?: string
  subject?: string
  message?: string
  variant?: "send" | "resend"
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = parseUuid(body.organizationId)
  const invoiceId = parseUuid(body.invoiceId)
  const to = typeof body.to === "string" ? body.to.trim() : ""
  const variant = body.variant === "resend" ? "resend" : "send"

  if (!organizationId || !invoiceId) {
    return NextResponse.json(
      { error: "invalid_payload", message: "organizationId and invoiceId are required." },
      { status: 400 },
    )
  }
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "invalid_recipient", message: "Enter a valid recipient email address." },
      { status: 400 },
    )
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
    return NextResponse.json(
      { error: "forbidden", message: "You do not have access to this organization." },
      { status: 403 },
    )
  }

  const { data: invRow, error: invErr } = await supabase
    .from("org_invoices")
    .select(
      "id, customer_id, equipment_id, work_order_id, calibration_record_id, invoice_number, title, amount_cents, status, due_date, issued_at, archived_at",
    )
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const inv = invRow as {
    id: string
    customer_id: string
    equipment_id: string | null
    work_order_id: string | null
    calibration_record_id: string | null
    invoice_number?: string
    amount_cents?: number
    status?: string
    due_date?: string | null
    issued_at?: string | null
    archived_at?: string | null
  } | null

  if (invErr || !inv || inv.archived_at) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  if ((inv.status as string) === "void") {
    return NextResponse.json({ error: "invalid_status", message: "Cannot email a void invoice." }, { status: 400 })
  }

  const [{ data: org }, { data: cust }, equipRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", inv.customer_id)
      .maybeSingle(),
    inv.equipment_id ?
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", inv.equipment_id)
        .maybeSingle()
    : Promise.resolve({ data: null }),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"
  const equipmentName =
    equipRes.data && typeof equipRes.data === "object" && "name" in equipRes.data
      ? String((equipRes.data as { name: string }).name).trim() || null
    : null

  let workOrderLabel: string | null = null
  if (inv.work_order_id) {
    let woSel = await supabase
      .from("work_orders")
      .select("id, work_order_number")
      .eq("id", inv.work_order_id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
      woSel = await supabase
        .from("work_orders")
        .select("id")
        .eq("id", inv.work_order_id)
        .eq("organization_id", organizationId)
        .maybeSingle()
    }

    const wo = woSel.data as { id: string; work_order_number?: number | null } | null
    if (!woSel.error && wo) {
      workOrderLabel = getWorkOrderDisplay({
        id: wo.id,
        workOrderNumber: wo.work_order_number ?? undefined,
      })
    }
  }

  let certificatesList: { equipmentLabel: string; templateName: string | null }[] = []
  let legacyCertificate: { included: boolean; templateName: string | null } | undefined

  if (inv.work_order_id) {
    type RecRow = {
      equipment_id: string
      template_id: string
      values: unknown
      created_at: string
    }
    const { data: recRows } = await supabase
      .from("calibration_records")
      .select("equipment_id, template_id, values, created_at")
      .eq("organization_id", organizationId)
      .eq("work_order_id", inv.work_order_id)
      .order("created_at", { ascending: false })

    const rows = (recRows ?? []) as RecRow[]
    const latestByEquipment = new Map<string, RecRow>()
    for (const row of rows) {
      if (!latestByEquipment.has(row.equipment_id)) latestByEquipment.set(row.equipment_id, row)
    }

    let templateById = new Map<string, CalibrationTemplate>()
    try {
      const allTmpl = await listCalibrationTemplates(supabase, organizationId)
      templateById = new Map(allTmpl.map((t) => [t.id, t]))
    } catch {
      templateById = new Map()
    }

    const completedByEquipment = new Map<string, RecRow>()
    for (const [eqId, rec] of latestByEquipment) {
      const tmpl = templateById.get(rec.template_id)
      if (!tmpl) continue
      const values =
        rec.values && typeof rec.values === "object" && !Array.isArray(rec.values)
          ? (rec.values as Record<string, unknown>)
          : {}
      if (isCalibrationRecordComplete(tmpl, values)) {
        completedByEquipment.set(eqId, rec)
      }
    }

    const equipIds = [...completedByEquipment.keys()]
    const tmplNameIds = [...new Set([...completedByEquipment.values()].map((r) => r.template_id))]

    const [{ data: eqRows }, { data: nameRows }] = await Promise.all([
      equipIds.length ?
        supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", equipIds)
      : Promise.resolve({ data: [] }),
      tmplNameIds.length ?
        supabase
          .from("calibration_templates")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("id", tmplNameIds)
      : Promise.resolve({ data: [] }),
    ])

    const eqMap = new Map(
      ((eqRows ?? []) as Array<{
        id: string
        name: string
        equipment_code: string | null
        serial_number: string | null
        category: string | null
      }>).map((e) => [e.id, e]),
    )
    const tmMap = new Map(((nameRows ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]))

    certificatesList = [...completedByEquipment.entries()].map(([eqId, rec]) => {
      const e = eqMap.get(eqId)
      const equipmentLabel = e
        ? getEquipmentDisplayPrimary({
            id: eqId,
            name: e.name,
            equipment_code: e.equipment_code,
            serial_number: e.serial_number,
            category: e.category,
          })
        : "Equipment"
      return {
        equipmentLabel,
        templateName: tmMap.get(rec.template_id)?.trim() ?? null,
      }
    })
  }

  if (certificatesList.length === 0 && inv.calibration_record_id) {
    const { data: r } = await supabase
      .from("calibration_records")
      .select("template_id")
      .eq("organization_id", organizationId)
      .eq("id", inv.calibration_record_id)
      .maybeSingle()
    if (r && typeof r === "object" && "template_id" in r) {
      const { data: tmpl } = await supabase
        .from("calibration_templates")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", (r as { template_id: string }).template_id)
        .maybeSingle()
      legacyCertificate = {
        included: true,
        templateName: (tmpl as { name?: string } | null)?.name?.trim() ?? null,
      }
    }
  }

  const invoiceLabel = String(inv.invoice_number ?? "").trim() || "Invoice"
  const amountCents = Number(inv.amount_cents ?? 0)
  const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amountCents / 100,
  )
  const dueRaw = inv.due_date
  const dueDateLabel = dueRaw
    ? new Date(dueRaw + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—"
  const issuedRaw = inv.issued_at
  const issuedDateLabel = issuedRaw
    ? new Date(issuedRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"

  const messagePlain = typeof body.message === "string" ? body.message : undefined
  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined

  const { subject, html, text } = buildInvoiceCustomerEmailContent({
    organizationName,
    customerName,
    invoiceLabel,
    amountLabel,
    dueDateLabel,
    issuedDateLabel,
    workOrderLabel,
    equipmentName,
    messagePlain,
    subjectOverride,
    certificatesList: certificatesList.length > 0 ? certificatesList : undefined,
    certificate: certificatesList.length > 0 ? undefined : legacyCertificate,
  })

  const sendResult = await sendEmail({ to, subject, html, text })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

  const sentAt = new Date().toISOString()
  const rowPatch: Record<string, unknown> =
    variant === "resend"
      ? { sent_at: sentAt }
      : { status: invoiceStatusUiToDb("Sent" as InvoiceStatus), sent_at: sentAt }

  const { error: upErr } = await supabase
    .from("org_invoices")
    .update(rowPatch)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: "Email may have been delivered but the invoice status could not be updated.",
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
