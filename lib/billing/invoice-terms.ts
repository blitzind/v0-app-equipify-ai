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

/** UI options for editing org/customer defaults (allows "use default" inheritance). */
export const CUSTOMER_TERMS_OPTIONS: { code: InvoiceTermsCode | ""; label: string; helper: string }[] = [
  { code: "", label: "Use organization default", helper: "Inherit the workspace default for new invoices." },
  ...PAYMENT_TERMS_OPTIONS.map((o) => ({
    code: o.code,
    label: o.label,
    helper:
      o.code === "due_on_receipt"
        ? "Due immediately on the issue date."
        : o.code === "custom"
          ? "Specify a custom number of days after the issue date."
          : `Due ${o.netDays} days after the issue date.`,
  })),
]

/** Workspace default options (no inheritance). */
export const ORG_DEFAULT_TERMS_OPTIONS = PAYMENT_TERMS_OPTIONS.filter((o) => o.code !== "custom")

/**
 * Resolves the effective terms code for a new invoice.
 *
 *   customer override → organization default → built-in fallback (`net_30`).
 *
 * Trims/normalizes any string input from DB or UI form state.
 */
export function resolveEffectiveTermsCode(args: {
  customerCode?: string | null
  organizationCode?: string | null
}): InvoiceTermsCode {
  const trim = (s: string | null | undefined) => (s ?? "").trim()
  const isValid = (c: string): c is InvoiceTermsCode =>
    (INVOICE_TERMS_CODES as readonly string[]).includes(c)
  const cust = trim(args.customerCode)
  if (cust && isValid(cust)) return cust
  const org = trim(args.organizationCode)
  if (org && isValid(org)) return org
  return "net_30"
}

/**
 * Describes how the effective terms were resolved — used by UI badges to show
 * whether the customer is using a personal override, the workspace default,
 * or the built-in fallback. Matches the conventions used for portal certificate
 * release rule clarity (Phase 1/2).
 */
export type TermsResolutionSource = "customer_override" | "organization_default" | "fallback"

export function describeTermsResolution(args: {
  customerCode?: string | null
  organizationCode?: string | null
}): { source: TermsResolutionSource; effective: InvoiceTermsCode } {
  const cust = (args.customerCode ?? "").trim()
  const isValid = (c: string): c is InvoiceTermsCode =>
    (INVOICE_TERMS_CODES as readonly string[]).includes(c)
  if (cust && isValid(cust)) return { source: "customer_override", effective: cust }
  const org = (args.organizationCode ?? "").trim()
  if (org && isValid(org)) return { source: "organization_default", effective: org }
  return { source: "fallback", effective: "net_30" }
}

/** Number of net days for an effective terms code (0 for due_on_receipt). */
export function netDaysForTermsCode(
  code: InvoiceTermsCode | string | null | undefined,
  customDays?: number | null,
): number {
  const c = (code ?? "").trim()
  if (c === "due_on_receipt") return 0
  if (c === "custom") {
    const n = typeof customDays === "number" && customDays > 0 ? Math.floor(customDays) : 30
    return n
  }
  const map: Record<string, number> = {
    net_7: 7,
    net_14: 14,
    net_15: 15,
    net_30: 30,
    net_45: 45,
    net_60: 60,
  }
  return map[c] ?? 30
}
