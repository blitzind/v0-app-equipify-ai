import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import {
  isCalibrationRecordComplete,
  listCalibrationTemplates,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { dispatchCustomerInvoiceEmail } from "@/lib/invoices/dispatch-customer-invoice-email"

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

  const capGate = await requireOrgPermission(organizationId, "canEditInvoices")
  if ("error" in capGate) return capGate.error

  const docCtx = await loadInvoiceDocumentContext(supabase, organizationId, invoiceId)
  if (!docCtx) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  let certificatesList: { equipmentLabel: string; templateName: string | null }[] = []
  let legacyCertificate: { included: boolean; templateName: string | null } | undefined

  if (docCtx.workOrderId) {
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
      .eq("work_order_id", docCtx.workOrderId)
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

  if (certificatesList.length === 0 && docCtx.calibrationRecordId) {
    const { data: r } = await supabase
      .from("calibration_records")
      .select("template_id")
      .eq("organization_id", organizationId)
      .eq("id", docCtx.calibrationRecordId)
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

  const messagePlain = typeof body.message === "string" ? body.message : undefined
  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined

  const dispatched = await dispatchCustomerInvoiceEmail({
    supabase,
    organizationId,
    invoiceId,
    to,
    subjectOverride,
    messagePlain,
    variant: "send",
    blitzpayStaffUserId: user.id,
    certificatesList: certificatesList.length > 0 ? certificatesList : undefined,
    certificate: certificatesList.length > 0 ? undefined : legacyCertificate,
    documentContext: docCtx,
  })

  if (!dispatched.ok) {
    const status = dispatched.code === "config" ? 503 : 502
    return NextResponse.json({ error: dispatched.code, message: dispatched.message }, { status })
  }

  const sendResult = dispatched.send
  const invoiceLabel = docCtx.invoiceNumberLabel

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

  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "email",
    eventType: "invoice_email",
    title: `Invoice emailed: ${invoiceLabel}`,
    summary: `To ${to}`,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: docCtx.customerId,
    recipientAddress: to,
    relatedEntityType: "invoice",
    relatedEntityId: invoiceId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: user.id,
    metadata: { variant, pdfAttached: dispatched.pdfAttached },
  })

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
