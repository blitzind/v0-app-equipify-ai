import type { AidenParsedPreparedIntent, ParseAidenIntentInputOptions } from "@/lib/aiden/intent/intent-types"
import {
  extractCustomerReference,
  extractMaintenancePlanPossessiveCustomerEquipment,
  normalizedTextRequestsThisCustomer,
} from "@/lib/aiden/intent/customer-reference-parser"
import {
  normalizedTextRequestsThisWorkOrder,
  parseWorkOrderReferenceFromNormalizedText,
} from "@/lib/aiden/intent/work-order-reference-parser"
import { parseBulkInvoiceDateRangeFromNormalizedText } from "@/lib/aiden/actions/resolvers/bulk-invoice-date-range"

function normalizeUserText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase()
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function looksLikeInvoiceIntent(normalized: string): boolean {
  if (looksLikeBulkInvoiceCompletedWorkOrdersIntent(normalized)) return false
  if (/\b(make|create|draft)\s+(an?\s+)?invoice\b/.test(normalized)) return true
  if (/\bdraft\s+invoice\b/.test(normalized)) return true
  if (/\binvoice\b/.test(normalized) && /\b(from|based\s+on)\b/.test(normalized)) return true
  if (/\b(need|want|wanna|would like|help)\b.*\binvoice\b/.test(normalized)) return true
  if (/\binvoice\b.*\b(please|today|now|asap)\b/.test(normalized)) return true
  return false
}

function looksLikeBulkInvoiceCompletedWorkOrdersIntent(normalized: string): boolean {
  if (/\b(quickbooks|payment\s+link|quote)\b/.test(normalized)) return false
  if (normalizedTextRequestsThisWorkOrder(normalized) && !/\ball\b|\bbulk\b/.test(normalized)) {
    return false
  }

  const explicitBulk =
    /\bbulk\b.*\binvoice/.test(normalized) ||
    /\binvoice\s+all\s+completed/.test(normalized) ||
    /\b(draft|prepare)\s+invoices\b/.test(normalized) ||
    /\bmultiple\b.*\binvoice/.test(normalized)

  const batchCompletedPlural =
    /\bcompleted\b.*\bwork\s+orders\b/.test(normalized) ||
    /\ball\b.*\bcompleted\b.*\b(work\s+orders?|jobs)\b/.test(normalized)

  if (explicitBulk) return true
  if (batchCompletedPlural && /\b(invoice|invoices|bill|draft)\b/.test(normalized)) return true
  return false
}

function looksLikeQuoteIntent(normalized: string): boolean {
  if (/\b(make|create|draft)\s+(an?\s+)?(quote|estimate)\b/.test(normalized)) return true
  if (/\b(make|create|draft)\s+a\s+quote\b/.test(normalized)) return true
  if (/\bquote\b/.test(normalized) && /\b(from|for|based|recommended|repairs|estimate|job|work\s+order)\b/.test(normalized))
    return true
  if (/\bestimate\b/.test(normalized) && /\b(for|from|based|make|create|draft)\b/.test(normalized)) return true
  return false
}

/** BlitzPay / hosted checkout link for an existing invoice (not draft-from-WO). */
function looksLikePrepareInvoicePaymentLinkIntent(normalized: string): boolean {
  if (/\b(quickbooks|quick\s*books|\bqb\b)\b/.test(normalized)) return false
  if (/\b(payment|pay)\s+link\b/.test(normalized)) return true
  if (/\bcheckout\s+link\b/.test(normalized)) return true
  if (/\b(hosted|online)\s+(payment|checkout)\b/.test(normalized) && /\b(invoice|blitzpay)\b/.test(normalized))
    return true
  if (/\bprepare\b/.test(normalized) && /\b(payment|pay)\s+link\b/.test(normalized)) return true
  if (/\b(blitzpay|stripe)\b/.test(normalized) && /\b(link|checkout|collect)\b/.test(normalized)) return true
  return false
}

function looksLikeFollowUpMessageIntent(normalized: string): boolean {
  return (
    /\bdraft\b/.test(normalized) &&
    /\b(follow\s*up|follow-up)\b/.test(normalized) &&
    /\bmessage\b/.test(normalized)
  )
}

/** Draft customer-facing email/SMS-style copy (no send). */
function looksLikeDraftCustomerMessageIntent(normalized: string): boolean {
  if (looksLikeFollowUpMessageIntent(normalized)) return true
  if (/\bdraft\b/.test(normalized) && /\b(message|email|sms|text)\b/.test(normalized)) return true
  if (/\b(write|compose)\b/.test(normalized) && /\b(message|email)\b/.test(normalized)) return true
  if (/\bcustomer(\s*|-)facing\b/.test(normalized) && /\b(message|email|copy)\b/.test(normalized)) return true
  return false
}

function looksLikePrepareQuickBooksInvoiceSyncIntent(normalized: string): boolean {
  const hasQb = /\b(quickbooks|quick\s*books|\bqb\b)\b/.test(normalized)
  const hasSync = /\b(sync|export|push)\b/.test(normalized)
  if (hasQb && hasSync) return true
  if (/\bsync\b.*\binvoice\b/.test(normalized) && hasQb) return true
  if (/\binvoice\b.*\bto\b.*\b(quickbooks|qb)\b/.test(normalized)) return true
  if (/\bexport\b.*\binvoice\b/.test(normalized) && hasQb) return true
  return false
}

function looksLikeSummarizeCustomerHistoryIntent(normalized: string): boolean {
  if (/\bsummarize\b/.test(normalized) && /\b(service\s+history|customer|account)\b/.test(normalized)) return true
  if (/\b(customer|account)\s+summary\b/.test(normalized)) return true
  if (
    /\bsummary\b/.test(normalized) &&
    /\b(this\s+)?customer\b/.test(normalized) &&
    /\b(history|overview|account)\b/.test(normalized)
  ) {
    return true
  }
  return false
}

function looksLikeScheduleMaintenanceVisitIntent(normalized: string): boolean {
  if (/\bmaintenance\s+plan\b/.test(normalized)) return false
  const sched = /\b(schedule|book|set\s+up|arrange)\b/.test(normalized)
  const maintenance =
    /\b(maintenance|preventive|pm\s+visit|service\s+visit|field\s+visit|on-?site\s+visit)\b/.test(normalized) ||
    /\bpm\b/.test(normalized)
  if (sched && maintenance) return true
  if (/\bschedule\b/.test(normalized) && /\bservice\b/.test(normalized) && /\bvisit\b/.test(normalized)) return true
  return false
}

function looksLikeCreateMaintenancePlanFromEquipmentIntent(normalized: string): boolean {
  if (/\b(maintenance\s+plan|preventive\s+plan|pm\s+plan)\b/.test(normalized)) return true
  if (
    /\b(quarterly|monthly|annual|yearly|semi-annual|semiannual)\b/.test(normalized) &&
    /\bplan\b/.test(normalized) &&
    /\b(maintenance|pm|preventive|inspection)\b/.test(normalized)
  ) {
    return true
  }
  if (
    /\b(set|setting)\s+(this\s+)?(unit|equipment|compressor|pump|asset)\b/.test(normalized) &&
    /\b(annual|quarterly|monthly|inspection|maintenance|pm)\b/.test(normalized)
  ) {
    return true
  }
  return false
}

function looksLikeCreateFollowUpTaskIntent(normalized: string): boolean {
  if (/\b(create|add|make)\s+(a\s+)?follow[\s-]*up\s+task\b/.test(normalized)) return true
  if (/\b(create|add)\s+(a\s+)?reminder\s+task\b/.test(normalized)) return true
  if (/\bfollow[\s-]*up\s+task\b/.test(normalized) && /\b(create|add|make|prepare)\b/.test(normalized)) return true
  return false
}

function looksLikeCreatePartsReorderRequestIntent(normalized: string): boolean {
  if (/\b(quickbooks|invoice|quote|payment\s+link)\b/.test(normalized)) return false
  if (
    /\b(parts?\s*reorder|reorder\s+parts|restock\s+parts|parts?\s*restock|reorder\s+request|need\s+more\s+parts)\b/.test(
      normalized,
    )
  ) {
    return true
  }
  if (/\b(low\s*stock|out\s*of\s*stock|reorder\s+center)\b/.test(normalized)) return true
  if (
    /\b(create|prepare|make|start)\b/.test(normalized) &&
    /\b(restock|reorder)\b/.test(normalized) &&
    /\b(parts?|inventory|stock|catalog|warehouse)\b/.test(normalized)
  ) {
    return true
  }
  return false
}

function countIntentFamilies(normalized: string): number {
  let n = 0
  if (looksLikePrepareQuickBooksInvoiceSyncIntent(normalized)) n += 1
  if (looksLikeDraftCustomerMessageIntent(normalized)) n += 1
  if (looksLikePrepareInvoicePaymentLinkIntent(normalized)) n += 1
  if (looksLikeBulkInvoiceCompletedWorkOrdersIntent(normalized)) n += 1
  if (looksLikeInvoiceIntent(normalized)) n += 1
  if (looksLikeQuoteIntent(normalized)) n += 1
  if (looksLikeSummarizeCustomerHistoryIntent(normalized)) n += 1
  if (looksLikeScheduleMaintenanceVisitIntent(normalized)) n += 1
  if (looksLikeCreateMaintenancePlanFromEquipmentIntent(normalized)) n += 1
  if (looksLikeCreateFollowUpTaskIntent(normalized)) n += 1
  if (looksLikeCreatePartsReorderRequestIntent(normalized)) n += 1
  return n
}

function baseResult(
  partial: Omit<AidenParsedPreparedIntent, "status" | "confidenceScore" | "missingFields"> &
    Pick<AidenParsedPreparedIntent, "actionId">,
  status: AidenParsedPreparedIntent["status"],
  confidenceScore: number,
  missingFields: string[],
): AidenParsedPreparedIntent {
  return {
    status,
    actionId: partial.actionId,
    customerReference: partial.customerReference,
    equipmentReference: partial.equipmentReference,
    workOrderReference: partial.workOrderReference,
    bulkInvoiceDateRange: partial.bulkInvoiceDateRange,
    sourceContext: partial.sourceContext,
    confidenceScore,
    missingFields,
  }
}

/**
 * Deterministic, rule-based parser: maps natural language to a **prepared workspace action id** and hints.
 * Does **not** call any LLM and does **not** read or mutate the database.
 */
export function parseAidenPreparedWorkspaceIntent(
  userText: string,
  options: ParseAidenIntentInputOptions = {},
): AidenParsedPreparedIntent {
  const original = userText.trim()
  const normalized = normalizeUserText(userText)
  const ctx = options.sourceContext

  if (normalized.length < 2) {
    return baseResult({ actionId: "", sourceContext: ctx }, "unsupported", 0, [])
  }

  const families = countIntentFamilies(normalized)
  if (families > 1) {
    return baseResult(
      { actionId: "", sourceContext: ctx },
      "needs_clarification",
      0.35,
      ["actionIntent"],
    )
  }

  if (looksLikeSummarizeCustomerHistoryIntent(normalized)) {
    if (normalizedTextRequestsThisCustomer(normalized)) {
      if (!ctx?.customerId) {
        return baseResult(
          { actionId: "summarize_customer_history", sourceContext: ctx },
          "needs_clarification",
          0.45,
          ["customerId"],
        )
      }
      return baseResult(
        {
          actionId: "summarize_customer_history",
          sourceContext: ctx,
          workOrderReference: undefined,
        },
        "prepared",
        0.9,
        [],
      )
    }
    const name = extractCustomerReference(normalized)
    if (!name) {
      return baseResult(
        { actionId: "summarize_customer_history", sourceContext: ctx },
        "needs_clarification",
        0.4,
        ["customerReference"],
      )
    }
    return baseResult(
      { actionId: "summarize_customer_history", customerReference: name, sourceContext: ctx },
      "prepared",
      0.82,
      [],
    )
  }

  if (looksLikeCreateMaintenancePlanFromEquipmentIntent(normalized)) {
    const ctx = options.sourceContext
    const eqId = ctx?.equipmentId?.trim()
    const possessive = extractMaintenancePlanPossessiveCustomerEquipment(normalized)

    if (normalizedTextRequestsThisCustomer(normalized)) {
      if (!ctx?.customerId) {
        return baseResult(
          { actionId: "create_maintenance_plan_from_equipment", sourceContext: ctx },
          "needs_clarification",
          0.45,
          ["customerId"],
        )
      }
      if (eqId && UUID_RE.test(eqId)) {
        return baseResult(
          { actionId: "create_maintenance_plan_from_equipment", sourceContext: ctx },
          "prepared",
          0.9,
          [],
        )
      }
      return baseResult(
        { actionId: "create_maintenance_plan_from_equipment", sourceContext: ctx },
        "needs_clarification",
        0.5,
        ["equipmentId"],
      )
    }

    if (eqId && UUID_RE.test(eqId)) {
      return baseResult(
        { actionId: "create_maintenance_plan_from_equipment", sourceContext: ctx },
        "prepared",
        0.92,
        [],
      )
    }

    if (possessive) {
      return baseResult(
        {
          actionId: "create_maintenance_plan_from_equipment",
          customerReference: possessive.customer,
          equipmentReference: possessive.equipment,
          sourceContext: ctx,
        },
        "prepared",
        0.85,
        [],
      )
    }

    return baseResult(
      { actionId: "create_maintenance_plan_from_equipment", sourceContext: ctx },
      "needs_clarification",
      0.42,
      ["equipmentId"],
    )
  }

  if (looksLikeScheduleMaintenanceVisitIntent(normalized)) {
    const hasRecordAnchor =
      Boolean(ctx?.maintenancePlanId?.trim()) ||
      Boolean(ctx?.equipmentId?.trim()) ||
      Boolean(ctx?.customerId?.trim())

    if (normalizedTextRequestsThisCustomer(normalized)) {
      if (!ctx?.customerId) {
        return baseResult(
          { actionId: "schedule_maintenance_visit", sourceContext: ctx },
          "needs_clarification",
          0.45,
          ["customerId"],
        )
      }
      return baseResult({ actionId: "schedule_maintenance_visit", sourceContext: ctx }, "prepared", 0.88, [])
    }

    if (hasRecordAnchor) {
      return baseResult({ actionId: "schedule_maintenance_visit", sourceContext: ctx }, "prepared", 0.86, [])
    }

    const name = extractCustomerReference(normalized)
    if (!name) {
      return baseResult(
        { actionId: "schedule_maintenance_visit", sourceContext: ctx },
        "needs_clarification",
        0.4,
        ["customerReference"],
      )
    }
    return baseResult(
      { actionId: "schedule_maintenance_visit", customerReference: name, sourceContext: ctx },
      "prepared",
      0.82,
      [],
    )
  }

  if (looksLikeCreateFollowUpTaskIntent(normalized)) {
    const hasRecordAnchor =
      Boolean(ctx?.invoiceId?.trim()) ||
      Boolean(ctx?.quoteId?.trim()) ||
      Boolean(ctx?.workOrderId?.trim()) ||
      Boolean(ctx?.equipmentId?.trim()) ||
      Boolean(ctx?.maintenancePlanId?.trim()) ||
      Boolean(ctx?.customerId?.trim())

    if (normalizedTextRequestsThisCustomer(normalized)) {
      if (!ctx?.customerId) {
        return baseResult(
          { actionId: "create_follow_up_task", sourceContext: ctx },
          "needs_clarification",
          0.45,
          ["customerId"],
        )
      }
      return baseResult({ actionId: "create_follow_up_task", sourceContext: ctx }, "prepared", 0.88, [])
    }

    if (hasRecordAnchor) {
      return baseResult({ actionId: "create_follow_up_task", sourceContext: ctx }, "prepared", 0.86, [])
    }

    const name = extractCustomerReference(normalized)
    if (!name) {
      return baseResult(
        { actionId: "create_follow_up_task", sourceContext: ctx },
        "needs_clarification",
        0.4,
        ["customerReference"],
      )
    }
    return baseResult(
      { actionId: "create_follow_up_task", customerReference: name, sourceContext: ctx },
      "prepared",
      0.82,
      [],
    )
  }

  if (looksLikeCreatePartsReorderRequestIntent(normalized)) {
    const woId = ctx?.workOrderId?.trim()
    const eqId = ctx?.equipmentId?.trim()
    const lowPhrase =
      /\b(low\s*stock|out\s*of\s*stock|reorder\s+center|warehouse\s+reorder)\b/.test(normalized)

    if (woId && UUID_RE.test(woId)) {
      return baseResult({ actionId: "create_parts_reorder_request", sourceContext: ctx }, "prepared", 0.9, [])
    }
    if (eqId && UUID_RE.test(eqId)) {
      return baseResult({ actionId: "create_parts_reorder_request", sourceContext: ctx }, "prepared", 0.88, [])
    }
    if (lowPhrase) {
      return baseResult({ actionId: "create_parts_reorder_request", sourceContext: ctx }, "prepared", 0.84, [])
    }
    return baseResult(
      { actionId: "create_parts_reorder_request", sourceContext: ctx },
      "needs_clarification",
      0.42,
      ["workOrderId"],
    )
  }

  if (looksLikeDraftCustomerMessageIntent(normalized)) {
    const hasRecordAnchor =
      Boolean(ctx?.invoiceId?.trim()) ||
      Boolean(ctx?.quoteId?.trim()) ||
      Boolean(ctx?.workOrderId?.trim()) ||
      Boolean(ctx?.equipmentId?.trim()) ||
      Boolean(ctx?.paymentLinkUrl?.trim())

    if (normalizedTextRequestsThisCustomer(normalized)) {
      if (!ctx?.customerId) {
        return baseResult(
          { actionId: "draft_customer_message", sourceContext: ctx },
          "needs_clarification",
          0.45,
          ["customerId"],
        )
      }
      return baseResult({ actionId: "draft_customer_message", sourceContext: ctx }, "prepared", 0.88, [])
    }

    if (hasRecordAnchor) {
      return baseResult({ actionId: "draft_customer_message", sourceContext: ctx }, "prepared", 0.86, [])
    }

    const name = extractCustomerReference(normalized)
    if (!name) {
      return baseResult(
        { actionId: "draft_customer_message", sourceContext: ctx },
        "needs_clarification",
        0.4,
        ["customerReference"],
      )
    }
    return baseResult(
      { actionId: "draft_customer_message", customerReference: name, sourceContext: ctx },
      "prepared",
      0.82,
      [],
    )
  }

  if (looksLikePrepareInvoicePaymentLinkIntent(normalized)) {
    const invId = ctx?.invoiceId?.trim()
    if (!invId) {
      return baseResult(
        { actionId: "prepare_invoice_payment_link", sourceContext: ctx },
        "needs_clarification",
        0.55,
        ["invoiceId"],
      )
    }
    return baseResult(
      { actionId: "prepare_invoice_payment_link", sourceContext: ctx },
      "prepared",
      0.9,
      [],
    )
  }

  if (looksLikePrepareQuickBooksInvoiceSyncIntent(normalized)) {
    const invId = ctx?.invoiceId?.trim()
    if (!invId) {
      return baseResult(
        { actionId: "prepare_quickbooks_invoice_sync", sourceContext: ctx },
        "needs_clarification",
        0.54,
        ["invoiceId"],
      )
    }
    return baseResult(
      { actionId: "prepare_quickbooks_invoice_sync", sourceContext: ctx },
      "prepared",
      0.9,
      [],
    )
  }

  if (looksLikeQuoteIntent(normalized)) {
    const wantsThisWo =
      normalizedTextRequestsThisWorkOrder(normalized) ||
      (/\brecommended\s+repairs\b/.test(normalized) && /\b(from|on)\s+this\b/.test(normalized))

    const woFromPhrase = parseWorkOrderReferenceFromNormalizedText(normalized)

    let workOrderReference: AidenParsedPreparedIntent["workOrderReference"]
    if (wantsThisWo) {
      const woId = ctx?.workOrderId?.trim()
      if (!woId) {
        return baseResult(
          { actionId: "create_quote_from_work_order", sourceContext: ctx },
          "needs_clarification",
          0.48,
          ["workOrderId"],
        )
      }
      workOrderReference = woId
    } else if (woFromPhrase) {
      workOrderReference = woFromPhrase
    } else {
      workOrderReference = "latest"
    }

    const customerFromText = extractCustomerReference(normalized)
    const customerIdFromPage = ctx?.customerId?.trim()
    if (!customerFromText && !customerIdFromPage) {
      return baseResult(
        {
          actionId: "create_quote_from_work_order",
          customerReference: customerFromText ?? undefined,
          workOrderReference,
          sourceContext: ctx,
        },
        "needs_clarification",
        0.44,
        ["customerReference"],
      )
    }

    return baseResult(
      {
        actionId: "create_quote_from_work_order",
        customerReference: customerFromText ?? undefined,
        workOrderReference,
        sourceContext: ctx,
      },
      "prepared",
      0.88,
      [],
    )
  }

  if (looksLikeBulkInvoiceCompletedWorkOrdersIntent(normalized)) {
    const dr = parseBulkInvoiceDateRangeFromNormalizedText(normalized)
    if (!dr) {
      return baseResult(
        {
          actionId: "bulk_invoice_completed_work_orders",
          customerReference: extractCustomerReference(normalized) ?? undefined,
          sourceContext: ctx,
        },
        "needs_clarification",
        0.52,
        ["dateRange"],
      )
    }
    return baseResult(
      {
        actionId: "bulk_invoice_completed_work_orders",
        customerReference: extractCustomerReference(normalized) ?? undefined,
        bulkInvoiceDateRange: {
          rangeStartIso: dr.rangeStartIso,
          rangeEndIso: dr.rangeEndIso,
          label: dr.label,
        },
        sourceContext: ctx,
      },
      "prepared",
      0.86,
      [],
    )
  }

  if (looksLikeInvoiceIntent(normalized)) {
    const missing: string[] = []
    const woFromPhrase = parseWorkOrderReferenceFromNormalizedText(normalized)
    const wantsThisWo = normalizedTextRequestsThisWorkOrder(normalized)

    let workOrderReference: AidenParsedPreparedIntent["workOrderReference"]
    if (wantsThisWo) {
      const woId = ctx?.workOrderId?.trim()
      if (!woId) missing.push("workOrderId")
      else workOrderReference = woId
    } else if (woFromPhrase) {
      workOrderReference = woFromPhrase
    } else {
      missing.push("workOrderReference")
    }

    const customerFromText = extractCustomerReference(normalized)
    const customerIdFromPage = ctx?.customerId?.trim()
    if (!customerFromText && !customerIdFromPage) {
      missing.push("customerReference")
    }

    if (missing.length > 0) {
      return baseResult(
        {
          actionId: "create_invoice_from_work_order",
          customerReference: customerFromText ?? undefined,
          workOrderReference,
          sourceContext: ctx,
        },
        "needs_clarification",
        0.44,
        missing,
      )
    }

    return baseResult(
      {
        actionId: "create_invoice_from_work_order",
        customerReference: customerFromText ?? undefined,
        workOrderReference: workOrderReference!,
        sourceContext: ctx,
      },
      "prepared",
      0.88,
      [],
    )
  }

  return baseResult({ actionId: "", sourceContext: ctx }, "unsupported", 0, [])
}
