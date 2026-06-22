import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  customerDocumentFieldsFromCustomerAndHierarchy,
  type CustomerContactRow,
  type CustomerDocumentFields,
} from "@/lib/documents/customer-document-fields"
import { loadCustomerHierarchy } from "@/lib/customers/hierarchy"

export type { CustomerDocumentFields } from "@/lib/documents/customer-document-fields"

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
    loadCustomerHierarchy(supabase, { organizationId, customerId }),
  ])

  if (!cust) return null

  return customerDocumentFieldsFromCustomerAndHierarchy(cust as CustomerContactRow, hierarchy)
}
