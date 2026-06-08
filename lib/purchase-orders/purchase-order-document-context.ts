export type PurchaseOrderDocumentLineItem = {
  description: string
  itemName: string
  detailNotes: string | null
  qty: number
  unitUsd: number
  lineTotalUsd: number
  sku?: string
}

export type PurchaseOrderDocumentContext = {
  organizationId: string
  purchaseOrderId: string
  organizationName: string
  documentLogoUrl: string | null
  logoUrl: string | null
  companyAddress: string | null
  companyPhone: string | null
  companyWebsite: string | null
  companyEmail: string | null
  purchaseOrderNumberLabel: string
  statusDisplay: string
  orderDateLabel: string
  expectedDateLabel: string
  vendorName: string
  vendorEmail: string | null
  vendorPhone: string | null
  vendorContactName: string | null
  customerCompanyName: string | null
  customerPhone: string | null
  customerEmail: string | null
  shipToBlock: string | null
  billToBlock: string | null
  workOrderLabel: string | null
  lineItems: PurchaseOrderDocumentLineItem[]
  notes: string | null
  totalCents: number
}
