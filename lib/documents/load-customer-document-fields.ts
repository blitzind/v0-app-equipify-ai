import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  formatBillingAddressBlock,
  formatServiceAddressBlock,
} from "@/lib/documents/document-address"
import { loadCustomerHierarchy } from "@/lib/customers/hierarchy"

export type CustomerDocumentFields = {
  customerCompanyName: string
  customerPhone: string | null
  customerEmail: string | null
  serviceAddressBlock: string | null
  billingAddressBlock: string | null
  poNumber: string | null
}

const CUSTOMER_CONTACT_SELECT =
  "company_name, phone, billing_email, billing_contact_phone, default_po_number, billing_name"

export async function loadCustomerDocumentFields(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<CustomerDocumentFields | null> {
  const [{ data: cust }, hierarchy] = await Promise.all([
    supabase
      .from("customers")
      .select(CUSTOMER_CONTACT_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle(),
    loadCustomerHierarchy(supabase, organizationId, customerId),
  ])

  if (!cust) return null

  const row = cust as {
    company_name?: string | null
    phone?: string | null
    billing_email?: string | null
    billing_contact_phone?: string | null
    default_po_number?: string | null
    billing_name?: string | null
  }

  const customerCompanyName = row.company_name?.trim() || "Customer"
  const customerPhone = row.billing_contact_phone?.trim() || row.phone?.trim() || null
  const customerEmail = row.billing_email?.trim() || null
  const poNumber = row.default_po_number?.trim() || null

  if (!hierarchy) {
    return {
      customerCompanyName,
      customerPhone,
      customerEmail,
      serviceAddressBlock: null,
      billingAddressBlock: null,
      poNumber,
    }
  }

  const serviceName = row.billing_name?.trim() || customerCompanyName

  return {
    customerCompanyName,
    customerPhone: hierarchy.billingAddress.phone?.trim() || customerPhone,
    customerEmail: hierarchy.billingAddress.email?.trim() || customerEmail,
    serviceAddressBlock: formatServiceAddressBlock(hierarchy.defaultServiceAddress, serviceName),
    billingAddressBlock: formatBillingAddressBlock(hierarchy.billingAddress, serviceName),
    poNumber: hierarchy.billingAddress.defaultPoNumber || poNumber,
  }
}
