export function buildPurchaseOrderPdfFilename(purchaseOrderNumber: string): string {
  const raw = purchaseOrderNumber.trim() || "Purchase-Order"
  const slug = raw
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = slug.length > 0 ? slug : "Purchase-Order"
  return `purchase-order-${base}.pdf`
}

export function buildPurchaseOrderPdfDownloadHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  }
}
