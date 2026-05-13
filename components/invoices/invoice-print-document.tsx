import type { InvoiceDocumentContext } from "@/lib/invoices/invoice-document-context"
import { formatUsdFromCents, invoiceTaxRowLabel } from "@/lib/billing/invoice-financial-display"

function money(cents: number): string {
  return formatUsdFromCents(Math.max(0, Math.round(cents)))
}

function detailFallback(ctx: InvoiceDocumentContext): string | null {
  const parts: string[] = []
  const subj = ctx.invoiceTitle?.trim()
  if (subj) parts.push(subj)
  const n = ctx.customerNotes?.trim()
  if (n) parts.push(n)
  const ins = ctx.invoiceInstructions?.trim()
  if (ins) parts.push(`Customer instructions:\n${ins}`)
  if (parts.length === 0) return null
  return parts.join("\n\n")
}

export function InvoicePrintDocument({ ctx }: { ctx: InvoiceDocumentContext }) {
  const logo = ctx.documentLogoUrl?.trim() || ctx.logoUrl?.trim() || null
  const billName = ctx.billToName?.trim() || ctx.customerCompanyName
  const fallback = detailFallback(ctx)
  const taxLabel = invoiceTaxRowLabel({ taxRatePercent: ctx.taxRatePercent })

  return (
    <div className="invoice-print-root mx-auto max-w-[720px] px-6 py-8 text-gray-900 bg-white text-sm leading-relaxed">
      <header className="flex flex-wrap justify-between gap-4 border-b border-gray-200 pb-6 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{ctx.organizationName}</h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Invoice</p>
          <p className="text-lg font-semibold">{ctx.invoiceNumberLabel}</p>
          <dl className="mt-3 space-y-0.5 text-xs text-gray-600">
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">Issue date</dt>
              <dd>{ctx.issuedDateLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">Due date</dt>
              <dd>{ctx.dueDateLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">Status</dt>
              <dd>{ctx.statusDisplay}</dd>
            </div>
            {ctx.paymentTermsLabel ? (
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500">Terms</dt>
                <dd>{ctx.paymentTermsLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {logo ? (
          <div className="shrink-0 max-w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="max-h-14 w-auto object-contain" />
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 mb-8">
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Bill to</h2>
          <p className="font-semibold">{billName}</p>
          {ctx.billToAddressBlock ? (
            <p className="mt-1 text-xs text-gray-600 whitespace-pre-line">{ctx.billToAddressBlock}</p>
          ) : null}
        </section>
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Service / equipment</h2>
          {ctx.equipmentName ? <p className="text-xs">{ctx.equipmentName}</p> : <p className="text-xs text-gray-400">—</p>}
          {ctx.workOrderLabel ? (
            <p className="mt-1 text-xs">
              <span className="font-medium text-gray-500">Work order: </span>
              {ctx.workOrderLabel}
            </p>
          ) : null}
          {ctx.serviceDateLabel ? (
            <p className="mt-1 text-xs">
              <span className="font-medium text-gray-500">Service date: </span>
              {ctx.serviceDateLabel}
            </p>
          ) : null}
        </section>
      </div>

      {ctx.invoiceTitle ? (
        <section className="mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Invoice subject</h2>
          <p className="font-semibold">{ctx.invoiceTitle}</p>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Line items</h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right w-14">Qty</th>
              <th className="py-2 pr-2 text-right w-24">Unit</th>
              <th className="py-2 text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ctx.lineItems.length > 0 ? (
              ctx.lineItems.map((row, i) => (
                <tr key={i} className="invoice-print-line-row border-b border-gray-100">
                  <td className="py-2 pr-2 align-top">
                    <span className="font-medium text-gray-900">{row.description}</span>
                    {row.sku ? <span className="block text-[10px] text-gray-500 mt-0.5">SKU {row.sku}</span> : null}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums align-top">{row.qty}</td>
                  <td className="py-2 pr-2 text-right tabular-nums align-top">{money(Math.round(row.unitUsd * 100))}</td>
                  <td className="py-2 text-right font-medium tabular-nums align-top">
                    {money(Math.round(row.lineTotalUsd * 100))}
                  </td>
                </tr>
              ))
            ) : fallback ? (
              <tr>
                <td colSpan={4} className="py-3 text-xs text-gray-700 whitespace-pre-wrap">
                  {fallback}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={4} className="py-3 text-xs italic text-gray-500">
                  No itemized line rows — totals reflect the stored invoice amount.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="invoice-print-totals-block ml-auto w-full max-w-xs text-xs space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Subtotal</span>
          <span className="tabular-nums font-medium">{money(ctx.subtotalCents)}</span>
        </div>
        {ctx.taxCents !== 0 ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">{taxLabel}</span>
            <span className="tabular-nums font-medium">{money(ctx.taxCents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 pt-2 border-t border-gray-200 text-sm font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(ctx.grandTotalCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Amount paid</span>
          <span className="tabular-nums font-medium">{money(ctx.totalPaidCents)}</span>
        </div>
        <div className="flex justify-between gap-4 pb-2 border-b border-gray-200">
          <span className="text-gray-600">Balance due</span>
          <span className="tabular-nums font-semibold">{money(ctx.balanceDueCents)}</span>
        </div>
      </section>
    </div>
  )
}
