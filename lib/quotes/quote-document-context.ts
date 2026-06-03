export type QuoteDocumentLineItem = {
  description: string
  qty: number
  unitUsd: number
  lineTotalUsd: number
}

/** Shared quote facts for PDF generation and customer quote email. */
export type QuoteDocumentContext = {
  organizationId: string
  quoteId: string
  customerId: string
  organizationName: string
  documentLogoUrl: string | null
  logoUrl: string | null
  quoteNumberLabel: string
  quoteTitle: string | null
  customerCompanyName: string
  equipmentName: string | null
  statusDisplay: string
  createdDateLabel: string
  expiresDateLabel: string
  lineItems: QuoteDocumentLineItem[]
  customerNotes: string | null
  totalCents: number
}
