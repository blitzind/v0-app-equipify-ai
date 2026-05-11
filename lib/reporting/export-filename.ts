/**
 * Consistent `equipify-{slug}-{range}.csv` naming for operational exports.
 */

function sanitizeToken(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

export function equipifyExportFilename(opts: {
  /** Short kebab label, e.g. `operational-report`, `financial-invoices` */
  slug: string
  /** Inclusive report window (preferred for operational reports). */
  range?: { from: string; to: string }
  /** When there is no from/to (snapshot / preview), e.g. `2026-05-11`. */
  dateStamp?: string
  extension?: "csv"
}): string {
  const ext = opts.extension ?? "csv"
  const safeSlug = sanitizeToken(opts.slug) || "export"
  const middle =
    opts.range?.from && opts.range?.to
      ? `${sanitizeToken(opts.range.from)}_${sanitizeToken(opts.range.to)}`
      : sanitizeToken(opts.dateStamp ?? new Date().toISOString().slice(0, 10))
  return `equipify-${safeSlug}-${middle}.${ext}`
}
