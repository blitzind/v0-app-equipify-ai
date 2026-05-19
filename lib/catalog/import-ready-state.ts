/** Client/server helpers for catalog import review readiness — testable without React. */

export type CatalogImportReviewContext = {
  organizationId: string | null | undefined
  importId: string | null | undefined
  importStatus?: string | null
  activeJobId?: string | null
  payloadRowCount?: number | null
  hasPayload?: boolean
  errorMessage?: string | null
}

export type CatalogImportReviewReadiness =
  | { ready: true; rowCount: number }
  | {
      ready: false
      reason:
        | "missing_context"
        | "still_processing"
        | "no_rows"
        | "not_prepared"
        | "failed"
        | "cancelled"
      message: string
    }

export function catalogImportMissingContextMessage(ctx: {
  organizationId: string | null | undefined
  importId: string | null | undefined
}): string {
  if (!ctx.organizationId) {
    return "Select an organization before importing a price list."
  }
  if (!ctx.importId) {
    return "The import could not be prepared for review. Upload again or refresh the page."
  }
  return "The import could not be prepared for review."
}

export function evaluateCatalogImportReviewReadiness(
  ctx: CatalogImportReviewContext,
): CatalogImportReviewReadiness {
  if (!ctx.organizationId || !ctx.importId) {
    return {
      ready: false,
      reason: "missing_context",
      message: catalogImportMissingContextMessage(ctx),
    }
  }

  const status = ctx.importStatus ?? null
  const rowCount = typeof ctx.payloadRowCount === "number" ? ctx.payloadRowCount : 0

  if (status === "cancelled") {
    return {
      ready: false,
      reason: "cancelled",
      message: "This import was cancelled. Upload a new file to start again.",
    }
  }

  if (status === "failed") {
    const detail = ctx.errorMessage?.trim()
    return {
      ready: false,
      reason: "failed",
      message: detail || "Extraction failed.",
    }
  }

  if (ctx.activeJobId && (status === "processing" || status === "queued")) {
    return {
      ready: false,
      reason: "still_processing",
      message: "The import is still processing. Wait a moment or refresh the page.",
    }
  }

  if (status === "processing" && !ctx.activeJobId) {
    return {
      ready: false,
      reason: "not_prepared",
      message: "The import could not be prepared for review. Try Re-run extraction or upload again.",
    }
  }

  if (ctx.hasPayload && rowCount > 0) {
    return { ready: true, rowCount }
  }

  if (status === "needs_review" && rowCount === 0) {
    return {
      ready: false,
      reason: "no_rows",
      message:
        "CSV import finished but no rows were extracted. Check column headers (e.g. Invoice Item Name, Item #/SKU, Unit Price) and try again.",
    }
  }

  if (status === "processing") {
    return {
      ready: false,
      reason: "still_processing",
      message: "The import is still processing. Wait a moment or refresh the page.",
    }
  }

  return {
    ready: false,
    reason: "not_prepared",
    message: "The import could not be prepared for review.",
  }
}

/** True when inline CSV/PDF extraction response means the client can load review rows without AI polling. */
export function isInlineExtractionReadyResponse(args: {
  extractionReady?: boolean
  status?: string | null
  rowCount?: number | null
}): boolean {
  if (args.extractionReady === true || args.status === "completed") return true
  return typeof args.rowCount === "number" && args.rowCount > 0
}
