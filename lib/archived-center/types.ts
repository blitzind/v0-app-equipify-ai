/** API + UI archive record discriminator */
export type ArchivedRecordType =
  | "customer"
  | "equipment"
  | "work_order"
  | "quote"
  | "invoice"
  | "maintenance_plan"
  | "calibration_template"
  | "calibration_record"
  | "vendor"

export const ARCHIVED_RECORD_TYPES: ArchivedRecordType[] = [
  "customer",
  "equipment",
  "work_order",
  "quote",
  "invoice",
  "maintenance_plan",
  "calibration_template",
  "calibration_record",
  "vendor",
]

export type ArchivedCenterRow = {
  id: string
  type: ArchivedRecordType
  typeLabel: string
  title: string
  archivedAt: string
  archivedByLabel: string | null
  archiveReason: string | null
  detailHref: string | null
}

export const ARCHIVED_TYPE_LABELS: Record<ArchivedRecordType, string> = {
  customer: "Customer",
  equipment: "Equipment",
  work_order: "Work Order",
  quote: "Quote",
  invoice: "Invoice",
  maintenance_plan: "Maintenance Plan",
  calibration_template: "Certificate Template",
  calibration_record: "Certificate",
  vendor: "Vendor",
}

/** UI filter: "certificate" matches both certificate templates and completed certificate rows */
export type ArchivedCenterFilter =
  | "all"
  | "customer"
  | "equipment"
  | "work_order"
  | "quote"
  | "invoice"
  | "maintenance_plan"
  | "certificate"
  | "vendor"

export const FILTER_OPTIONS: { value: ArchivedCenterFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "equipment", label: "Equipment" },
  { value: "work_order", label: "Work Orders" },
  { value: "quote", label: "Quotes" },
  { value: "invoice", label: "Invoices" },
  { value: "maintenance_plan", label: "Maintenance Plans" },
  { value: "certificate", label: "Certificates" },
  { value: "vendor", label: "Vendors" },
]
