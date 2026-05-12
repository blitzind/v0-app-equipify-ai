/** Shared types for summarize-customer-history prepared action (client + server). */

export type SummarizeCustomerHistoryPreviewCustomer = {
  id: string
  companyName: string
  billingCity: string | null
  billingState: string | null
}

export type SummarizeCustomerHistoryWorkOrderLine = {
  id: string
  workOrderNumber: number | null
  title: string
  status: string
  completedAt: string | null
  updatedAt: string | null
}

export type SummarizeCustomerHistoryEquipmentLine = {
  id: string
  name: string
  status: string | null
  serialNumber: string | null
}

export type SummarizeCustomerHistoryOpenIssue = {
  kind: "work_order" | "invoice" | "quote"
  id: string
  label: string
  detail: string | null
}

export type SummarizeCustomerHistoryMaintenanceLine = {
  id: string
  name: string
  equipmentName: string | null
  status: string
  nextDueDate: string | null
  intervalLabel: string
}

export type SummarizeCustomerHistoryInvoiceLine = {
  id: string
  invoiceNumber: string
  title: string
  statusUi: string
  amountCents: number
  dueDate: string | null
}

export type SummarizeCustomerHistoryQuoteLine = {
  id: string
  quoteNumber: string
  title: string
  statusUi: string
  amountCents: number
}

export type SummarizeCustomerHistoryCommunicationLine = {
  id: string
  createdAt: string
  channel: string | null
  direction: string | null
  title: string
  summary: string | null
}

export type SummarizeCustomerHistoryPreviewPayload = {
  customer: SummarizeCustomerHistoryPreviewCustomer
  financialsRedacted: boolean
  /** Narrative sections (deterministic copy). */
  customerOverview: string
  recentWorkPerformed: string
  openIssues: string
  upcomingMaintenance: string
  /** Present only when `financialsRedacted` is false. */
  financialStatus: string | null
  recommendedNextActions: string[]
  recentWorkOrders: SummarizeCustomerHistoryWorkOrderLine[]
  equipment: SummarizeCustomerHistoryEquipmentLine[]
  openIssuesList: SummarizeCustomerHistoryOpenIssue[]
  maintenancePlans: SummarizeCustomerHistoryMaintenanceLine[]
  openInvoices: SummarizeCustomerHistoryInvoiceLine[] | null
  quotes: SummarizeCustomerHistoryQuoteLine[] | null
  recentCommunications: SummarizeCustomerHistoryCommunicationLine[] | null
  latestCompletedBillableWorkOrderId: string | null
  latestCompletedBillableWorkOrderNumber: number | null
  showCreateInvoiceFromLatestWorkOrder: boolean
}
