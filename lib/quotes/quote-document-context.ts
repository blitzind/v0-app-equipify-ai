export type QuoteDocumentLineItem = {
  description: string
  /** Primary line title after splitting multi-line descriptions. */
  itemName: string
  /** Secondary detail/notes rendered beneath the item name when present. */
  detailNotes: string | null
  qty: number
  unitUsd: number
  lineTotalUsd: number
  taxable?: boolean
  sku?: string
}

/** Shared quote facts for PDF generation and customer quote email. */
export type QuoteDocumentContext = {
  organizationId: string
  quoteId: string
  customerId: string
  organizationName: string
  documentLogoUrl: string | null
  logoUrl: string | null
  companyAddress: string | null
  companyPhone: string | null
  companyWebsite: string | null
  companyEmail: string | null
  quoteNumberLabel: string
  quoteTitle: string | null
  customerCompanyName: string
  customerPhone: string | null
  customerEmail: string | null
  serviceAddressBlock: string | null
  billingAddressBlock: string | null
  equipmentName: string | null
  statusDisplay: string
  createdDateLabel: string
  expiresDateLabel: string
  authorName: string | null
  poNumber: string | null
  lineItems: QuoteDocumentLineItem[]
  customerNotes: string | null
  subtotalCents: number
  taxCents: number
  taxRatePercent: number | null
  totalCents: number
}
