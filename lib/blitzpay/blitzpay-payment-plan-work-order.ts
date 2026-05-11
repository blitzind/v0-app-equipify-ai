import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { assertInvoiceLinkedToWorkOrder } from "@/lib/blitzpay/work-order-invoice-link"

/**
 * Attach a work order to an active payment plan anchored on an invoice linked to that WO.
 * Does not move money; updates `blitzpay_payment_plans.work_order_id` only.
 */
export async function attachWorkOrderToPaymentPlan(
  admin: SupabaseClient,
  input: {
    organizationId: string
    paymentPlanId: string
    workOrderId: string
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.paymentPlanId, "paymentPlanId")
  assertUuid(input.workOrderId, "workOrderId")

  const { data: plan, error: pErr } = await admin
    .from("blitzpay_payment_plans")
    .select("id, organization_id, org_invoice_id, status, work_order_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.paymentPlanId)
    .maybeSingle()
  if (pErr || !plan) return { ok: false, code: "plan_not_found", message: "Payment plan not found." }
  const row = plan as {
    org_invoice_id: string | null
    status: string
    work_order_id: string | null
  }
  if (String(row.status) !== "active") {
    return { ok: false, code: "plan_not_active", message: "Only active plans can be linked to a work order." }
  }
  const invId = row.org_invoice_id
  if (!invId) return { ok: false, code: "plan_not_invoice", message: "Plan is not anchored to an invoice." }
  const linked = await assertInvoiceLinkedToWorkOrder(admin, input.organizationId, invId, input.workOrderId)
  if (!linked) {
    return { ok: false, code: "invoice_not_on_work_order", message: "Invoice is not linked to this work order." }
  }
  if (row.work_order_id && row.work_order_id !== input.workOrderId) {
    return { ok: false, code: "plan_already_linked", message: "Plan is already linked to another work order." }
  }
  const now = new Date().toISOString()
  const { error: uErr } = await admin
    .from("blitzpay_payment_plans")
    .update({ work_order_id: input.workOrderId, updated_at: now })
    .eq("organization_id", input.organizationId)
    .eq("id", input.paymentPlanId)
  if (uErr) return { ok: false, code: "update_failed", message: uErr.message }
  return { ok: true }
}
