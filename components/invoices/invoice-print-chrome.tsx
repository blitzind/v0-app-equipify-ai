"use client"

import Link from "next/link"

export function InvoicePrintChrome() {
  return (
    <div className="invoice-print-no-print border-b border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Print preview — use your browser&apos;s print dialog. This bar is hidden when printing.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          onClick={() => window.print()}
        >
          Print
        </button>
        <Link
          href="/invoices"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted no-underline text-foreground"
        >
          Back to invoices
        </Link>
      </div>
    </div>
  )
}
