import type { FollowUpRuleKey } from "@/lib/follow-up-automation/types"

/** Phase 25 — invoice follow-up automation rule keys (queue + AI draft routing). */
export const INVOICE_FOLLOW_UP_RULE_KEYS = [
  "invoice_due_soon",
  "invoice_overdue",
  "invoice_overdue_7_days",
  "invoice_overdue_14_days",
  "invoice_overdue_30_days",
  "invoice_final_notice_candidate",
] as const

export type InvoiceFollowUpRuleKey = (typeof INVOICE_FOLLOW_UP_RULE_KEYS)[number]

const KEY_SET = new Set<string>(INVOICE_FOLLOW_UP_RULE_KEYS)

export function isInvoiceFollowUpRuleKey(ruleKey: string): boolean {
  return KEY_SET.has(ruleKey)
}

export function wholeUtcDaysBetween(startYmd: string, endYmd: string): number {
  const s = Date.parse(`${startYmd}T12:00:00.000Z`)
  const e = Date.parse(`${endYmd}T12:00:00.000Z`)
  return Math.round((e - s) / 86400000)
}

/** Negative = due in -n days; 0 = due today; positive = n days past due. */
export function signedDaysRelativeToDueDate(todayYmd: string, dueYmd: string): number {
  return wholeUtcDaysBetween(dueYmd, todayYmd)
}

/**
 * At most one milestone applies per invoice per evaluation — dedupe_key keeps one open row per rule.
 * Aging into a new bucket uses a different rule_key → new dedupe row once the prior task is closed.
 */
export function pickInvoiceFollowUpRuleKey(params: {
  todayYmd: string
  dueYmd: string
  dueSoonDays: number
  finalNoticeDays: number
}): FollowUpRuleKey | null {
  const signed = signedDaysRelativeToDueDate(params.todayYmd, params.dueYmd)
  if (signed <= 0 && signed >= -params.dueSoonDays) {
    return "invoice_due_soon"
  }
  if (signed < -params.dueSoonDays) {
    return null
  }
  if (signed >= params.finalNoticeDays) return "invoice_final_notice_candidate"
  if (signed >= 30) return "invoice_overdue_30_days"
  if (signed >= 14) return "invoice_overdue_14_days"
  if (signed >= 7) return "invoice_overdue_7_days"
  return "invoice_overdue"
}

export function priorityForInvoiceFollowUpRule(ruleKey: FollowUpRuleKey): "low" | "normal" | "high" {
  switch (ruleKey) {
    case "invoice_due_soon":
      return "normal"
    case "invoice_overdue":
      return "normal"
    case "invoice_overdue_7_days":
    case "invoice_overdue_14_days":
    case "invoice_overdue_30_days":
    case "invoice_final_notice_candidate":
      return "high"
    default:
      return "normal"
  }
}

export function isInvoiceFollowUpEligibleStatus(status: string): boolean {
  return status === "sent" || status === "unpaid" || status === "overdue"
}
