import {
  formatBillingAddressBlock,
  formatServiceAddressBlock,
} from "@/lib/documents/document-address"
import type { CustomerHierarchySummary } from "@/lib/customers/hierarchy"

export type CustomerDocumentFields = {
  customerCompanyName: string
  billingName: string
  customerPhone: string | null
  customerEmail: string | null
  serviceAddressBlock: string | null
  billingAddressBlock: string | null
  poNumber: string | null
}

export type CustomerContactRow = {
  company_name?: string | null
  phone?: string | null
  billing_email?: string | null
  billing_contact_phone?: string | null
  default_po_number?: string | null
  billing_name?: string | null
}

/** Pure assembly used by loaders and regression tests. */
export function customerDocumentFieldsFromCustomerAndHierarchy(
  row: CustomerContactRow,
  hierarchy: CustomerHierarchySummary | null,
): CustomerDocumentFields {
  const customerCompanyName = row.company_name?.trim() || "Customer"
  const customerPhone = row.billing_contact_phone?.trim() || row.phone?.trim() || null
  const customerEmail = row.billing_email?.trim() || null
  const poNumber = row.default_po_number?.trim() || null

  if (!hierarchy) {
    const billingName = row.billing_name?.trim() || customerCompanyName
    return {
      customerCompanyName,
      billingName,
      customerPhone,
      customerEmail,
      serviceAddressBlock: null,
      billingAddressBlock: null,
      poNumber,
    }
  }

  const serviceName = row.billing_name?.trim() || customerCompanyName
  const billingName =
    hierarchy.billingAddress.billingName?.trim() || row.billing_name?.trim() || customerCompanyName

  return {
    customerCompanyName,
    billingName,
    customerPhone: hierarchy.billingAddress.phone?.trim() || customerPhone,
    customerEmail: hierarchy.billingAddress.email?.trim() || customerEmail,
    serviceAddressBlock: formatServiceAddressBlock(hierarchy.defaultServiceAddress, serviceName),
    billingAddressBlock: formatBillingAddressBlock(hierarchy.billingAddress, serviceName),
    poNumber: hierarchy.billingAddress.defaultPoNumber || poNumber,
  }
}
