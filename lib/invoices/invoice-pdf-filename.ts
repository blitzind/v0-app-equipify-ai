/**
 * Resend / filesystem-safe attachment name, e.g. `Invoice-INV-AR-PBS-7017.pdf`.
 */
export function buildInvoicePdfFilename(invoiceNumber: string): string {
  const raw = invoiceNumber.trim() || "Invoice"
  const slug = raw
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = slug.length > 0 ? slug : "Invoice"
  return `Invoice-${base}.pdf`
}
