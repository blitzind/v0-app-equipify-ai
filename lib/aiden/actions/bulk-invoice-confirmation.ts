/** Typed confirmation for bulk draft invoice creation — keep in sync with UI copy. */
export const AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE = "CREATE DRAFT INVOICES"

export function normalizeBulkInvoiceConfirmationPhrase(input: string): string {
  return input.trim().replace(/\s+/g, " ").toUpperCase()
}

export function bulkInvoiceConfirmationPhraseMatches(input: string | undefined | null): boolean {
  if (!input?.trim()) return false
  return normalizeBulkInvoiceConfirmationPhrase(input) === AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE
}
