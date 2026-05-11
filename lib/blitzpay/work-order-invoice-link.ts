import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

/** True when the invoice is the legacy WO anchor or linked via junction. */
export async function assertInvoiceLinkedToWorkOrder(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  workOrderId: string,
): Promise<boolean> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  assertUuid(workOrderId, "workOrderId")
  const { data: inv, error } = await admin
    .from("org_invoices")
    .select("id, work_order_id")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()
  if (error || !inv) return false
  const wid = (inv as { work_order_id?: string | null }).work_order_id
  if (wid && wid === workOrderId) return true
  const { data: link } = await admin
    .from("invoice_work_order_links")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .eq("work_order_id", workOrderId)
    .maybeSingle()
  return Boolean(link)
}
