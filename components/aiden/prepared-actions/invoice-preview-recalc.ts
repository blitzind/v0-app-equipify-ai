import type { InvoicePreviewPayload } from "@/components/aiden/prepared-actions/types"

/** Recompute line totals (qty × unit), subtotal (major), and total from line items + existing tax estimate. */
export function recalcInvoicePreviewTotals(p: InvoicePreviewPayload): InvoicePreviewPayload {
  const lineItems = (p.lineItems ?? []).map((li) => {
    const qty = Number.isFinite(li.quantity) && li.quantity > 0 ? li.quantity : 1
    const unit = Number.isFinite(li.unitCents) ? Math.round(li.unitCents) : 0
    const lineTotalCents = Math.round(qty * unit)
    return { ...li, quantity: qty, unitCents: unit, lineTotalCents }
  })
  const sumCents = lineItems.reduce((s, l) => s + (Number.isFinite(l.lineTotalCents) ? l.lineTotalCents : 0), 0)
  const subtotal = sumCents / 100
  const tax = p.taxEstimate == null || p.taxEstimate === undefined ? null : p.taxEstimate
  const total = tax == null ? subtotal : subtotal + tax
  return { ...p, lineItems, subtotal, total }
}
