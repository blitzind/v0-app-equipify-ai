/**
 * Merge-token helpers for communication templates (Phase 51).
 * Preview/sample only — no outbound send.
 */

import { FINANCIAL_MERGE_TOKEN_KEYS, INTERNAL_RISK_TOKEN_KEYS } from "@/lib/communications/template-tokens"

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

export function extractMergeTokenKeys(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  const keys = new Set<string>()
  for (const m of text.matchAll(TOKEN_RE)) {
    const k = m[1]?.toLowerCase()
    if (k) keys.add(k)
  }
  return [...keys]
}

export function usesFinancialTokens(text: string | null | undefined): boolean {
  return extractMergeTokenKeys(text).some((k) => FINANCIAL_MERGE_TOKEN_KEYS.has(k))
}

export function usesInternalRiskTokens(text: string | null | undefined): boolean {
  return extractMergeTokenKeys(text).some((k) => INTERNAL_RISK_TOKEN_KEYS.has(k))
}

/** Sample values for preview — never real customer/financial data. */
export function buildSampleMergeMap(includeFinancial: boolean): Record<string, string> {
  const map: Record<string, string> = {
    customer_name: "Alex Customer",
    company_name: "Acme Field Service",
    work_order_number: "1042",
    service_request_number: "SR-2048",
    quote_number: "Q-7788",
    invoice_number: "INV-901",
    appointment_date: "June 12, 2026",
    portal_link: "[portal link — configure customer portal before send]",
    sender_name: "Jamie (Dispatch)",
    equipment_name: "Benchtop centrifuge",
    quote_summary: "Annual PM package",
    plan_name: "Quarterly calibration plan",
    equipment_or_plan: "Quarterly calibration plan",
    service_date: "June 20, 2026",
    due_date: "July 1, 2026",
  }
  if (includeFinancial) {
    map.amount = "$1,240.00"
    map.invoice_amount = "$1,240.00"
    map.balance_due = "$890.00"
    map.quote_total = "$3,400.00"
  } else {
    map.amount = "—"
    map.invoice_amount = "—"
    map.balance_due = "—"
    map.quote_total = "—"
  }
  return map
}

export function mergeTemplateText(
  text: string | null | undefined,
  map: Record<string, string>,
): string {
  if (!text) return ""
  return text.replace(TOKEN_RE, (_, raw: string) => {
    const key = raw.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]!
    return `{{${key}}}`
  })
}

export type TemplatePreviewResult = {
  mergedSubject: string
  mergedBody: string
  smsBodyLength: number
  smsSegmentsApprox: number
  warnings: string[]
}

export function buildTemplatePreview(args: {
  subject: string | null | undefined
  body: string | null | undefined
  channel: string | null | undefined
  includeFinancialInMap: boolean
}): TemplatePreviewResult {
  const map = buildSampleMergeMap(args.includeFinancialInMap)
  const mergedSubject = mergeTemplateText(args.subject ?? "", map)
  const mergedBody = mergeTemplateText(args.body ?? "", map)
  const smsBodyLength = mergedBody.length
  const smsSegmentsApprox = Math.max(1, Math.ceil(smsBodyLength / 160))

  const warnings: string[] = []
  const combined = `${args.subject ?? ""}\n${args.body ?? ""}`
  if (usesInternalRiskTokens(combined)) {
    warnings.push(
      "This text references internal-only merge tokens. Customer-facing sends should avoid technician notes, diagnosis, or internal fields.",
    )
  }
  if (!args.includeFinancialInMap && usesFinancialTokens(combined)) {
    warnings.push(
      "Financial placeholders (amount, invoice totals, etc.) are redacted in this preview. Users without financial access will not see live values.",
    )
  }
  if ((args.channel ?? "").toLowerCase() === "sms" && smsBodyLength > 320) {
    warnings.push("SMS is long — consider shortening; carrier segmentation may apply.")
  }

  return {
    mergedSubject,
    mergedBody,
    smsBodyLength,
    smsSegmentsApprox,
    warnings,
  }
}
