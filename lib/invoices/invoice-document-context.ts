import type { InvoicePaymentAllocationState } from "@/lib/billing/invoice-payment-allocation"

export type InvoiceDocumentLineItem = {
  description: string
  itemName: string
  detailNotes: string | null
  qty: number
  unitUsd: number
  lineTotalUsd: number
  sku?: string
  taxable?: boolean
}

/** Shared invoice facts for PDF generation and customer invoice email. */
export type InvoiceDocumentContext = {
  organizationId: string
  invoiceId: string
  customerId: string
  organizationName: string
  documentLogoUrl: string | null
  logoUrl: string | null
  companyAddress: string | null
  companyPhone: string | null
  companyWebsite: string | null
  companyEmail: string | null
  invoiceNumberLabel: string
  invoiceTitle: string | null
  customerCompanyName: string
  customerPhone: string | null
  customerEmail: string | null
  billToName: string | null
  /** Multi-line billing address block. */
  billToAddressBlock: string
  serviceAddressBlock: string | null
  equipmentName: string | null
  workOrderLabel: string | null
  serviceDateLabel: string | null
  issuedDateLabel: string
  dueDateLabel: string
  statusDisplay: string
  dbStatusLower: string
  authorName: string | null
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
