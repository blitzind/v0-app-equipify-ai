import { notFound } from "next/navigation"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document"
import { InvoicePrintAutoTrigger } from "@/components/invoices/invoice-print-auto-trigger"
import { InvoicePrintChrome } from "@/components/invoices/invoice-print-chrome"
import "./invoice-print.css"

export const metadata = {
  title: "Print invoice",
}

export default async function OrganizationInvoicePrintPage({
  params,
}: {
  params: Promise<{ organizationId: string; invoiceId: string }>
}) {
  const { organizationId, invoiceId } = await params

  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) notFound()

  const ctx = await loadInvoiceDocumentContext(gate.supabase, organizationId, invoiceId, {
    staffDocumentExport: true,
  })
  if (!ctx) notFound()

  return (
    <main className="invoice-print-shell">
      <InvoicePrintChrome />
      <InvoicePrintDocument ctx={ctx} />
      <InvoicePrintAutoTrigger />
    </main>
  )
}
