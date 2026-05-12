const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(id: string | null | undefined): id is string {
  return Boolean(id && UUID_RE.test(id))
}

/**
 * Dashboard path for a prepared-action source/target record (best-effort deep links).
 */
export function dashboardHrefForPreparedRecord(
  recordType: string | null | undefined,
  recordId: string | null | undefined,
): string | null {
  const type = recordType?.trim().toLowerCase() ?? ""
  const id = recordId?.trim() ?? ""
  if (!isUuid(id)) return null

  switch (type) {
    case "customer":
      return `/customers/${encodeURIComponent(id)}`
    case "work_order":
      return `/work-orders/${encodeURIComponent(id)}`
    case "equipment":
      return `/equipment/${encodeURIComponent(id)}`
    case "org_invoice":
      return `/invoices?open=${encodeURIComponent(id)}`
    case "org_quote":
      return `/quotes?open=${encodeURIComponent(id)}`
    case "maintenance_plan":
      return `/maintenance-plans?open=${encodeURIComponent(id)}`
    case "follow_up_task":
      return `/communications/follow-ups`
    case "communication_event":
      return `/communications`
    case "org_purchase_order":
      return `/purchase-orders?open=${encodeURIComponent(id)}`
    default:
      return null
  }
}

export function humanizeRecordType(recordType: string | null | undefined): string {
  const t = recordType?.trim() ?? ""
  if (!t) return "—"
  return t.replace(/_/g, " ")
}
