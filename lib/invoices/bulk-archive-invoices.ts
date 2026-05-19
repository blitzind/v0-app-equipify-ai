import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"
import { invoiceBulkArchiveBlockMessage } from "@/lib/invoices/bulk-archive-eligibility"
import { invoiceAlreadyArchivedMessage } from "@/lib/invoices/bulk-archive-messages"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"

export type BulkArchiveInvoiceResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

type InvoiceRow = {
  id: string
  archived_at: string | null
  status: string
  paid_at: string | null
  sent_at: string | null
  amount_cents: number | null
  tax_amount_cents: number | null
}

function netPaymentsCents(
  payments: Array<{ invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const p of payments) {
    if (p.invoice_id !== invoiceId) continue
    sum += Math.round(Number(p.amount_cents) || 0)
  }
  return sum
}

function netRefundsCents(
  refunds: Array<{ org_invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const r of refunds) {
    if (r.org_invoice_id !== invoiceId) continue
    sum += Math.round(Number(r.amount_cents) || 0)
  }
  return sum
}

export async function bulkArchiveInvoices(
  svc: SupabaseClient,
  organizationId: string,
  invoiceIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveInvoiceResult[] }> {
  const unique = [...new Set(invoiceIds)]
  const results: BulkArchiveInvoiceResult[] = []
  const now = new Date().toISOString()

  const [payRes, refundRes, mapRes] = await Promise.all([
    unique.length
      ? svc
          .from("org_invoice_payments")
          .select("invoice_id, amount_cents")
          .eq("organization_id", organizationId)
          .in("invoice_id", unique)
      : Promise.resolve({ data: [] as unknown[] }),
    unique.length
      ? svc
          .from("blitzpay_invoice_refunds")
          .select("org_invoice_id, amount_cents")
          .eq("organization_id", organizationId)
          .in("org_invoice_id", unique)
          .eq("status", "succeeded")
      : Promise.resolve({ data: [] as unknown[] }),
    unique.length
      ? svc
          .from("external_sync_mappings")
          .select("internal_id, external_id, last_synced_at")
          .eq("organization_id", organizationId)
          .eq("provider", "quickbooks_online")
          .eq("entity_type", "invoice")
          .in("internal_id", unique)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const payments = (payRes.data ?? []) as Array<{ invoice_id: string; amount_cents: number | null }>
  const refunds = (refundRes.data ?? []) as Array<{ org_invoice_id: string; amount_cents: number | null }>

  const exportedIds = new Set<string>()
  for (const m of (mapRes.data ?? []) as Array<{
    internal_id: string
    external_id?: string | null
    last_synced_at?: string | null
  }>) {
    if (m.external_id?.trim() || m.last_synced_at) {
      exportedIds.add(m.internal_id)
    }
  }

  for (const id of unique) {
    const { data, error } = await svc
      .from("org_invoices")
      .select("id, archived_at, status, paid_at, sent_at, amount_cents, tax_amount_cents")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Invoice not found." })
      continue
    }

    const row = data as InvoiceRow

    const already = invoiceAlreadyArchivedMessage(row.archived_at)
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const invoiceTotalCents = invoiceGrandTotalCents({
      amount_cents: Math.round(Number(row.amount_cents) || 0),
      tax_amount_cents: row.tax_amount_cents,
    })
    const grossPaid = netPaymentsCents(payments, id)
    const refunded = netRefundsCents(refunds, id)
    const sumPaid = Math.max(0, grossPaid - refunded)
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents,
      paymentsTotalCents: sumPaid,
      dbInvoiceStatus: String(row.status ?? "").toLowerCase(),
    })

    const block = invoiceBulkArchiveBlockMessage({
      archivedAt: row.archived_at,
      status: invoiceStatusDbToUi(String(row.status ?? "")),
      paymentAllocationState: alloc.allocationState,
      totalPaidCents: alloc.totalPaidCents,
      balanceDueCents: alloc.balanceDueCents,
      sentAt: row.sent_at,
      paidDate: row.paid_at,
      accountingExported: exportedIds.has(id),
    })

    if (block) {
      results.push({ id, ok: false, message: block })
      continue
    }

    const { error: updateError } = await svc
      .from("org_invoices")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this invoice. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}
