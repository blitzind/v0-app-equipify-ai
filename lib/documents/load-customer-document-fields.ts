import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  customerDocumentFieldsFromCustomerAndHierarchy,
  type CustomerContactRow,
  type CustomerDocumentFields,
} from "@/lib/documents/customer-document-fields"
import { loadCustomerHierarchy } from "@/lib/customers/hierarchy"

export type { CustomerDocumentFields } from "@/lib/documents/customer-document-fields"

/** Columns on public.customers — do not select `phone` (lives on customer_contacts). */
export const CUSTOMER_DOCUMENT_FIELDS_SELECT =
  "company_name, billing_email, billing_contact_phone, default_po_number, billing_name"

type PrimaryContactRow = {
  email?: string | null
  phone?: string | null
  is_primary?: boolean | null
}

async function loadPrimaryContactRow(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<PrimaryContactRow | null> {
  const { data } = await supabase
    .from("customer_contacts")
    .select("email, phone, is_primary")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as PrimaryContactRow | null) ?? null
}

export async function loadCustomerDocumentFields(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<CustomerDocumentFields | null> {
  const trimmedId = customerId?.trim()
  if (!trimmedId) return null

  const [custRes, hierarchy, primaryContact] = await Promise.all([
    supabase
      .from("customers")
      .select(CUSTOMER_DOCUMENT_FIELDS_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", trimmedId)
      .maybeSingle(),
    loadCustomerHierarchy(supabase, { organizationId, customerId: trimmedId }),
    loadPrimaryContactRow(supabase, organizationId, trimmedId),
  ])

  if (custRes.error || !custRes.data) return null

  const cust = custRes.data as CustomerContactRow
  if (primaryContact) {
    cust.primary_contact_email = primaryContact.email
    cust.primary_contact_phone = primaryContact.phone
  }

  return customerDocumentFieldsFromCustomerAndHierarchy(cust, hierarchy)
}
