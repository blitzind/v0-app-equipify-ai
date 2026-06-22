import { formatBillingAddressPartsBlock } from "@/lib/documents/document-address"
import type { CustomerDocumentFields } from "@/lib/documents/customer-document-fields"

export type InvoiceBillingSnapshotParts = {
  billing_name?: string | null
  billing_address_line1?: string | null
  billing_address_line2?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_postal_code?: string | null
  billing_country?: string | null
}

export type ResolvedInvoiceBillToFields = {
  billToName: string
  billToAddressBlock: string
}

/**
 * Merges invoice billing snapshot columns with live customer document fields.
 * Snapshot wins when present; live customer profile fills gaps at PDF/render time.
 */
export function resolveInvoiceBillToFields(
  snapshot: InvoiceBillingSnapshotParts,
  customerFields: CustomerDocumentFields | null,
): ResolvedInvoiceBillToFields {
  const snapshotBillToName = snapshot.billing_name?.trim() || null
  const snapshotAddressBlock = formatBillingAddressPartsBlock(
    {
      billing_address_line1: snapshot.billing_address_line1,
      billing_address_line2: snapshot.billing_address_line2,
      billing_city: snapshot.billing_city,
      billing_state: snapshot.billing_state,
      billing_postal_code: snapshot.billing_postal_code,
      billing_country: snapshot.billing_country,
    },
    snapshotBillToName,
  ).trim()

  const billToName =
    snapshotBillToName ||
    customerFields?.billingName?.trim() ||
    customerFields?.customerCompanyName?.trim() ||
    "Customer"

  const billToAddressBlock =
    snapshotAddressBlock || customerFields?.billingAddressBlock?.trim() || ""

  return { billToName, billToAddressBlock }
}
