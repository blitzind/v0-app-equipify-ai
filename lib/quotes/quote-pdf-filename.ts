/**
 * Resend / filesystem-safe attachment name, e.g. `quote-QT-000003.pdf`.
 */
export function buildQuotePdfFilename(quoteNumber: string): string {
  const raw = quoteNumber.trim() || "Quote"
  const slug = raw
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = slug.length > 0 ? slug : "Quote"
  return `quote-${base}.pdf`
}

/** Headers for staff quote PDF download responses. */
export function buildQuotePdfDownloadHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  }
}
