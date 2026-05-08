import type { SupabaseClient } from "@supabase/supabase-js"

export type BillingBehavior = "own_billing" | "parent_billing" | "custom"

export type CustomerBillingProfile = {
  customerId: string
  customerName: string
  billingCustomerId: string
  billingCustomerName: string
  behavior: BillingBehavior
  inheritedFromParent: boolean
  billingName: string
  billingContactName: string | null
  billingContactEmail: string | null
  billingContactPhone: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string | null
  poRequired: boolean
  poRequiredBeforeService: boolean
  poRequiredBeforeInvoice: boolean
  defaultPoNumber: string | null
  invoiceInstructions: string | null
  invoiceDeliveryPreference: string | null
  defaultPaymentTermsKey: string | null
  defaultPaymentTermsDays: number | null
  defaultPaymentTermsLabel: string | null
  taxExempt: boolean
  taxExemptionId: string | null
  taxExemptionNotes: string | null
  defaultTaxBasis: string | null
  defaultTaxCategory: string | null
}

type BillingCustomerRow = {
  id: string
  company_name: string
  parent_customer_id: string | null
  billing_behavior: BillingBehavior | null
  billing_name: string | null
  billing_contact_name: string | null
  billing_email: string | null
  billing_contact_phone: string | null
  billing_address_same_as_service: boolean | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  po_required: boolean | null
  po_number_required_before_service: boolean | null
  po_number_required_before_invoice: boolean | null
  default_po_number: string | null
  invoice_delivery_preference: string | null
  invoice_instructions: string | null
  default_invoice_terms_code: string | null
  default_payment_terms_key: string | null
  default_payment_terms_days: number | null
  default_payment_terms_label: string | null
  tax_exempt: boolean | null
  tax_exemption_id: string | null
  tax_exemption_notes: string | null
  default_tax_basis: string | null
  default_tax_category: string | null
}

type DefaultLocationRow = {
  customer_id: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
}

const BILLING_SELECT = [
  "id",
  "company_name",
  "parent_customer_id",
  "billing_behavior",
  "billing_name",
  "billing_contact_name",
  "billing_email",
  "billing_contact_phone",
  "billing_address_same_as_service",
  "billing_address_line1",
  "billing_address_line2",
  "billing_city",
  "billing_state",
  "billing_postal_code",
  "billing_country",
  "po_required",
  "po_number_required_before_service",
  "po_number_required_before_invoice",
  "default_po_number",
  "invoice_delivery_preference",
  "invoice_instructions",
  "default_invoice_terms_code",
  "default_payment_terms_key",
  "default_payment_terms_days",
  "default_payment_terms_label",
  "tax_exempt",
  "tax_exemption_id",
  "tax_exemption_notes",
  "default_tax_basis",
  "default_tax_category",
].join(", ")

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeBehavior(value: string | null | undefined): BillingBehavior {
  if (value === "parent_billing" || value === "custom" || value === "own_billing") return value
  return "own_billing"
}

function buildProfile(
  customer: BillingCustomerRow,
  source: BillingCustomerRow,
  defaultLocation: DefaultLocationRow | null,
): CustomerBillingProfile {
  const inheritsService = source.billing_address_same_as_service !== false
  const behavior = normalizeBehavior(customer.billing_behavior)
  const line1 = inheritsService ? defaultLocation?.address_line1 ?? "" : source.billing_address_line1 ?? ""
  const line2 = inheritsService ? defaultLocation?.address_line2 ?? null : source.billing_address_line2 ?? null
  const city = inheritsService ? defaultLocation?.city ?? "" : source.billing_city ?? ""
  const state = inheritsService ? defaultLocation?.state ?? "" : source.billing_state ?? ""
  const postalCode = inheritsService ? defaultLocation?.postal_code ?? "" : source.billing_postal_code ?? ""

  return {
    customerId: customer.id,
    customerName: customer.company_name,
    billingCustomerId: source.id,
    billingCustomerName: source.company_name,
    behavior,
    inheritedFromParent: source.id !== customer.id,
    billingName: clean(source.billing_name) ?? source.company_name,
    billingContactName: clean(source.billing_contact_name),
    billingContactEmail: clean(source.billing_email),
    billingContactPhone: clean(source.billing_contact_phone),
    addressLine1: line1,
    addressLine2: clean(line2),
    city,
    state,
    postalCode,
    country: clean(source.billing_country),
    poRequired: Boolean(source.po_required),
    poRequiredBeforeService: Boolean(source.po_number_required_before_service),
    poRequiredBeforeInvoice: Boolean(source.po_number_required_before_invoice),
    defaultPoNumber: clean(source.default_po_number),
    invoiceInstructions: clean(source.invoice_instructions),
    invoiceDeliveryPreference: clean(source.invoice_delivery_preference),
    defaultPaymentTermsKey: clean(source.default_payment_terms_key) ?? clean(source.default_invoice_terms_code),
    defaultPaymentTermsDays: source.default_payment_terms_days,
    defaultPaymentTermsLabel: clean(source.default_payment_terms_label),
    taxExempt: Boolean(source.tax_exempt),
    taxExemptionId: clean(source.tax_exemption_id),
    taxExemptionNotes: clean(source.tax_exemption_notes),
    defaultTaxBasis: clean(source.default_tax_basis),
    defaultTaxCategory: clean(source.default_tax_category),
  }
}

export async function resolveCustomerBillingProfile(
  supabase: SupabaseClient,
  args: { organizationId: string; customerId: string },
): Promise<CustomerBillingProfile | null> {
  const { organizationId, customerId } = args
  const { data: customerData, error } = await supabase
    .from("customers")
    .select(BILLING_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()

  if (error || !customerData) return null

  const customer = customerData as BillingCustomerRow
  let source = customer

  if (normalizeBehavior(customer.billing_behavior) === "parent_billing" && customer.parent_customer_id) {
    const { data: parentData } = await supabase
      .from("customers")
      .select(BILLING_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", customer.parent_customer_id)
      .maybeSingle()
    if (parentData) source = parentData as BillingCustomerRow
  }

  const { data: locData } = await supabase
    .from("customer_locations")
    .select("customer_id, address_line1, address_line2, city, state, postal_code")
    .eq("organization_id", organizationId)
    .eq("customer_id", source.id)
    .eq("is_default", true)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return buildProfile(customer, source, (locData as DefaultLocationRow | null) ?? null)
}
