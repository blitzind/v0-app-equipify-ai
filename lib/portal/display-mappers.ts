export function mapWorkOrderStatus(db: string): string {
  const m: Record<string, string> = {
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    completed_pending_signature: "Awaiting Signature",
    invoiced: "Invoiced",
  }
  return m[db] ?? db
}

export function mapWorkOrderType(db: string): string {
  const m: Record<string, string> = {
    repair: "Repair",
    pm: "PM",
    inspection: "Inspection",
    install: "Install",
    emergency: "Emergency",
  }
  return m[db] ?? db
}

export function mapEquipmentStatus(db: string): string {
  const m: Record<string, string> = {
    active: "Active",
    needs_service: "Needs Service",
    out_of_service: "Out of Service",
    in_repair: "In Repair",
  }
  return m[db] ?? db
}

export function mapInvoiceStatus(db: string): string {
  const m: Record<string, string> = {
    draft: "Draft",
    sent: "Unpaid",
    paid: "Paid",
    overdue: "Overdue",
  }
  return m[db] ?? db
}

export function mapQuoteStatus(db: string): string {
  const m: Record<string, string> = {
    draft: "Draft",
    sent: "Pending Approval",
    approved: "Approved",
    declined: "Declined",
  }
  return m[db] ?? db
}

export function mapMaintenancePlanStatus(db: string): string {
  const m: Record<string, string> = {
    active: "Active",
    paused: "Paused",
    expired: "Expired",
  }
  return m[db] ?? db
}
