import type { InvoicePaymentAllocationState } from "@/lib/billing/invoice-payment-allocation"

export type InvoiceDocumentLineItem = {
  description: string
  qty: number
  unitUsd: number
  lineTotalUsd: number
  sku?: string
}

/** Shared invoice facts for PDF generation and customer invoice email. */
export type InvoiceDocumentContext = {
  organizationId: string
  invoiceId: string
  customerId: string
  organizationName: string
  documentLogoUrl: string | null
  logoUrl: string | null
  invoiceNumberLabel: string
  invoiceTitle: string | null
  customerCompanyName: string
  billToName: string | null
  /** Single formatted billing address (comma-separated lines flattened). */
  billToAddressBlock: string
  equipmentName: string | null
  workOrderLabel: string | null
  serviceDateLabel: string | null
  issuedDateLabel: string
  dueDateLabel: string
  statusDisplay: string
  dbStatusLower: string
  lineItems: InvoiceDocumentLineItem[]
  customerNotes: string | null
  invoiceInstructions: string | null
  poNumber: string | null
  subtotalCents: number
  taxCents: number
  taxRatePercent: number | null
  grandTotalCents: number
  totalPaidCents: number
  balanceDueCents: number
  allocationState: InvoicePaymentAllocationState
  workOrderId: string | null
  calibrationRecordId: string | null
  /** Stored invoice payment terms label (for example Net 30), when present. */
  paymentTermsLabel?: string | null
}
