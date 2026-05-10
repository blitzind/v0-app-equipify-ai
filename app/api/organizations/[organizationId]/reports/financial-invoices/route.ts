import { NextRequest, NextResponse } from "next/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import {
  computeFinancialInvoicesReport,
  type FinancialInvoiceWorkflowStatus,
  type FinancialPaymentStatusFilter,
} from "@/lib/reporting/financial-invoices-report"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WORKFLOW: FinancialInvoiceWorkflowStatus[] = [
  "all",
  "draft",
  "sent",
  "unpaid",
  "paid",
  "overdue",
  "void",
]

const PAYMENT_ALLOC: FinancialPaymentStatusFilter[] = ["all", "unpaid", "partial", "paid", "overpaid"]

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function parseBool(v: string | null, defaultVal: boolean): boolean {
  if (v === null || v === "") return defaultVal
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes"
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid organization.", 400)
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const { supabase } = gate

  const sp = request.nextUrl.searchParams
  const from = sp.get("from") ?? ""
  const to = sp.get("to") ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return jsonError("Query params `from` and `to` (YYYY-MM-DD) are required.", 400)
  }
  if (from > to) {
    return jsonError("`from` must be on or before `to`.", 400)
  }

  const customerRaw = sp.get("customerId")
  const customerId = customerRaw && customerRaw !== "all" ? customerRaw : null

  const invoiceStatus = (sp.get("invoiceStatus") ?? "all") as FinancialInvoiceWorkflowStatus
  if (!WORKFLOW.includes(invoiceStatus)) {
    return jsonError("Invalid invoiceStatus.", 400)
  }

  const paymentStatus = (sp.get("paymentStatus") ?? "all") as FinancialPaymentStatusFilter
  if (!PAYMENT_ALLOC.includes(paymentStatus)) {
    return jsonError("Invalid paymentStatus.", 400)
  }

  const invoicedInPeriodOnly = parseBool(sp.get("invoicedInPeriodOnly"), false)
  const includeArchived = parseBool(sp.get("includeArchived"), false)

  try {
    const payload = await computeFinancialInvoicesReport(supabase, organizationId, {
      from,
      to,
      invoicedInPeriodOnly,
      customerId,
      invoiceStatus,
      paymentStatus,
      includeArchived,
    })
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[reports/financial-invoices]", e)
    return jsonError(e instanceof Error ? e.message : "Failed to compute financial report.", 500)
  }
}
