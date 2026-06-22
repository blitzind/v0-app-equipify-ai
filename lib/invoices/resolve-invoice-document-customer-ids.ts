/**
 * Resolves which customer ids invoice PDF/document loaders should use.
 * Operational customer_id drives service-site context; billing_customer_id
 * (when set) drives bill-to name/address fallbacks.
 */
export function resolveInvoiceDocumentCustomerIds(
  customerId: string | null | undefined,
  billingCustomerId: string | null | undefined,
): { operationalCustomerId: string | null; billToCustomerId: string | null } {
  const operationalCustomerId = customerId?.trim() || null
  const billToCustomerId = billingCustomerId?.trim() || operationalCustomerId
  return { operationalCustomerId, billToCustomerId }
}
