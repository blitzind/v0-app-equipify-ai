import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  buildEqualInstallmentPlan,
  buildTwentyFiveFiftyTwentyFivePlan,
  installmentTargetsMatchTotal,
  type PlanInstallmentDraft,
} from "@/lib/blitzpay/blitzpay-payment-plan-math"
import { assertInvoiceLinkedToWorkOrder } from "@/lib/blitzpay/work-order-invoice-link"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

export type BlitzpayPaymentPlanTemplate = "stages_25_50_25" | "equal_3" | "equal_6"

function installmentsForTemplate(totalCents: number, template: BlitzpayPaymentPlanTemplate): PlanInstallmentDraft[] {
  switch (template) {
    case "stages_25_50_25":
      return buildTwentyFiveFiftyTwentyFivePlan(totalCents)
    case "equal_3":
      return buildEqualInstallmentPlan(totalCents, 3)
    case "equal_6":
      return buildEqualInstallmentPlan(totalCents, 6)
    default:
      return []
  }
}

function planKindForTemplate(template: BlitzpayPaymentPlanTemplate): "percentage_stages" | "fixed_count" {
  return template === "stages_25_50_25" ? "percentage_stages" : "fixed_count"
}

export async function fetchActivePaymentPlanForInvoice(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<{
  plan: { id: string; status: string; planKind: string; totalTargetCents: number }
  installments: Array<{
    id: string
    sequence: number
    title: string
    dueOn: string | null
    targetCents: number
    paidCents: number
    status: string
  }>
} | null> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  const { data: plan, error: pErr } = await admin
    .from("blitzpay_payment_plans")
    .select("id, status, plan_kind, total_target_cents")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pErr || !plan) return null
  const pid = (plan as { id: string }).id
  const { data: rows, error: iErr } = await admin
    .from("blitzpay_payment_plan_installments")
    .select("id, sequence, title, due_on, target_cents, paid_cents, status")
    .eq("payment_plan_id", pid)
    .order("sequence", { ascending: true })
  if (iErr) throw new Error(iErr.message)
  const installments = (rows ?? []).map((r) => {
    const x = r as {
      id: string
      sequence: number
      title: string
      due_on: string | null
      target_cents: number
      paid_cents: number
      status: string
    }
    return {
      id: x.id,
      sequence: Math.round(Number(x.sequence)),
      title: String(x.title ?? ""),
      dueOn: x.due_on,
      targetCents: Math.round(Number(x.target_cents)),
      paidCents: Math.round(Number(x.paid_cents)),
      status: String(x.status),
    }
  })
  const pr = plan as { id: string; status: string; plan_kind: string; total_target_cents: number }
  return {
    plan: {
      id: pr.id,
      status: pr.status,
      planKind: pr.plan_kind,
      totalTargetCents: Math.round(Number(pr.total_target_cents)),
    },
    installments,
  }
}

export async function createPaymentPlanForInvoiceFromTemplate(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string
    template: BlitzpayPaymentPlanTemplate
    idempotencyKey: string
    /** When set, plan row is anchored to this WO (must be linked to the invoice). */
    workOrderId?: string | null
  },
): Promise<{ planId: string; duplicate: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.invoiceId, "invoiceId")
  const idem = input.idempotencyKey.trim()
  if (!idem) throw new Error("idempotencyKey required")

  const { data: inv, error: invErr } = await admin
    .from("org_invoices")
    .select("id, organization_id, amount_cents, tax_amount_cents, status")
    .eq("id", input.invoiceId)
    .maybeSingle()
  if (invErr) throw new Error(invErr.message)
  if (!inv || String((inv as { organization_id: string }).organization_id) !== input.organizationId) {
    throw new Error("invoice_not_found")
  }
  const st = String((inv as { status?: string }).status ?? "").toLowerCase()
  if (st === "void" || st === "draft") throw new Error("invoice_not_eligible")

  const amt = Math.round(Number((inv as { amount_cents: number }).amount_cents ?? 0))
  const tax = Math.round(Number((inv as { tax_amount_cents?: number | null }).tax_amount_cents ?? 0))
  const totalTargetCents = Math.max(0, amt + tax)

  let workOrderId: string | null = null
  if (input.workOrderId && String(input.workOrderId).trim()) {
    const wo = String(input.workOrderId).trim()
    const ok = await assertInvoiceLinkedToWorkOrder(admin, input.organizationId, input.invoiceId, wo)
    if (!ok) throw new Error("work_order_not_linked_to_invoice")
    workOrderId = wo
  }

  const drafts = installmentsForTemplate(totalTargetCents, input.template)
  if (drafts.length === 0 || !installmentTargetsMatchTotal(drafts, totalTargetCents)) {
    throw new Error("invalid_installment_schedule")
  }

  const { data: existing } = await admin
    .from("blitzpay_payment_plans")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", idem)
    .maybeSingle()
  if (existing) {
    return { planId: (existing as { id: string }).id, duplicate: true }
  }

  const now = new Date().toISOString()

  await admin
    .from("blitzpay_payment_plans")
    .update({ status: "canceled", updated_at: now })
    .eq("organization_id", input.organizationId)
    .eq("org_invoice_id", input.invoiceId)
    .in("status", ["active", "draft"])

  const { data: inserted, error: insErr } = await admin
    .from("blitzpay_payment_plans")
    .insert({
      organization_id: input.organizationId,
      org_invoice_id: input.invoiceId,
      org_quote_id: null,
      work_order_id: workOrderId,
      plan_kind: planKindForTemplate(input.template),
      status: "active",
      currency: "usd",
      total_target_cents: totalTargetCents,
      idempotency_key: idem,
      metadata: { template: input.template },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle()

  if (insErr) {
    if (isUniqueViolation(insErr)) {
      const { data: again } = await admin
        .from("blitzpay_payment_plans")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("idempotency_key", idem)
        .maybeSingle()
      if (again) return { planId: (again as { id: string }).id, duplicate: true }
    }
    throw new Error(insErr.message)
  }
  if (!inserted) throw new Error("plan_create_failed")

  const planId = (inserted as { id: string }).id

  const instRows = drafts.map((d) => ({
    payment_plan_id: planId,
    sequence: d.sequence,
    title: d.title,
    due_on: d.dueOn,
    target_cents: d.targetCents,
    percent_bps: d.percentBps ?? null,
    status: "pending",
    paid_cents: 0,
    created_at: now,
    updated_at: now,
  }))

  const { error: instErr } = await admin.from("blitzpay_payment_plan_installments").insert(instRows)
  if (instErr) {
    await admin.from("blitzpay_payment_plans").delete().eq("id", planId)
    throw new Error(instErr.message)
  }

  return { planId, duplicate: false }
}
