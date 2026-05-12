/** Shared QuickBooks invoice sync preview (no server-only). */

export type QuickBooksConnectionPreviewUi = {
  status: "connected" | "disconnected" | "error" | "unknown"
  connectionNeedsAttention: boolean
  lastSuccessfulSyncAt: string | null
  lastSyncAttemptAt: string | null
  syncHealth: string | null
  lastSyncError: string | null
}

export type QuickBooksInvoiceMappingPreviewUi = {
  syncStatus: string | null
  lastSyncedAt: string | null
  quickBooksInvoiceId: string | null
}

export type PrepareQuickBooksInvoiceSyncPreviewPayload = {
  invoiceId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    statusUi: string
    amountCents: number
  }
  customer: { id: string; companyName: string }
  qbConnection: QuickBooksConnectionPreviewUi
  existingInvoiceMapping: QuickBooksInvoiceMappingPreviewUi | null
  customerMappedToQuickBooks: boolean
  unmappedCatalogLineCount: number
  /** Plain-language summary of create vs update vs blocked. */
  whatWillSyncSummary: string
  readiness: "ready" | "degraded" | "blocked"
  warnings: string[]
}
