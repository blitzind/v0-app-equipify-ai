import assert from "node:assert/strict"
import { buildQuoteEmailContent } from "../lib/email/templates"
import { buildQuotePdfDownloadHeaders, buildQuotePdfFilename } from "../lib/quotes/quote-pdf-filename"
import { generateQuotePdfBuffer } from "../lib/quotes/generate-quote-pdf"
import type { QuoteDocumentContext } from "../lib/quotes/quote-document-context"

async function main() {
  assert.equal(buildQuotePdfFilename("QT-000003"), "quote-QT-000003.pdf")
  assert.equal(buildQuotePdfFilename("  QT 000003  "), "quote-QT-000003.pdf")
  assert.equal(buildQuotePdfFilename(""), "quote-Quote.pdf")

  const headers = buildQuotePdfDownloadHeaders("quote-QT-000003.pdf")
  assert.equal(headers["Content-Type"], "application/pdf")
  assert.equal(headers["Content-Disposition"], 'attachment; filename="quote-QT-000003.pdf"')
  assert.equal(headers["Cache-Control"], "private, no-store")

  const emailBase = {
    organizationName: "Acme Calibration",
    customerName: "Beta Labs",
    quoteLabel: "QT-000003",
    amountLabel: "$1,250.00",
    expiresLabel: "Jul 15, 2026",
  }

  const withPdf = buildQuoteEmailContent({ ...emailBase, pdfAttached: true })
  assert.ok(!withPdf.html.includes("document generation is enabled"))
  assert.ok(withPdf.html.includes("attached as a PDF"))
  assert.ok(withPdf.text.includes("A PDF copy of this quote is attached."))

  const withoutPdf = buildQuoteEmailContent({ ...emailBase, pdfAttached: false })
  assert.ok(!withoutPdf.html.includes("document generation is enabled"))
  assert.ok(!withoutPdf.html.includes("attached as a PDF"))
  assert.ok(!withoutPdf.text.includes("A PDF copy of this quote is attached."))

  const mockCtx: QuoteDocumentContext = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    quoteId: "00000000-0000-4000-8000-000000000002",
    customerId: "00000000-0000-4000-8000-000000000003",
    organizationName: "Acme Calibration",
    documentLogoUrl: null,
    logoUrl: null,
    quoteNumberLabel: "QT-000003",
    quoteTitle: "Annual scale calibration",
    customerCompanyName: "Beta Labs",
    equipmentName: "Floor scale FS-12",
    statusDisplay: "Sent",
    createdDateLabel: "Jun 1, 2026",
    expiresDateLabel: "Jul 15, 2026",
    lineItems: [
      {
        description: "Calibration service",
        qty: 1,
        unitUsd: 1250,
        lineTotalUsd: 1250,
      },
    ],
    customerNotes: "Please schedule during business hours.",
    totalCents: 125_000,
  }

  const pdfBytes = await generateQuotePdfBuffer(mockCtx)
  assert.ok(pdfBytes.byteLength > 200)
  assert.equal(String.fromCharCode(...pdfBytes.slice(0, 4)), "%PDF")

  const attachmentName = buildQuotePdfFilename(mockCtx.quoteNumberLabel)
  assert.equal(attachmentName, "quote-QT-000003.pdf")

  console.log("quote-pdf tests passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
