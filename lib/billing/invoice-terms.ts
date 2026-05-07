/**
 * Terms-based due dates for org_invoices.terms_code / terms_custom_days.
 * Aligned with migration `org_invoices_terms_code_check`.
 */
export const INVOICE_TERMS_CODES = [
  "due_on_receipt",
  "net_7",
  "net_14",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "custom",
] as const

export type InvoiceTermsCode = (typeof INVOICE_TERMS_CODES)[number]

/** UI + legacy labels (new invoice modal). */
export const PAYMENT_TERMS_OPTIONS: { label: string; code: InvoiceTermsCode; netDays: number | null }[] = [
  { label: "Due on Receipt", code: "due_on_receipt", netDays: 0 },
  { label: "Net 7", code: "net_7", netDays: 7 },
  { label: "Net 14", code: "net_14", netDays: 14 },
  { label: "Net 15", code: "net_15", netDays: 15 },
  { label: "Net 30", code: "net_30", netDays: 30 },
  { label: "Net 45", code: "net_45", netDays: 45 },
  { label: "Net 60", code: "net_60", netDays: 60 },
  { label: "Custom (days)", code: "custom", netDays: null },
]

function addDaysYmd(issueYmd: string, days: number): string {
  const d = new Date(issueYmd + "T12:00:00.000Z")
  if (Number.isNaN(d.getTime())) return issueYmd
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param issueYmd — issue date YYYY-MM-DD (UTC date math)
 * @param code — DB terms_code; null/undefined → Net 30 behavior
 */
export function computeDueDateYmd(
  issueYmd: string,
  code: InvoiceTermsCode | string | null | undefined,
  customDays?: number | null,
): string {
  const c = (code?.trim() || "net_30") as string
  if (c === "due_on_receipt") return issueYmd
  if (c === "custom") {
    const n = typeof customDays === "number" && customDays > 0 ? Math.floor(customDays) : 30
    return addDaysYmd(issueYmd, n)
  }
  const map: Record<string, number> = {
    net_7: 7,
    net_14: 14,
    net_15: 15,
    net_30: 30,
    net_45: 45,
    net_60: 60,
  }
  const days = map[c] ?? 30
  return addDaysYmd(issueYmd, days)
}

/** Map legacy modal label → DB code (best effort). */
export function paymentTermsLabelToCode(label: string): InvoiceTermsCode {
  const row = PAYMENT_TERMS_OPTIONS.find((x) => x.label === label.trim())
  return row?.code ?? "net_30"
}

/** Map DB code → display label. */
export function invoiceTermsCodeLabel(code: string | null | undefined): string {
  const row = PAYMENT_TERMS_OPTIONS.find((x) => x.code === code)
  return row?.label ?? (code ? code.replace(/_/g, " ") : "Net 30")
}
