import type { SupabaseClient } from "@supabase/supabase-js"

export type LinkedInvoiceRow = {
  id: string
  status: string
  portal_certificate_release_override: string | null
}

/**
 * Invoices associated with a work order (legacy `work_order_id` + junction `invoice_work_order_links`).
 */
export async function fetchInvoicesLinkedToWorkOrder(
  svc: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<LinkedInvoiceRow[]> {
  const m = await fetchInvoicesLinkedToWorkOrdersBatch(svc, organizationId, [workOrderId])
  return m.get(workOrderId) ?? []
}

/** Batch-load invoice rows keyed by work order id (deduped per WO). */
export async function fetchInvoicesLinkedToWorkOrdersBatch(
  svc: SupabaseClient,
  organizationId: string,
  workOrderIds: string[],
): Promise<Map<string, LinkedInvoiceRow[]>> {
  const map = new Map<string, LinkedInvoiceRow[]>()
  for (const w of workOrderIds) map.set(w, [])
  if (workOrderIds.length === 0) return map

  const [directRes, linkRes] = await Promise.all([
    svc
      .from("org_invoices")
      .select("id, status, portal_certificate_release_override, work_order_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds),
    svc
      .from("invoice_work_order_links")
      .select("invoice_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds),
  ])

  if (directRes.error) throw new Error(directRes.error.message)
  if (linkRes.error) throw new Error(linkRes.error.message)

  const byWo = new Map<string, Map<string, LinkedInvoiceRow>>()

  function addRow(woId: string, row: LinkedInvoiceRow) {
    let inner = byWo.get(woId)
    if (!inner) {
      inner = new Map()
      byWo.set(woId, inner)
    }
    inner.set(row.id, row)
  }

  for (const row of (directRes.data ?? []) as Array<{
    id: string
    status: string
    portal_certificate_release_override: string | null
    work_order_id: string | null
  }>) {
    if (!row.work_order_id) continue
    addRow(row.work_order_id, {
      id: row.id,
      status: row.status,
      portal_certificate_release_override: row.portal_certificate_release_override,
    })
  }

  const linkedInvoiceIds = new Set<string>()
  for (const row of (linkRes.data ?? []) as Array<{ invoice_id: string; work_order_id: string }>) {
    linkedInvoiceIds.add(row.invoice_id)
  }

  let invById = new Map<string, LinkedInvoiceRow>()
  if (linkedInvoiceIds.size > 0) {
    const { data: invRows, error } = await svc
      .from("org_invoices")
      .select("id, status, portal_certificate_release_override")
      .eq("organization_id", organizationId)
      .in("id", [...linkedInvoiceIds])
    if (error) throw new Error(error.message)
    invById = new Map(
      ((invRows ?? []) as LinkedInvoiceRow[]).map((r) => [r.id, r]),
    )
  }

  for (const row of (linkRes.data ?? []) as Array<{ invoice_id: string; work_order_id: string }>) {
    const inv = invById.get(row.invoice_id)
    if (inv) addRow(row.work_order_id, inv)
  }

  for (const woId of workOrderIds) {
    const inner = byWo.get(woId)
    map.set(woId, inner ? [...inner.values()] : [])
  }

  return map
}

/** True when every linked invoice is paid (draft excluded from blocking when none?). */
export function allLinkedInvoicesPaid(invoices: LinkedInvoiceRow[]): boolean {
  if (invoices.length === 0) return true
  return invoices.every((i) => i.status === "paid")
}
